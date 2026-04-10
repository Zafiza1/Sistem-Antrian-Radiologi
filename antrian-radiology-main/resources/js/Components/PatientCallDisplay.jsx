import React, { useState, useEffect } from 'react';
import Pusher from 'pusher-js';
import PatientCountCards from './PatientCountCards';

// Helper function to format unit for speech synthesis
const formatUnitForSpeechSimple = (unit) => {
  if (!unit) return '';
  // Convert to string in case it's not already
  const unitStr = String(unit);
  const unitLower = unitStr.toLowerCase().trim();

  // Check for specific units that need special formatting
  if (unitLower === 'igd') {
    return 'I G D'; // Spell out for speech synthesis
  }
  
  // Handle all variations of RI (RI, RI -RUANG, RI-RUANG, etc.)
  if (unitLower.startsWith('ri')) {
    const restOfUnit = unitStr.substring(2).trim();
    return `R I${restOfUnit ? ' ' + restOfUnit : ''}`;
  }

  return unitStr; // Return as is for other units
};

export default function PatientCallDisplay() {
  const [current, setCurrent] = useState(null);
  const [selectedExamination, setSelectedExamination] = useState('');
  const [counts, setCounts] = useState({
    totalAll: 0,
    totalInProcess: 0,
    totalProcessed: 0
  });

  useEffect(() => {
    // Initialize Pusher with simpler config
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_APP_KEY, {
      cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER,
      forceTLS: true,
      encrypted: true,
      disableStats: true,
    });

    console.log('Initializing Pusher with key:', import.meta.env.VITE_PUSHER_APP_KEY);

    // Subscribe to the public channel
    const channel = pusher.subscribe('public-patient-calls');
    
    channel.bind('pusher:subscription_succeeded', () => {
      console.log('Successfully subscribed to public-patient-calls channel');
    });

    channel.bind('pusher:subscription_error', (status) => {
      console.error('Failed to subscribe to channel:', status);
    });

    const handlePatientCalled = (data) => {
      // Handle both direct data and nested data from broadcast
      const patientData = data.data || data;
      
      // Update state with the selected examination
      const currentData = patientData.current || {};
      
      // Gunakan examination_name jika ada, jika tidak gunakan examination_names
      let examName = currentData.examination_name || 
                    (Array.isArray(currentData.examination_names) 
                      ? currentData.examination_names[0] 
                      : currentData.examination_names);
      
      // Pastikan kita hanya mengambil satu pemeriksaan (sebelum titik koma jika ada)
      if (typeof examName === 'string' && examName.includes(';')) {
        examName = examName.split(';')[0].trim();
      }
      
      setCurrent({
        ...currentData,
        // Pastikan examination_name selalu ada dan hanya satu pemeriksaan
        examination_name: examName
      });
      
      // Update selectedExamination
      if (examName) {
        setSelectedExamination(examName);
      } else {
        setSelectedExamination('Tidak ada data pemeriksaan');
      }
      
      // Speak the patient's name when called
      const currentPatient = patientData.current || {};
      if (currentPatient.patient_name) {
        const unit = currentPatient.unit || 'pemeriksaan';
        const destination = examName || 'pemeriksaan';
        
        // Determine room based on examination type
        let room = 'X-RAY'; // Default room
        const examUpper = destination.toUpperCase();
        
        if (examUpper.includes('USG') || examUpper.includes('ULTRASONOGRAPHY')) {
          room = 'USG';
        } else if (examUpper.includes('CT') || examUpper.includes('TOMOGRAPHY')) {
          room = 'CT SCAN';
        } else if (examUpper.includes('ABUS')) {
          room = 'ABUS';
        } else if (examUpper.includes('MAMMO')) {
          room = 'MAMMOGRAPHY';
        }
        
        // Format the unit for speech (don't convert to lowercase to preserve I - G - D formatting)
        const formattedUnit = formatUnitForSpeechSimple(unit);
        const message = `Kepada pasien atas nama ${currentPatient.patient_name?.toLowerCase()}, dari ruang ${formattedUnit}, mohon menuju ruang ${room}`;
        console.log('Speaking:', message);
        speak(message);
      }
    };

    // Listen for client events (direct from other clients)
    channel.bind('client-patient-called', handlePatientCalled);
    
    // Listen for server broadcast events
    channel.bind('patient.called', handlePatientCalled);
    
    // Also listen to the full event name for compatibility
    channel.bind('App\\Events\\PatientCalled', handlePatientCalled);
    
    // Log connection status
    pusher.connection.bind('connected', () => {
      console.log('Pusher connected successfully');
    });
    
    pusher.connection.bind('error', (err) => {
      console.error('Pusher connection error:', err);
    });

    // Initial fetch
    fetch('/view-patient')
      .then(response => response.json())
      .then(data => {
        console.log('Raw API response:', data);
        
        if (data.current) {
          // Log all properties of the current patient
          console.log('Current patient data:', data.current);
          console.log('All available fields in current patient:', Object.keys(data.current));
          
          // Check if the data is nested in a 'data' property
          const patientData = data.current.data || data.current;
          
          // Log the examination name from all possible field names
          console.log('Examination name (examination_name):', patientData.examination_name);
          console.log('Examination name (V_NMPEMERIKSAANRAD):', patientData.V_NMPEMERIKSAANRAD);
          
          // Log all data for inspection
          console.log('Complete patient data:', JSON.stringify(patientData, null, 2));
          
          // Set the state with the properly structured data
          setCurrent(patientData);
        } else {
          setCurrent(null);
        }
      })
      .catch(error => console.error('Error fetching initial patient data:', error));

    // Cleanup function
    return () => {
      if (channel) {
        channel.unbind_all();
        pusher.unsubscribe('public-patient-calls');
      }
      pusher.disconnect();
    };
  }, []);

  // Fetch patient counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await fetch('/api/patients/counts');
        const data = await response.json();
        
        if (data.success && data.data) {
          setCounts({
            totalAll: data.data.total_all || 0,
            totalInProcess: data.data.total_in_process || 0,
            totalProcessed: data.data.total_processed || 0
          });
        } else {
          console.error('Error in response:', data.message || 'Unknown error');
          // Set default values if the request fails
          setCounts({
            totalAll: 0,
            totalInProcess: 0,
            totalProcessed: 0
          });
        }
      } catch (error) {
        console.error('Error fetching patient counts:', error);
        // Set default values if there's an error
        setCounts({
          totalAll: 0,
          totalInProcess: 0,
          totalProcessed: 0
        });
      }
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}

      const speech = new SpeechSynthesisUtterance();
      speech.text = text;
      speech.lang = 'id-ID';
      window.speechSynthesis.speak(speech);
    }
  };


  // Log current data whenever it changes
  useEffect(() => {
    // Debug logging removed
  }, [current]);

  return (
    <div className="w-full h-[550px] rounded-2xl overflow-hidden bg-white shadow-lg flex flex-col">
      <div className={`
  rounded-t-2xl p-6 text-center transition-all duration-500
  ${current
    ? 'bg-gradient-to-r from-blue-700 to-blue-900 text-white'
    : 'bg-blue-50 text-blue-800'}
`}>
        <h2 className="text-2xl font-semibold">SEDANG DIPANGGIL</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-between p-6 bg-white">
        <div className="w-full text-center pt-1">
          {current ? (
            <div className="mb-4">
              <div className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-wide mb-6">
                {current.patient_name}
              </div>
              <div className="text-xl md:text-2xl text-gray-700 mb-3 md:mb-4">
                {selectedExamination && `Pemeriksaan: ${selectedExamination}`}
              </div>
              <div className="text-lg md:text-xl text-gray-700 mb-2">
                {current.unit && `Unit: ${current.unit}`}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-xl md:text-2xl text-gray-400">Tidak ada pasien yang sedang dipanggil</p>
            </div>
          )}
        </div>
        
        <div className="w-full mb-3">
          <PatientCountCards 
            totalAll={counts.totalAll}
            totalInProcess={counts.totalInProcess}
            totalProcessed={counts.totalProcessed}
          />
        </div>
      </div>
    </div>
  );
}
