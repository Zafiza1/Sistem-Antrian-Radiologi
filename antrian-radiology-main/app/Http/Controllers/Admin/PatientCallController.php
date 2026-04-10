<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use App\Events\PatientCalled;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Illuminate\Http\JsonResponse;

class PatientCallController extends Controller
{
    public function index()
    {
        $patients = DB::connection('sqlsrv')
            ->table(function($query) {
                $query->select(
                    'tp.ID_PASIEN',
                    'tp.V_NAMAPASIEN',
                    'tk.ID_REGISTRASI',
                    'pr.D_TGLDATANG',
                    'pr.v_unit',
                    DB::raw('MIN(hr.ID_TRHASILRAD) as first_result_id'),
                    DB::raw('MIN(pr.ID_PASIENRAD) as radiology_id'),
                    DB::raw('STRING_AGG(tpr.V_NMPEMERIKSAANRAD, \'; \') as examination_names'),
                    DB::raw('STRING_AGG(CAST(hr.ID_TRHASILRAD AS VARCHAR), \',\') as result_ids')
                )
                ->from('TR_HASILRAD as hr')
                ->join('TT_PASIENRAD as pr', 'pr.ID_PASIENRAD', '=', 'hr.ID_PASIENRAD')
                ->join('TT_KUNJUNGAN as tk', 'tk.ID_REGISTRASI', '=', 'pr.ID_REGISTRASI')
                ->join('TM_PASIEN as tp', 'tp.ID_PASIEN', '=', 'tk.ID_PASIEN')
                ->leftJoin('TT_PEMERIKSAANRADIOLOGI as tpr', 'tpr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->where('hr.C_BACA', 0)
                ->whereDate('pr.D_TGLDATANG', now()->toDateString())
                ->groupBy('tp.ID_PASIEN', 'tp.V_NAMAPASIEN', 'tk.ID_REGISTRASI', 'pr.D_TGLDATANG', 'pr.v_unit');
            }, 'grouped_patients')
            ->select([
                'first_result_id as id',
                'V_NAMAPASIEN as patient_name',
                'ID_PASIEN as patient_id',
                'v_unit as unit',
                'examination_names',
                DB::raw('0 as read_status'),
                'D_TGLDATANG as arrival_date',
                'radiology_id',
                'ID_REGISTRASI as registration_id',
                'result_ids'
            ])
            ->orderBy('D_TGLDATANG', 'desc')
            ->get();

        $current = DB::connection('sqlsrv')
            ->table(function($query) {
                $query->select(
                    'tp.ID_PASIEN',
                    'tp.V_NAMAPASIEN',
                    'tk.ID_REGISTRASI',
                    'pr.D_TGLDATANG',
                    'pr.v_unit',
                    DB::raw('MIN(hr.ID_TRHASILRAD) as first_result_id'),
                    DB::raw('MIN(pr.ID_PASIENRAD) as radiology_id'),
                    DB::raw('STRING_AGG(tpr.V_NMPEMERIKSAANRAD, \'; \') as examination_names'),
                    DB::raw('STRING_AGG(CAST(hr.ID_TRHASILRAD AS VARCHAR), \',\') as result_ids')
                )
                ->from('TR_HASILRAD as hr')
                ->join('TT_PASIENRAD as pr', 'pr.ID_PASIENRAD', '=', 'hr.ID_PASIENRAD')
                ->join('TT_KUNJUNGAN as tk', 'tk.ID_REGISTRASI', '=', 'pr.ID_REGISTRASI')
                ->join('TM_PASIEN as tp', 'tp.ID_PASIEN', '=', 'tk.ID_PASIEN')
                ->leftJoin('TT_PEMERIKSAANRADIOLOGI as tpr', 'tpr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->where('hr.C_BACA', 1)
                ->whereDate('pr.D_TGLDATANG', now()->toDateString())
                ->groupBy('tp.ID_PASIEN', 'tp.V_NAMAPASIEN', 'tk.ID_REGISTRASI', 'pr.D_TGLDATANG', 'pr.v_unit');
            }, 'current_patient')
            ->select([
                'first_result_id as id',
                'V_NAMAPASIEN as patient_name',
                'ID_PASIEN as patient_id',
                'v_unit as unit',
                'examination_names',
                DB::raw('1 as read_status'),
                'D_TGLDATANG as arrival_date',
                'radiology_id',
                'ID_REGISTRASI as registration_id',
                'result_ids'
            ])
            ->orderBy('D_TGLDATANG', 'desc')
            ->first();

        return Inertia::render('Admin/PatientCall', [
            'patients' => $patients,
            'currentPatient' => $current
        ]);
    }

    public function callPatient(Request $request)
    {
        $request->validate([
            'patient_id' => 'required|exists:TR_HASILRAD,ID_TRHASILRAD',
            'examination' => 'nullable|string'
        ]);

        DB::connection('sqlsrv')->beginTransaction();

        try {
            DB::connection('sqlsrv')
                ->table('TR_HASILRAD')
                ->where('C_BACA', 1);

            DB::connection('sqlsrv')
                ->table('TR_HASILRAD')
                ->where('ID_TRHASILRAD', $request->patient_id);

            $patient = DB::connection('sqlsrv')
                ->table('TT_PASIENRAD as pr')
                ->join('TR_HASILRAD as hr', 'hr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->join('TT_KUNJUNGAN as tk', 'tk.ID_REGISTRASI', '=', 'pr.ID_REGISTRASI')
                ->join('TM_PASIEN as tp', 'tp.ID_PASIEN', '=', 'tk.ID_PASIEN')
                ->join('TT_PEMERIKSAANRADIOLOGI as tpr', 'tpr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->where('hr.ID_TRHASILRAD', $request->patient_id)
                ->groupBy(
                    'pr.ID_PASIENRAD',
                    'tp.V_NAMAPASIEN',
                    'tp.ID_PASIEN',
                    'pr.D_TGLDATANG',
                    'tk.ID_REGISTRASI',
                    'pr.v_unit'
                )
                ->select([
                    'pr.ID_PASIENRAD as radiology_id',
                    'tp.V_NAMAPASIEN as patient_name',
                    'tp.ID_PASIEN as patient_id',
                    'pr.D_TGLDATANG as arrival_date',
                    'tk.ID_REGISTRASI as registration_id',
                    'pr.v_unit as unit',
                    DB::raw('STRING_AGG(tpr.V_NMPEMERIKSAANRAD, \'; \') as examination_names'),
                    DB::raw('STRING_AGG(hr.ID_TRHASILRAD, \',\') as result_ids')
                ])
                ->first();

            // Tambahkan examination_name yang dipilih ke response
            if ($patient) {
                $patient->examination_name = $request->examination ?? $patient->examination_names;
                
                // Format unit for IGD and RI before broadcasting
                $unitLower = strtolower(trim($patient->unit));
                if ($unitLower === 'igd') {
                    $patient->unit = 'I G D';
                } elseif (str_starts_with($unitLower, 'ri')) {
                    $restOfUnit = substr($patient->unit, 2);
                    $patient->unit = 'R I' . ($restOfUnit ? ' ' . trim($restOfUnit) : '');
                }
            }

            $nextPatient = DB::connection('sqlsrv')
                ->table('TT_PASIENRAD as pr')
                ->join('TR_HASILRAD as hr', 'hr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->join('TT_KUNJUNGAN as tk', 'tk.ID_REGISTRASI', '=', 'pr.ID_REGISTRASI')
                ->join('TM_PASIEN as tp', 'tp.ID_PASIEN', '=', 'tk.ID_PASIEN')
                ->join('TT_PEMERIKSAANRADIOLOGI as tpr', 'tpr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
                ->where('hr.C_BACA', 0)
                ->whereDate('pr.D_TGLDATANG', now()->toDateString())
                ->groupBy(
                    'pr.ID_PASIENRAD',
                    'tp.V_NAMAPASIEN',
                    'tp.ID_PASIEN',
                    'pr.D_TGLDATANG',
                    'tk.ID_REGISTRASI',
                    'pr.v_unit'
                )
                ->select([
                    'pr.ID_PASIENRAD as radiology_id',
                    'tp.V_NAMAPASIEN as patient_name',
                    'tp.ID_PASIEN as patient_id',
                    'pr.D_TGLDATANG as arrival_date',
                    'tk.ID_REGISTRASI as registration_id',
                    'pr.v_unit as unit',
                    DB::raw('STRING_AGG(tpr.V_NMPEMERIKSAANRAD, \'; \') as examination_names'),
                    DB::raw('STRING_AGG(hr.ID_TRHASILRAD, \',\') as result_ids')
                ])
                ->orderBy('pr.D_TGLDATANG', 'asc')
                ->first();

            DB::connection('sqlsrv')->commit();

            broadcast(new PatientCalled($patient, $nextPatient))->toOthers();

            return response()->json(['success' => true]);

        } catch (\Exception $e) {
            DB::connection('sqlsrv')->rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

public function endCall()
{
    DB::connection('sqlsrv')->beginTransaction();

    try {
        // Cari pasien berikutnya yang belum dipanggil
        $nextPatient = DB::connection('sqlsrv')
            ->table('TT_PASIENRAD as pr')
            ->join('TR_HASILRAD as hr', 'hr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
            ->join('TT_KUNJUNGAN as tk', 'tk.ID_REGISTRASI', '=', 'pr.ID_REGISTRASI')
            ->join('TM_PASIEN as tp', 'tp.ID_PASIEN', '=', 'tk.ID_PASIEN')
            ->leftJoin('TT_PEMERIKSAANRADIOLOGI as tpr', 'tpr.ID_PASIENRAD', '=', 'pr.ID_PASIENRAD')
            ->where('hr.C_BACA', 0)
            ->whereBetween('pr.D_TGLDATANG', [now()->format('Y-m-d') . ' 00:00:00', now()->format('Y-m-d') . ' 23:59:59'])
            ->groupBy(
                'pr.ID_PASIENRAD',
                'tp.V_NAMAPASIEN',
                'tp.ID_PASIEN',
                'pr.D_TGLDATANG',
                'tk.ID_REGISTRASI',
                'pr.v_unit',
                'tpr.V_NMPEMERIKSAANRAD',
                'hr.ID_TRHASILRAD'
            )
            ->select([
                'pr.ID_PASIENRAD as radiology_id',
                'tp.V_NAMAPASIEN as patient_name',
                'tpr.V_NMPEMERIKSAANRAD as examination_names',
                'tp.ID_PASIEN as patient_id',
                'pr.D_TGLDATANG as arrival_date',
                'tk.ID_REGISTRASI as registration_id',
                'pr.v_unit as unit',
                'hr.ID_TRHASILRAD as result_id'
            ])
            ->orderBy('pr.D_TGLDATANG', 'asc')
            ->first();

        DB::connection('sqlsrv')->commit();

        // Format unit for IGD and RI before broadcasting
        if ($nextPatient) {
            $unitLower = strtolower(trim($nextPatient->unit));
            if ($unitLower === 'igd') {
                $nextPatient->unit = 'I G D';
            } elseif (str_starts_with($unitLower, 'ri')) {
                $restOfUnit = substr($nextPatient->unit, 2);
                $nextPatient->unit = 'R I' . ($restOfUnit ? ' ' . trim($restOfUnit) : '');
            }
        }

        // Broadcast the next patient to all connected clients
        broadcast(new PatientCalled(null, $nextPatient))->toOthers();

        return response()->json([
            'success' => true,
            'next_patient' => $nextPatient
        ]);

    } catch (\Exception $e) {
        DB::connection('sqlsrv')->rollBack();
        Log::error('Error in endCall: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Terjadi kesalahan saat mengakhiri panggilan: ' . $e->getMessage()
        ], 500);
    }
}

    public function removePatient($id)
    {
        DB::connection('sqlsrv')
            ->table('TR_HASILRAD')
            ->where('ID_TRHASILRAD', $id);

        return back()->with('success', 'Pasien berhasil dihapus dari antrian');
    }

    /**
     * Get radiology room data
     *
     * @return JsonResponse
     */
    /**
     * Broadcast patient call to all connected clients
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function broadcastPatientCall(Request $request)
    {
        try {
            $data = $request->validate([
                'patient_id' => 'required|string',
                'patient_name' => 'required|string',
                'unit' => 'required|string',
                'destination' => 'required|string',
                'group_name' => 'required|string',
                'registration_id' => 'nullable|string',
                'examination_names' => 'nullable|string',
            ]);

            // Format unit for IGD and RI before broadcasting
            $unitLower = strtolower(trim($data['unit']));
            if ($unitLower === 'igd') {
                $data['unit'] = 'I G D';
            } elseif (str_starts_with($unitLower, 'ri')) {
                $restOfUnit = substr($data['unit'], 2);
                $data['unit'] = 'R I' . ($restOfUnit ? ' ' . trim($restOfUnit) : '');
            }

            broadcast(new PatientCalled($data, null))->toOthers();

            return response()->json([
                'success' => true,
                'message' => 'Broadcast sent successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to broadcast patient call: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get radiology room data
     *
     * @return JsonResponse
     */
    // In app/Http/Controllers/Admin/PatientCallController.php
public function getRuangRadiology()
{
    try {
        $ruangRadiology = DB::connection('mysql_radiology')
            ->table('ruang_radiology')
            ->select('V_KDPEMERIKSAANRAD', 'V_NMGROUP')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $ruangRadiology
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Failed to fetch ruang_radiology data',
            'error' => $e->getMessage()
        ], 500);
    }
}
}
