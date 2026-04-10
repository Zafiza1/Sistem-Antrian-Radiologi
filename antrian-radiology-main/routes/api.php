<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\PatientRadiologyController;
use App\Http\Controllers\PatientCountController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Patient routes
Route::prefix('patients')->group(function () {
    // Get radiology patients (supports date parameter: ?date=YYYY-MM-DD)
    Route::get('/queue', [PatientRadiologyController::class, 'getPatients']);
    
    // Alias for backward compatibility
    Route::get('/examinations', [PatientRadiologyController::class, 'getPatients']);
    
    // Get patient counts
    Route::get('/counts', [PatientCountController::class, 'getCounts']);
});

// Alias routes for backward compatibility
Route::get('/patient-queue', [PatientRadiologyController::class, 'getPatients']);
Route::get('/radiology-patients', [PatientRadiologyController::class, 'getPatients']);

// Broadcast routes
Route::post('/broadcast/patient-called', [\App\Http\Controllers\Api\BroadcastController::class, 'patientCalled'])
    ->middleware('auth:sanctum');

// Video routes
Route::prefix('videos')->group(function () {
    // Get all video URLs
    Route::get('/urls', [\App\Http\Controllers\Api\VideoController::class, 'getVideoUrls']);
    
    // Upload videos (handles one or both videos)
    Route::post('/upload', [\App\Http\Controllers\Api\VideoController::class, 'uploadVideos']);
    
    // Stream video by number (1 or 2)
    Route::get('/stream/{videoNumber}', [\App\Http\Controllers\Api\VideoController::class, 'streamVideo'])
        ->where('videoNumber', '[1-2]');
    
    // Clear video cache
    Route::delete('/cache/{videoNumber}', [\App\Http\Controllers\Api\VideoController::class, 'clearCache'])
        ->where('videoNumber', '[1-2]');
    
    // Legacy routes (for backward compatibility)
    Route::get('/url', [\App\Http\Controllers\Api\VideoController::class, 'getVideoUrl']);
    Route::post('/url', [\App\Http\Controllers\Api\VideoController::class, 'updateVideoUrl']);
});