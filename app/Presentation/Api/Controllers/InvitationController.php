<?php

declare(strict_types=1);

namespace App\Presentation\Api\Controllers;

use App\Contexts\Identity\Application\Commands\AcceptInvitationCommand;
use App\Contexts\Identity\Application\Commands\InviteUserCommand;
use App\Contexts\Identity\Application\Exceptions\InvalidInvitationTargetException;
use App\Contexts\Identity\Application\Exceptions\PasswordConfirmationMismatchException;
use App\Contexts\Identity\Application\Exceptions\UnauthorizedInvitationException;
use App\Contexts\Identity\Application\Exceptions\UserAlreadyExistsException;
use App\Contexts\Identity\Application\UseCases\AcceptInvitationUseCase;
use App\Contexts\Identity\Application\UseCases\InviteUserUseCase;
use App\Contexts\Identity\Domain\Exceptions\InvalidInvitationTokenException;
use App\Contexts\Identity\Domain\Exceptions\InvitationAlreadyAcceptedException;
use App\Contexts\Identity\Domain\Exceptions\InvitationExpiredException;
use App\Contexts\Identity\Domain\Exceptions\InvitationRevokedException;
use App\Contexts\Identity\Domain\Repositories\InvitationRepositoryInterface;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\Token;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use App\Models\Company;
use App\Models\Invitation;
use App\Models\User;
use App\Presentation\Api\Requests\AcceptInvitationRequest;
use App\Presentation\Api\Requests\StoreInvitationRequest;
use App\Presentation\Api\Resources\InvitationResource;
use DomainException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

final class InvitationController extends Controller
{
    /**
     * List invitations with role-based scoping, search, and status filtering.
     */
    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        if ($currentUser === null || $currentUser->isClient()) {
            return new JsonResponse([
                'message' => 'Brak uprawnień do przeglądania zaproszeń.',
            ], Response::HTTP_FORBIDDEN);
        }

        $query = Invitation::query()
            ->with(['company', 'inviter:id,name,email']);

        // Advisor can only view invitations related to their assigned companies
        if ($currentUser->isAdvisor()) {
            $assignedIds = $currentUser->assignedCompanies()->pluck('companies.id')->all();
            $query->where(function (Builder $q) use ($assignedIds) {
                $q->whereIn('company_id', $assignedIds);
                foreach ($assignedIds as $cid) {
                    $q->orWhereJsonContains('assigned_companies', $cid);
                }
            });
        }

        // Filtering by status
        if ($request->filled('status')) {
            $status = (string) $request->query('status');
            match ($status) {
                'pending' => $query->pending(),
                'accepted' => $query->accepted(),
                'revoked' => $query->revoked(),
                'expired' => $query->expired(),
                default => null,
            };
        }

        // Filtering by target company
        if ($request->filled('company_id')) {
            $companyId = (string) $request->query('company_id');
            $query->where(function (Builder $q) use ($companyId) {
                $q->where('company_id', $companyId)
                    ->orWhereJsonContains('assigned_companies', $companyId);
            });
        }

        // Search by recipient email
        if ($request->filled('search')) {
            $search = '%' . strtolower(trim((string) $request->query('search'))) . '%';
            $query->whereRaw('LOWER(email) LIKE ?', [$search]);
        }

