<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebSocketsApp extends Model
{
    protected $table = 'websockets_apps';
    
    protected $fillable = [
        'name',
        'key',
        'secret',
        'path',
        'enable_client_messages',
        'enable_statistics',
    ];
    
    protected $casts = [
        'enable_client_messages' => 'boolean',
        'enable_statistics' => 'boolean',
    ];
}
