<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('app:sync-exchange-rates')
    ->weekdays()
    ->at('08:30')
    ->timezone('Europe/Warsaw')
    ->withoutOverlapping()
    ->onOneServer()
    ->runInBackground();

Schedule::command('app:sync-exchange-rates')
    ->weekdays()
    ->at('12:30')
    ->timezone('Europe/Warsaw')
    ->withoutOverlapping()
    ->onOneServer()
    ->runInBackground();
