<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PatientCalled implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $current;
    public $next;

    public function __construct($current, $next)
    {
        $this->current = $current;
        $this->next   = $next;
    }

    public function broadcastOn()
    {
        return new Channel('public-patient-calls');
    }
    
    public function broadcastAs()
    {
        return 'patient.called';
    }
    
    public function broadcastWith()
    {
        return [
            'current' => $this->current,
            'next' => $this->next
        ];
    }
}
