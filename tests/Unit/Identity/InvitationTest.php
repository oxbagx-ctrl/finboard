<?php

declare(strict_types=1);

namespace Tests\Unit\Identity;

use App\Contexts\Identity\Domain\Entities\Invitation;
use App\Contexts\Identity\Domain\Entities\Role;
use App\Contexts\Identity\Domain\Events\InvitationAccepted;
use App\Contexts\Identity\Domain\Events\InvitationRevoked;
use App\Contexts\Identity\Domain\Events\UserInvited;
use App\Contexts\Identity\Domain\Exceptions\InvitationAlreadyAcceptedException;
use App\Contexts\Identity\Domain\Exceptions\InvitationExpiredException;
use App\Contexts\Identity\Domain\Exceptions\InvitationRevokedException;
use App\Contexts\Identity\Domain\ValueObjects\Email;
use App\Contexts\Identity\Domain\ValueObjects\InvitationId;
use App\Contexts\Identity\Domain\ValueObjects\InvitationStatus;
use App\Contexts\Identity\Domain\ValueObjects\Token;
use App\Contexts\Identity\Domain\ValueObjects\UserId;
use DateTimeImmutable;
use DomainException;
use PHPUnit\Framework\TestCase;

final class InvitationTest extends TestCase
{
    private const COMPANY_A = '11111111-1111-1111-1111-111111111111';
    private const COMPANY_B = '22222222-2222-2222-2222-222222222222';

    public function test_invitation_can_be_created_and_records_user_invited_event(): void
    {
        $invitationId = InvitationId::generate();
        $email = Email::fromString('new.cfo@targetcorp.com');
        $role = Role::client();
        $invitedBy = UserId::generate();
        $now = new DateTimeImmutable('2026-07-01 10:00:00');

        $invitation = Invitation::create(
            id: $invitationId,
            email: $email,
            role: $role,
            invitedBy: $invitedBy,
            companyId: self::COMPANY_A,
            now: $now
        );

        $this->assertSame($invitationId->value(), $invitation->id());
        $this->assertTrue($invitation->email()->equals($email));
        $this->assertSame($role->id(), $invitation->role()->id());
        $this->assertSame($invitedBy->value(), $invitation->invitedBy()->value());
        $this->assertSame(self::COMPANY_A, $invitation->companyId());
        $this->assertSame(InvitationStatus::PENDING, $invitation->status());
        $this->assertTrue($invitation->isPending($now));
        $this->assertFalse($invitation->isAccepted());
        $this->assertFalse($invitation->isRevoked());
        $this->assertFalse($invitation->isExpired($now));
        $this->assertTrue($invitation->canBeAccepted($now));

        $events = $invitation->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(UserInvited::class, $events[0]);
        $this->assertSame($invitationId->value(), $events[0]->invitationId());
        $this->assertSame('new.cfo@targetcorp.com', $events[0]->email());
        $this->assertSame('client', $events[0]->role());
        $this->assertSame(self::COMPANY_A, $events[0]->companyId());
        $this->assertSame($invitedBy->value(), $events[0]->invitedBy());
        $this->assertSame($invitation->token()->value(), $events[0]->token());
        $this->assertSame('2026-07-03 10:00:00', $events[0]->expiresAt()->format('Y-m-d H:i:s'));
    }

    public function test_advisor_invitation_merges_company_ids(): void
    {
        $invitation = Invitation::create(
            id: InvitationId::generate(),
            email: Email::fromString('deal.advisor@helvest.com'),
            role: Role::advisor(),
            invitedBy: UserId::generate(),
            companyId: self::COMPANY_A,
            assignedCompanyIds: [self::COMPANY_B]
        );

        $this->assertContains(self::COMPANY_A, $invitation->assignedCompanyIds());
        $this->assertContains(self::COMPANY_B, $invitation->assignedCompanyIds());
    }

    public function test_invitation_token_verification(): void
    {
        $invitation = $this->createPendingInvitation();
        $tokenString = $invitation->token()->value();

        $this->assertTrue($invitation->verifyToken($tokenString));
        $this->assertFalse($invitation->verifyToken('wrong_token_that_does_not_match_123456789012'));
    }

