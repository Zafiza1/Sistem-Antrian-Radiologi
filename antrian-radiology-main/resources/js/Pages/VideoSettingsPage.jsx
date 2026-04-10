import React, { useState, useEffect, useRef } from "react";
import { Head } from "@inertiajs/react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import VideoDisplay from "@/Components/VideoDisplay";
import axios from "axios";
import { Upload, X } from "lucide-react";

export default function VideoSettingsPage() {
  const [videos, setVideos] = useState([
    {
      id: 1,
      name: 'Video 1',
      file: null,
      previewUrl: '',
      savedUrl: '',
      fileInputRef: useRef(null)
    },
    {
      id: 2,
      name: 'Video 2',
      file: null,
      previewUrl: '',
      savedUrl: '',
      fileInputRef: useRef(null)
    }
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved videos on component mount
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await axios.get('/api/videos/urls');
        if (response.data && response.data.videos) {
          setVideos(prevVideos => 
            prevVideos.map(video => ({
              ...video,
              savedUrl: response.data.videos[`video${video.id}Url`] || ''
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching videos:', error);
        toast.error('Gagal memuat video');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const handleFileChange = (videoId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error('File harus berupa video');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 50MB');
      return;
    }

    setVideos(prevVideos => 
      prevVideos.map(video => 
        video.id === videoId 
          ? { ...video, file, previewUrl: URL.createObjectURL(file) }
          : video
      )
    );
  };

  const handleRemoveFile = (videoId) => {
    setVideos(prevVideos => 
      prevVideos.map(video => {
        if (video.id === videoId) {
          if (video.fileInputRef.current) {
            video.fileInputRef.current.value = '';
          }
          return { ...video, file: null, previewUrl: '' };
        }
        return video;
      })
    );
  };

  const handleSave = async () => {
    const hasNewVideo = videos.some(video => video.file);
    if (!hasNewVideo) {
      toast.error("Silakan pilih setidaknya satu video untuk diunggah");
      return;
    }
    
    try {
      setIsSaving(true);
      const formData = new FormData();
      let hasValidVideo = false;

      // Append all new video files to formData
      videos.forEach(video => {
        if (video.file) {
          formData.append(`video${video.id}`, video.file);
          hasValidVideo = true;
        }
      });

      if (!hasValidVideo) {
        toast.error("Tidak ada video yang valid untuk diunggah");
        return;
      }
      
      const response = await axios.post('/api/videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // Update saved URLs and clear file states
      setVideos(prevVideos => 
        prevVideos.map(video => ({
          ...video,
          file: null,
          savedUrl: response.data[`video${video.id}Url`] || video.savedUrl,
          previewUrl: ''
        }))
      );
      
      toast.success("Video berhasil diunggah");
    } catch (error) {
      console.error('Error saving videos:', error);
      toast.error(error.response?.data?.message || "Gagal mengunggah video");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <Head title="Pengaturan Video" />
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Unggah Video</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* File Upload Areas */}
          <div className="grid gap-6 md:grid-cols-2">
            {videos.map(video => (
              <div key={video.id} className="space-y-2">
                <h3 className="text-lg font-medium">{video.name}</h3>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    video.file ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-500'
                  }`}
                  onClick={() => video.fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={video.fileInputRef}
                    onChange={(e) => handleFileChange(video.id, e)}
                    accept="video/*"
                    className="hidden"
                  />
                  
                  {video.file ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center">
                        <div className="p-3 bg-green-100 rounded-full">
                          <Upload className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                      <p className="font-medium truncate">{video.file.name}</p>
                      <p className="text-sm text-gray-500">
                        {Math.round(video.file.size / 1024 / 1024)} MB
                      </p>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(video.id);
                        }}
                      >
                        <X className="h-4 w-4 mr-2" /> Hapus
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                        <Upload className="h-6 w-6 text-gray-500" />
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">
                          Klik untuk mengunggah {video.name.toLowerCase()}
                        </p>
                        <p className="text-gray-500">
                          Format: MP4, WebM, atau MOV (maks. 50MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={!videos.some(v => v.file) || isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? 'Mengunggah...' : 'Unggah Video'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Video Previews */}
      <div className="space-y-6 max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold mb-4">Pratinjau Video</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {videos.map(video => (
            <div key={video.id} className="space-y-2">
              <h3 className="font-medium">{video.name} {video.savedUrl && !video.previewUrl && '(Tersimpan)'}</h3>
              <div className="aspect-video w-full bg-gray-200 rounded-lg overflow-hidden">
                {video.previewUrl ? (
                  <VideoDisplay videoUrl={video.previewUrl} isYouTube={false} />
                ) : video.savedUrl ? (
                  <VideoDisplay videoUrl={video.savedUrl} isYouTube={false} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                    <p className="text-sm">Belum ada video yang diunggah</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
