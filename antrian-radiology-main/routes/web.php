<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Admin\PatientCallController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use App\Http\Controllers\ViewPatientRadiology;

Route::get('/', function () {
    return Inertia::render('Home');
})->name('home');

Route::get('/dashboard', function () {
    return Inertia::render('dashboard/page');
})->name('dashboard');

Route::prefix('profile')->group(function () {
    Route::get('/', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::get('/view-patient', [ViewPatientRadiology::class, 'index'])->name('view.patient');

Route::get('/admin/patient-calls', [PatientCallController::class, 'index'])
    ->name('admin.patient-calls.index');

Route::post('/admin/patients/call', [PatientCallController::class, 'callPatient'])
    ->name('admin.patients.call');

Route::post('/admin/patients/end-call', [PatientCallController::class, 'endCall'])
    ->name('admin.patients.end-call');

Route::delete('/admin/patients/{id}', [PatientCallController::class, 'removePatient'])
    ->name('admin.patients.remove');

Route::get('/admin/ruang-radiology', [PatientCallController::class, 'getRuangRadiology'])
    ->name('admin.ruang-radiology');

Route::post('/admin/patients/broadcast', [PatientCallController::class, 'broadcastPatientCall'])
    ->name('admin.patients.call.broadcast');

Route::get('/video-settings', function () {
    return Inertia::render('VideoSettingsPage');
})->name('video.settings');
Route::get('/home', function () {
    return Inertia::render('Home');
})->name('home');