        $invitations = $query
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        return InvitationResource::collection($invitations);
    }

    /**
     * Issue and send a new invitation.
     */
    public function store(StoreInvitationRequest $request, InviteUserUseCase $useCase): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        $command = new InviteUserCommand(
            invitedById: (string) $currentUser->id,
            email: (string) $request->input('email'),
            role: (string) $request->input('role'),
            companyId: $request->input('company_id'),
            assignedCompanyIds: $request->input('assigned_company_ids', []),
            validityHours: $request->input('validity_hours') ? (int) $request->input('validity_hours') : null
        );

        try {
            $invitation = $useCase->execute($command);
        } catch (UnauthorizedInvitationException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_FORBIDDEN);
        } catch (UserAlreadyExistsException|InvalidInvitationTargetException|InvalidArgumentException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $model = Invitation::with(['company', 'inviter:id,name,email'])->findOrFail($invitation->id());

        return (new InvitationResource($model))
            ->additional(['message' => 'Zaproszenie zostało pomyślnie utworzone i wysłane.'])
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Public verification endpoint for invitation tokens.
     */
    public function verify(Request $request): JsonResponse
    {
        $rawToken = (string) ($request->query('token') ?? $request->route('token') ?? '');
        $token = trim($rawToken);

        if ($token === '') {
            return new JsonResponse([
                'message' => 'Brak tokenu zaproszenia w żądaniu.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $invitation = Invitation::with('company')->where('token', $token)->first();

        if ($invitation === null) {
            return new JsonResponse([
                'message' => 'Podany token zaproszenia nie istnieje lub jest nieprawidłowy.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($invitation->isRevoked()) {
            return new JsonResponse([
                'message' => 'To zaproszenie zostało anulowane przez administratora.',
            ], Response::HTTP_GONE);
        }

        if ($invitation->isAccepted()) {
            return new JsonResponse([
                'message' => 'To zaproszenie zostało już wcześniej zaakceptowane. Możesz zalogować się do systemu.',
            ], Response::HTTP_GONE);
        }

        if ($invitation->isExpired()) {
            return new JsonResponse([
                'message' => 'Link aktywacyjny zaproszenia wygasł. Poproś administratora o ponowne przesłanie zaproszenia.',
            ], Response::HTTP_GONE);
        }

        $assignedCompanyIds = is_array($invitation->assigned_companies) ? $invitation->assigned_companies : [];
        $assignedCompaniesData = [];
        if (!empty($assignedCompanyIds)) {
            $assignedCompaniesData = Company::whereIn('id', $assignedCompanyIds)
                ->get(['id', 'name', 'code'])
                ->values()
                ->all();
        }

        return new JsonResponse([
            'valid' => true,
            'email' => $invitation->email,
            'role' => $invitation->role,
            'company' => $invitation->company ? [
                'id' => (string) $invitation->company->id,
                'name' => $invitation->company->name,
                'code' => $invitation->company->code,
            ] : null,
            'assigned_companies' => $assignedCompaniesData,
            'expires_at' => $invitation->expires_at?->toIso8601String(),
        ], Response::HTTP_OK);
    }

    /**
     * Public acceptance endpoint to establish password and activate user account.
     */
    public function accept(AcceptInvitationRequest $request, AcceptInvitationUseCase $useCase): JsonResponse
    {
        $command = new AcceptInvitationCommand(
            token: (string) $request->input('token'),
            name: (string) $request->input('name'),
            password: (string) $request->input('password'),
            passwordConfirmation: (string) $request->input('password_confirmation')
        );

        try {
            $domainUser = $useCase->execute($command);
        } catch (InvalidInvitationTokenException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_NOT_FOUND);
        } catch (InvitationExpiredException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_GONE);
        } catch (InvitationAlreadyAcceptedException|InvitationRevokedException|UserAlreadyExistsException|PasswordConfirmationMismatchException|InvalidArgumentException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        /** @var User $userModel */
        $userModel = User::with('company')->findOrFail($domainUser->id());
        $authToken = $userModel->createToken('finboard-api-token')->plainTextToken;

        return new JsonResponse([
            'message' => 'Konto zostało pomyślnie aktywowane. Witamy w systemie FinBoard!',
            'token' => $authToken,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $userModel->id,
                'name' => $userModel->name,
                'email' => $userModel->email,
                'role' => $userModel->role,
                'company' => $userModel->company ? [
                    'id' => $userModel->company->id,
                    'name' => $userModel->company->name,
                    'code' => $userModel->company->code,
                    'tax_id' => $userModel->company->tax_id,
                ] : null,
            ],
            'available_companies' => $this->resolveAvailableCompanies($userModel),
        ], Response::HTTP_CREATED);
    }

    /**
     * Renew an invitation with extended 48h validity and re-dispatch email.
     */
    public function resend(string $id, Request $request, InvitationRepositoryInterface $invitationRepo): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        $invitation = $invitationRepo->findById(InvitationId::fromString($id));
        if ($invitation === null) {
            return new JsonResponse(['message' => 'Zaproszenie nie zostało odnalezione.'], Response::HTTP_NOT_FOUND);
        }

        // Authorization check for Advisor
        if ($currentUser->isAdvisor()) {
            $assignedIds = $currentUser->assignedCompanies()->pluck('companies.id')->all();
            $hasAccess = ($invitation->companyId() && in_array($invitation->companyId(), $assignedIds, true))
                || !empty(array_intersect($invitation->assignedCompanyIds(), $assignedIds));

            if (!$hasAccess) {
                return new JsonResponse(['message' => 'Brak uprawnień do odnowienia tego zaproszenia.'], Response::HTTP_FORBIDDEN);
            }
        }

        try {
            $newToken = Token::generate(Token::DEFAULT_VALIDITY_HOURS);
            $invitation->renewToken($newToken);
            $invitationRepo->save($invitation);
        } catch (DomainException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return new JsonResponse([
            'message' => 'Nowy link aktywacyjny został wysłany na podany adres email.',
        ], Response::HTTP_OK);
    }

    /**
     * Revoke a pending invitation.
     */
    public function destroy(string $id, Request $request, InvitationRepositoryInterface $invitationRepo): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $request->user();

        $invitation = $invitationRepo->findById(InvitationId::fromString($id));
        if ($invitation === null) {
            return new JsonResponse(['message' => 'Zaproszenie nie zostało odnalezione.'], Response::HTTP_NOT_FOUND);
        }

        // Authorization check for Advisor
        if ($currentUser->isAdvisor()) {
            $assignedIds = $currentUser->assignedCompanies()->pluck('companies.id')->all();
            $hasAccess = ($invitation->companyId() && in_array($invitation->companyId(), $assignedIds, true))
                || !empty(array_intersect($invitation->assignedCompanyIds(), $assignedIds));

            if (!$hasAccess) {
                return new JsonResponse(['message' => 'Brak uprawnień do unieważnienia tego zaproszenia.'], Response::HTTP_FORBIDDEN);
            }
        }

        try {
            $invitation->revoke(UserId::fromString($currentUser->id));
            $invitationRepo->save($invitation);
        } catch (DomainException $e) {
            return new JsonResponse(['message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return new JsonResponse([
            'message' => 'Zaproszenie zostało pomyślnie unieważnione.',
        ], Response::HTTP_OK);
    }

    private function resolveAvailableCompanies(User $user): mixed
    {
        if ($user->isAdmin()) {
            return Company::orderBy('name')->get(['id', 'name', 'code', 'tax_id'])->values();
        }

        if ($user->isAdvisor()) {
            return $user->assignedCompanies()
                ->orderBy('name')
                ->get(['companies.id', 'companies.name', 'companies.code', 'companies.tax_id'])
                ->values();
        }

        return $user->company ? [
            [
                'id' => $user->company->id,
                'name' => $user->company->name,
                'code' => $user->company->code,
                'tax_id' => $user->company->tax_id,
            ],
        ] : [];
    }
}
