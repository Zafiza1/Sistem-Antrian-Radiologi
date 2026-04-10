import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import PatientQueue from '@/Components/PatientQueue';
import PatientCallDisplay from '@/Components/PatientCallDisplay';
import VideoDisplay from '@/Components/VideoDisplay';
import axios from 'axios';

export default function DashboardPage() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const stats = [];
  const [video1Url, setVideo1Url] = useState('');
  const [video2Url, setVideo2Url] = useState('');
  const [videos, setVideos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch video URL on component mount
  useEffect(() => {
    const fetchVideoUrl = async () => {
      setIsLoading(true);
      try {
        console.log('Fetching video URL...');
        const response = await axios.get('/api/videos/urls');
        console.log('Video URL response:', response.data);
        
        // Get video URL from the nested videos object
        const video1 = response.data?.videos?.video1Url || '';
        const video2 = response.data?.videos?.video2Url || '';
        setVideo1Url(video1);
        setVideo2Url(video2);
        
        // Set videos array for the carousel
        const videoUrls = [];
        if (video1) videoUrls.push(video1);
        if (video2) videoUrls.push(video2);
        setVideos(videoUrls);
        
        if (video1 || video2) {
          console.log('Video URLs set:', { video1, video2 });
        } else {
          console.warn('No video URLs found in response:', response.data);
        }
      } catch (error) {
        console.error('Error fetching video URL:', error);
        setVideoUrl('');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideoUrl();
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white py-4 px-2 relative">
        <div className="w-full mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Antrian Radiologi</h1>
          <div className="flex items-center space-x-4">
            <div className="text-xl">
              {format(currentTime, 'EEEE, d MMMM yyyy', { locale: id })}
            </div>
            <div className="text-xl font-bold text-white">
              {format(currentTime, 'HH:mm:ss')}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-1 pt-3 pb-3">
        <div className="space-y-4">
          {stats.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <CardTitle className="text-2xl font-bold">{stat.value}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-sm ${
                      stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change} {stat.trend === 'up' ? '↑' : '↓'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Video and Call Display */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* Video Display */}
              <div className="xl:col-span-6 h-[550px] w-full rounded-2xl overflow-hidden bg-black">
                {isLoading ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-black">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                    <p className="text-gray-400">Memuat video...</p>
                  </div>
                ) : videos.length > 0 ? (
                  <VideoDisplay
                    videoUrl={videos[currentIndex]}
                    onEnded={() =>
                      setCurrentIndex((i) => (i + 1) % videos.length)
                    }
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-black text-gray-400 p-4 text-center">
                    <svg className="w-12 h-12 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-lg font-medium">Tidak ada video yang tersedia</p>
                    <p className="text-sm mt-1">Silakan periksa koneksi atau pengaturan video</p>
                  </div>
                )}
              </div>

              {/* Patient Call Display */}
              <div className="xl:col-span-6 rounded-2xl">
                <PatientCallDisplay />
              </div>
            </div>
          </div>

          {/* Patient Queue */}
          <div className="mt-6">
            <PatientQueue />
          </div>
        </div>
      </main>
    </div>
  );
}