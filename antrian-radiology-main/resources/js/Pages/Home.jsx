import React from 'react';
import { Head } from '@inertiajs/react';

export default function Home() {
    return (
        <div className="min-h-screen bg-gray-100">
            <Head title="Home" />
            <div className="container mx-auto px-4 py-12">
                <h1 className="text-3xl font-bold text-center mb-12">Selamat Datang di Sistem Antrian Radiologi</h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Dashboard Card */}
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold mb-6">Dashboard</h2>
                            <button 
                                onClick={() => window.open(route('dashboard'), '_blank')}
                                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-300 cursor-pointer"
                            >
                                Buka Dashboard
                            </button>
                        </div>
                    </div>

                    {/* Panggilan Pasien Card */}
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                        <div className="p-6">
                            <h2 className="text-xl font-semibold mb-6">Panggilan Pasien</h2>
                            <button 
                                onClick={() => window.open(route('admin.patient-calls.index'), '_blank')}
                                className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-300 cursor-pointer"
                            >
                                Buka Panggilan
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}