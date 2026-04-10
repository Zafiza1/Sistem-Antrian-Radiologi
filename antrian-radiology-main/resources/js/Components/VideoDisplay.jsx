import React, { useState, useRef, useEffect } from 'react';

export default function VideoDisplay({ videoUrl, onEnded }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoUrl) return;
    setIsLoading(true);
    setHasError(false);

    const video = videoRef.current;
    if (!video) return;

    const handleLoadedData = () => {
      setIsLoading(false);
      setHasError(false);
    };

    const handleError = (e) => {
      console.error('Error loading video:', e);
      setIsLoading(false);
      setHasError(true);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);

    // Coba muat ulang video
    video.load();

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl]);

  // Tentukan tipe video berdasarkan ekstensi
  const getVideoType = (url) => {
    if (!url) return '';
    const extension = url.split('.').pop().toLowerCase();
    return `video/${extension === 'webm' ? 'webm' : 'mp4'}`;
  };

  if (!videoUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white rounded-2xl shadow-lg">
        <div className="text-center p-6">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500">Tidak ada video yang tersedia</p>
          <p className="text-sm text-gray-400 mt-2">Silakan periksa koneksi atau pengaturan video</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-full flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-red-500 font-medium mb-2">Gagal memuat video</p>
            <p className="text-sm text-gray-500 mb-4">URL: {videoUrl}</p>
            <button 
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="flex-1 relative bg-black rounded-2xl overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 z-10 rounded-2xl">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
              <p className="text-gray-300">Memuat video...</p>
            </div>
          </div>
        )}
        <div className="w-full h-full rounded-2xl overflow-hidden">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${isLoading ? 'invisible' : 'visible'} rounded-2xl`}
            autoPlay
            muted
            playsInline
            onEnded={onEnded}
          >
            <source src={videoUrl} type={getVideoType(videoUrl)} />
            Browser Anda tidak mendukung pemutaran video.
          </video>
        </div>
      </div>
    </div>
  );
}
