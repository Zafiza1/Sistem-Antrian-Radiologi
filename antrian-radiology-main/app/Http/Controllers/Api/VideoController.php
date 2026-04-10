<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\File;

class VideoController extends Controller
{
    const CACHE_KEY_PREFIX = 'video_';
    const STORAGE_DISK = 'public';
    const STORAGE_PATH = 'videos';

    /**
     * Get all video URLs
     */
    public function getVideoUrls()
    {
        $video1Url = $this->getVideoUrlFromCache(1);
        $video2Url = $this->getVideoUrlFromCache(2);

        return response()->json([
            'videos' => [
                'video1Url' => $video1Url ? url('storage/' . $video1Url) : '',
                'video2Url' => $video2Url ? url('storage/' . $video2Url) : ''
            ]
        ]);
    }

    /**
     * Upload videos
     */
    public function uploadVideos(Request $request)
{
    $request->validate([
        'video1' => 'nullable|file|mimetypes:video/mp4,video/webm,video/quicktime|max:51200',
        'video2' => 'nullable|file|mimetypes:video/mp4,video/webm,video/quicktime|max:51200',
    ]);

    $response = [];

    if ($request->hasFile('video1')) {
        $path = $this->handleVideoUpload($request->file('video1'), 1);
        $response['video1Url'] = url('storage/' . $path);
    }

    if ($request->hasFile('video2')) {
        $path = $this->handleVideoUpload($request->file('video2'), 2);
        $response['video2Url'] = url('storage/' . $path);
    }

    if (empty($response)) {
        return response()->json(['message' => 'Tidak ada video yang diunggah'], 400);
    }

    return response()->json($response);
}


    /**
     * Handle video file upload
     */
    private function handleVideoUpload($file, $videoNumber)
{
    // Delete old video
    $oldVideoPath = $this->getVideoUrlFromCache($videoNumber);
    if ($oldVideoPath && Storage::disk(self::STORAGE_DISK)->exists($oldVideoPath)) {
        Storage::disk(self::STORAGE_DISK)->delete($oldVideoPath);
    }

    // Store new video
    $path = $file->store(self::STORAGE_PATH, self::STORAGE_DISK);

    // Cache path
    $this->cacheVideoUrl($videoNumber, $path);

    return $path;
}


    /**
     * Stream video
     */
    /**
     * Stream video
     */
    public function streamVideo($videoNumber)
    {
        try {
            $videoPath = $this->getVideoUrlFromCache($videoNumber);
            
            if (!$videoPath || !Storage::disk(self::STORAGE_DISK)->exists($videoPath)) {
                abort(404, 'Video not found');
            }

            $filePath = Storage::disk(self::STORAGE_DISK)->path($videoPath);
            $fileSize = Storage::disk(self::STORAGE_DISK)->size($videoPath);
            
            // Use File facade to get MIME type
            $mimeType = File::mimeType($filePath);

            $headers = [
                'Content-Type' => $mimeType,
                'Content-Length' => $fileSize,
                'Accept-Ranges' => 'bytes',
                'Cache-Control' => 'public, max-age=31536000',
            ];

            return response()->file($filePath, $headers);
            
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Video streaming error: ' . $e->getMessage());
            abort(500, 'Error streaming video');
        }
    }

    /**
     * Get video URL from cache
     */
    private function getVideoUrlFromCache($videoNumber)
    {
        return Cache::get($this->getCacheKey($videoNumber), '');
    }

    /**
     * Cache video URL
     */
    private function cacheVideoUrl($videoNumber, $url)
    {
        Cache::forever($this->getCacheKey($videoNumber), $url);
    }

    /**
     * Get cache key for video
     */
    private function getCacheKey($videoNumber)
    {
        return self::CACHE_KEY_PREFIX . $videoNumber;
    }

    /**
     * Clear video cache
     */
    public function clearCache($videoNumber)
    {
        Cache::forget($this->getCacheKey($videoNumber));
        return response()->json(['message' => 'Cache berhasil dihapus']);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
