<?php

namespace App\Http\Controllers;

use App\Events\PatientCalled;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ViewPatientRadiology extends Controller
{
    public function index()
    {
        $patients = DB::connection('sqlsrv')
            ->table('TR_HASILRAD as hr')
            ->join('TT_PASIENRAD as pr', 'pr.ID_PASIENRAD', '=', 'hr.ID_PASIENRAD')
            ->join('TT_PEMERIKSAANRADIOLOGI as tpr', 'tpr.ID_PASIENRAD', '=', 'hr.ID_PASIENRAD')
            ->join('TT_KUNJUNGAN as tk', 'tk.ID_REGISTRASI', '=', 'pr.ID_REGISTRASI')
            ->join('TM_PASIEN as tp', 'tp.ID_PASIEN', '=', 'tk.ID_PASIEN')
            ->where('hr.C_BACA', 0)
            ->whereBetween('pr.D_TGLDATANG', ['2025-03-25 00:00:00', '2025-03-25 23:59:59'])
            ->orderBy('pr.D_TGLDATANG', 'asc')
            ->select([
                'hr.ID_TRHASILRAD as id',
                'tp.V_NAMAPASIEN as patient_name',
                'tpr.V_NMPEMERIKSAANRAD as examination_name',
                'hr.C_BACA as read_status',
                'pr.D_TGLDATANG as arrival_date',
                'pr.V_unit as unit',
            ])
            ->get();

        $current = null;
        $next = null;

        if ($patients->count() > 0) {
            $current = $patients->shift();
            
            if ($patients->count() > 0) {
                $next = $patients->shift();
            }

            DB::connection('sqlsrv')
                ->table('TR_HASILRAD')
                ->where('ID_TRHASILRAD', $current->id)
                ->update(['C_BACA' => 1]);
        }

        // Broadcast the event
        broadcast(new PatientCalled($current, $next));

        return response()->json([
            'current' => $current,
            'next' => $next
        ]);
    }
}
