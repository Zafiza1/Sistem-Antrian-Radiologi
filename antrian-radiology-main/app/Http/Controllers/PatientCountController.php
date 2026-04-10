<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;

class PatientCountController extends Controller
{
    public function getCounts()
    {
        try {
            $today = now()->format('Y-m-d');
            $startDate = $today . ' 00:00:00';
            $endDate = $today . ' 23:59:59';

            // Get all patients within the date range
            $patients = DB::connection('sqlsrv')
                ->table('TT_PASIENRAD as pr')
                ->join('TR_HASILRAD as hr', 'hr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->join('TT_PEMERIKSAANRADIOLOGI as tpr', 'tpr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->join('TT_KUNJUNGAN as tk', 'tk.ID_REGISTRASI', '=', 'pr.ID_REGISTRASI')
                ->join('TM_PASIEN as tp', 'tp.ID_PASIEN', '=', 'tk.ID_PASIEN')
                ->whereBetween('pr.D_TGLDATANG', [$startDate, $endDate])
                ->select([
                    'tp.ID_PASIEN as patient_id',
                    'tpr.V_NMPEMERIKSAANRAD as examination_name',
                    'hr.C_BACA as read_status',
                    'pr.D_TGLDATANG as arrival_date'
                ])
                ->distinct()
                ->get();

            // Calculate counts based on read_status
            $totalAll = $patients->count();
            $inProcessCount = $patients->where('read_status', '0')->count();
            $processedCount = $patients->where('read_status', '1')->count();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_all' => $totalAll,
                    'total_in_process' => $inProcessCount,
                    'total_processed' => $processedCount,
                    'last_updated' => now()->toDateTimeString()
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error in PatientCountController: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch patient counts',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }
}
