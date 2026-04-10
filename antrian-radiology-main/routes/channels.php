<?php

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Log;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

Broadcast::channel('patient-calls', function ($user) {
    Log::info('Authorizing patient-calls channel');
    return true; // Izinkan semua koneksi
}, ['guards' => ['web', 'api']]);

// Channel untuk komunikasi client-to-client
Broadcast::channel('presence-patient-calls', function ($user) {
    if ($user) {
        return [
            'id' => $user->id,
            'name' => $user->name
        ];
    }
    return null;
}, ['guards' => ['web', 'api']]);
