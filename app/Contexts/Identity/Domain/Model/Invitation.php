<?php

declare(strict_types=1);

namespace App\Contexts\Identity\Domain\Model;

use App\Contexts\Identity\Domain\Entities\Invitation as DomainInvitation;

/**
 * Class alias / specialized wrapper for Invitation Aggregate within the Identity Domain Model.
 */
class_alias(DomainInvitation::class, 'App\Contexts\Identity\Domain\Model\Invitation');
