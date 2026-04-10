<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PatientRadiologyController extends Controller
{
    /**
     * Get radiology patients with their examinations
     * 
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getPatients(Request $request)
    {
        try {
            try {
                DB::connection('sqlsrv')->getPdo();
                Log::info('Successfully connected to the database.');
                
                $tables = DB::connection('sqlsrv')
                    ->select("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
                Log::info('Available tables:', ['tables' => $tables]);
                
            } catch (\Exception $e) {
                Log::error('Database connection error: ' . $e->getMessage());
                throw $e;
            }
            $today = now()->format('Y-m-d');
            $startDate = $today . ' 00:00:00';
            $endDate = $today . ' 23:59:59';

            Log::info('Querying patients with date range:', [
                'start_date' => $startDate,
                'end_date' => $endDate
            ]);

            // Get patients with their examinations
            $query = DB::connection('sqlsrv')
                ->table('TT_PASIENRAD as pr')
                ->join('TR_HASILRAD as hr', 'hr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->join('TT_PEMERIKSAANRADIOLOGI as tpr', 'tpr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->join('TT_KUNJUNGAN as tk', 'tk.ID_REGISTRASI', '=', 'pr.ID_REGISTRASI')
                ->join('TM_PASIEN as tp', 'tp.ID_PASIEN', '=', 'tk.ID_PASIEN')
                ->whereBetween('pr.D_TGLDATANG', [$startDate, $endDate])
                ->select([
                    'tp.V_NAMAPASIEN as patient_name',
                    'tp.ID_PASIEN as patient_id',
                    'tpr.V_NMPEMERIKSAANRAD as examination_name',
                    'hr.C_BACA as read_status',
                    'pr.D_TGLDATANG as arrival_date',
                    'pr.ID_PASIENRAD as radiology_id',
                    'tk.ID_REGISTRASI as registration_id'
                ])
                ->distinct()
                ->orderBy('pr.D_TGLDATANG', 'asc');

            if (config('app.debug')) {
                Log::debug('Radiology query:', [
                    'sql' => $query->toSql(),
                    'bindings' => $query->getBindings(),
                    'date_range' => [$startDate, $endDate]
                ]);
            }

            $patients = $query->get();

            Log::info('SQL Query:', [
                'sql' => $query->toSql(),
                'bindings' => $query->getBindings(),
                'count' => $patients->count()
            ]);

            if ($patients->isNotEmpty()) {
                Log::info('First patient record:', (array)$patients->first());
            }

            $patientsArray = $patients->map(function($item) {
                return (array)$item;
            })->toArray();

            return response()->json([
                'success' => true,
                'data' => $patientsArray,
                'count' => count($patientsArray),
                'date_range' => [
                    'start' => $startDate,
                    'end' => $endDate
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching radiology patients: ' . $e->getMessage(), [
                'exception' => $e,
                'trace' => config('app.debug') ? $e->getTraceAsString() : null
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch radiology patients',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }
}
