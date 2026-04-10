<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    protected $connection = 'sqlsrv';
    protected $table = 'TM_PASIEN';
    protected $primaryKey = 'ID_PASIEN';
    public $timestamps = false;
    
    protected $fillable = [
        'V_NAMAPASIEN',
        'ID_PASIEN',
    ];
}
