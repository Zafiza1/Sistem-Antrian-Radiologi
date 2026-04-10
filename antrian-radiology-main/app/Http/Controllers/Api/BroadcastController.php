<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Pusher\Pusher;

class BroadcastController extends Controller
{
    public function patientCalled(Request $request)
    {
        $data = $request->validate([
            'current' => 'required|array',
            'next' => 'nullable|array',
        ]);

        // Broadcast the event
        broadcast(new \App\Events\PatientCalled($data['current'], $data['next'] ?? null))->toOthers();

        return response()->json(['status' => 'success']);
    }
}