    public function test_invitation_can_be_accepted(): void
    {
        $now = new DateTimeImmutable('2026-07-01 10:00:00');
        $invitation = $this->createPendingInvitation($now);

        $acceptTime = new DateTimeImmutable('2026-07-01 15:30:00');
        $newUserId = UserId::generate()->value();

        $invitation->accept($newUserId, $acceptTime);

        $this->assertTrue($invitation->isAccepted());
        $this->assertFalse($invitation->isPending($acceptTime));
        $this->assertFalse($invitation->canBeAccepted($acceptTime));
        $this->assertSame(InvitationStatus::ACCEPTED, $invitation->status());
        $this->assertSame('2026-07-01 15:30:00', $invitation->acceptedAt()?->format('Y-m-d H:i:s'));

        $events = $invitation->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(InvitationAccepted::class, $events[0]);
        $this->assertSame($invitation->id(), $events[0]->invitationId());
        $this->assertSame($newUserId, $events[0]->registeredUserId());
    }

    public function test_cannot_accept_already_accepted_invitation(): void
    {
        $invitation = $this->createPendingInvitation();
        $invitation->accept(UserId::generate()->value());

        $this->expectException(InvitationAlreadyAcceptedException::class);
        $invitation->accept(UserId::generate()->value());
    }

    public function test_cannot_accept_expired_invitation(): void
    {
        $creation = new DateTimeImmutable('2026-07-01 10:00:00');
        $invitation = $this->createPendingInvitation($creation);

        $tooLateTime = new DateTimeImmutable('2026-07-03 10:00:01'); // 48h + 1s

        $this->expectException(InvitationExpiredException::class);
        $this->expectExceptionMessage('Link aktywacyjny zaproszenia wygasł');

        $invitation->accept(UserId::generate()->value(), $tooLateTime);
    }

    public function test_cannot_accept_revoked_invitation(): void
    {
        $invitation = $this->createPendingInvitation();
        $adminId = UserId::generate();

        $invitation->revoke($adminId);

        $this->expectException(InvitationRevokedException::class);
        $invitation->accept(UserId::generate()->value());
    }

    public function test_invitation_can_be_revoked_by_admin(): void
    {
        $creation = new DateTimeImmutable('2026-07-01 10:00:00');
        $invitation = $this->createPendingInvitation($creation);
        $adminId = UserId::generate();

        $revokeTime = new DateTimeImmutable('2026-07-01 12:00:00');
        $invitation->revoke($adminId, $revokeTime);

        $this->assertTrue($invitation->isRevoked());
        $this->assertFalse($invitation->isPending($revokeTime));
        $this->assertFalse($invitation->canBeAccepted($revokeTime));
        $this->assertSame(InvitationStatus::REVOKED, $invitation->status());
        $this->assertSame($adminId->value(), $invitation->revokedBy()?->value());
        $this->assertSame('2026-07-01 12:00:00', $invitation->revokedAt()?->format('Y-m-d H:i:s'));

        $events = $invitation->releaseEvents();
        $this->assertCount(1, $events);
        $this->assertInstanceOf(InvitationRevoked::class, $events[0]);
        $this->assertSame($adminId->value(), $events[0]->revokedBy());

        // Revoking already revoked is idempotent
        $invitation->revoke($adminId, $revokeTime);
        $this->assertEmpty($invitation->releaseEvents());
    }

    public function test_cannot_revoke_accepted_invitation(): void
    {
        $invitation = $this->createPendingInvitation();
        $invitation->accept(UserId::generate()->value());

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Nie można cofnąć zaproszenia');

        $invitation->revoke(UserId::generate());
    }

    public function test_token_renewal_for_pending_or_expired_invitation(): void
    {
        $creation = new DateTimeImmutable('2026-07-01 10:00:00');
        $invitation = $this->createPendingInvitation($creation);

        $newNow = new DateTimeImmutable('2026-07-05 10:00:00');
        $newToken = Token::generate(48, $newNow);

        $invitation->renewToken($newToken);

        $this->assertTrue($invitation->isPending($newNow));
        $this->assertSame($newToken->value(), $invitation->token()->value());
        $this->assertSame('2026-07-07 10:00:00', $invitation->token()->expiresAt()->format('Y-m-d H:i:s'));
    }

    public function test_cannot_renew_token_for_accepted_or_revoked_invitation(): void
    {
        $acceptedInvitation = $this->createPendingInvitation();
        $acceptedInvitation->accept(UserId::generate()->value());

        $newToken = Token::generate();

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Nie można odnowić tokenu dla zaakceptowanego zaproszenia');
        $acceptedInvitation->renewToken($newToken);
    }

    private function createPendingInvitation(?DateTimeImmutable $now = null): Invitation
    {
        $invitation = Invitation::create(
            id: InvitationId::generate(),
            email: Email::fromString('pending.user@clientcorp.com'),
            role: Role::client(),
            invitedBy: UserId::generate(),
            companyId: self::COMPANY_A,
            now: $now
        );

        $invitation->releaseEvents(); // clear initial event

        return $invitation;
    }
}
