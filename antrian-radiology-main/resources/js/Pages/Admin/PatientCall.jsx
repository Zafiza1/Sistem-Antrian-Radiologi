import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import Pusher from 'pusher-js';
import axios from 'axios';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, Search, Clock } from 'lucide-react';

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

// Keys for localStorage
const PATIENT_QUEUE_KEY = 'patient_queue';
const CURRENT_PATIENT_KEY = 'current_patient';
const CACHE_TIMESTAMP_KEY = 'patient_cache_timestamp';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes cache expiry

const getPatientUniqueId = (patient) => {
  return `${patient.registration_id || patient.ID_REGISTRASI || 'no-reg'}-${patient.arrival_date || 'no-date'}`;
};

const normalizePatient = (patient) => {
  const normalized = {
    ...patient,
    id: patient.id || patient.radiology_id || `temp-${Date.now()}`,
    patient_name: patient.patient_name || patient.V_NAMAPASIEN || 'Nama tidak tersedia',
    registration_id: patient.registration_id || patient.ID_REGISTRASI || `REG-${Date.now()}`,
    examination_list: Array.isArray(patient.examination_list)
      ? patient.examination_list
      : patient.examination_names
        ? patient.examination_names.split(';').map(e => e.trim()).filter(Boolean)
        : [],
    unit: patient.unit || patient.v_unit || 'pemeriksaan',
    arrival_date: patient.arrival_date || patient.D_TGLDATANG || new Date().toISOString(),
  };
  
  // Add a consistent unique ID
  normalized._uniqueId = getPatientUniqueId(normalized);
  return normalized;
};



export default function PatientCall({ auth, patients = [], currentPatient = null }) {
  const groupPatients = (patientsList) => {
    const result = [];
    
    patientsList.forEach((patient) => {
      const key = patient.registration_id || `temp-${patient.id}`;
      
      // Process examination names from the API response
      let examination_list = [];
      if (patient.examination_names) {
        examination_list = patient.examination_names
          .split(';')
          .map(e => e.trim())
          .filter(Boolean);
      } else if (patient.examination_list && Array.isArray(patient.examination_list)) {
        examination_list = [...patient.examination_list];
      }
      
      // If no examinations, add a single entry with empty examination
      if (examination_list.length === 0) {
        result.push({
          ...patient,
          id: patient.id || patient.radiology_id,
          examination_list: [],
          examination_name: '',
          patient_name: patient.patient_name || 'Nama tidak tersedia',
          registration_id: patient.registration_id || `REG-${Date.now()}`,
          arrival_date: patient.arrival_date || new Date().toISOString(),
          unit: patient.unit || 'pemeriksaan',
          _uniqueId: `${key}-0`,
          status: 'menunggu',
          isFirst: true,
          isLast: true
        });
        return;
      }
      
      // Sort examinations by name
      const sortedExams = [...new Set(examination_list)].sort();
      
      // Create one row per examination
      sortedExams.forEach((exam, index) => {
        result.push({
          ...patient,
          id: patient.id || patient.radiology_id,
          examination_list: sortedExams,
          examination_name: exam,
          examination_names: sortedExams.join('; '),
          patient_name: patient.patient_name || 'Nama tidak tersedia',
          registration_id: patient.registration_id || `REG-${Date.now()}`,
          arrival_date: patient.arrival_date || new Date().toISOString(),
          unit: patient.unit || 'pemeriksaan',
          _uniqueId: `${key}-${index}`,
          status: 'menunggu',
          isFirst: index === 0,
          isLast: index === sortedExams.length - 1
        });
      });
    });
    
    return result;
  };

  // State for tracking new patients
  const [newPatients, setNewPatients] = useState([]);
  const patientListRef = useRef([]);
  
  // Initialize state with fresh data from props
  const [patientList, setPatientList] = useState(() => {
    try {
      // Always use fresh data from props as the source of truth
      const initialPatients = groupPatients(patients);
      patientListRef.current = initialPatients;
      
      // Clear any old queue data from localStorage
      localStorage.removeItem(PATIENT_QUEUE_KEY);
      
      return initialPatients;
    } catch (e) {
      console.error('Error initializing patient queue:', e);
      const initialPatients = groupPatients(patients);
      patientListRef.current = initialPatients;
      return initialPatients;
    }
  });
  
  // Function to fetch latest patient data with cache control
  const fetchPatientData = useCallback(async () => {
    try {
      const now = Date.now();
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      const useCache = cachedTimestamp && (now - parseInt(cachedTimestamp) < CACHE_EXPIRY_MS);
      
      let response;
      
      if (!useCache) {
        // Fetch fresh data with cache-busting
        response = await axios.get('/api/patients/queue', {
          params: { _t: now },
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        // Update cache timestamp
        localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
      } else {
        // Use cached data from props
        response = { data: patients };
      }
      
      if (response.data && Array.isArray(response.data)) {
        // Process and normalize the patient data
        const processedPatients = response.data.map(normalizePatient);
        const currentPatients = groupPatients(processedPatients);
        
        // Get current patient from localStorage if exists
        const currentPatientData = JSON.parse(localStorage.getItem(CURRENT_PATIENT_KEY) || 'null');
        
        // Filter out the current patient using consistent ID comparison
        const filteredPatients = currentPatientData
          ? currentPatients.filter(p => 
              p.registration_id !== currentPatientData.registration_id &&
              p.arrival_date !== currentPatientData.arrival_date
            )
          : currentPatients;
        
        // Find new patients that weren't in the previous list
        const newPatients = filteredPatients.filter(newP => 
          !patientListRef.current.some(oldP => 
            getPatientUniqueId(oldP) === getPatientUniqueId(newP)
          )
        );
        
        if (newPatients.length > 0) {
          setNewPatients(prev => [...newPatients, ...prev].slice(0, 5));
          
          // Remove the new patient highlight after 5 seconds
          setTimeout(() => {
            setNewPatients(prev => 
              prev.filter(p => !newPatients.some(np => 
                getPatientUniqueId(np) === getPatientUniqueId(p)
              ))
            );
          }, 5000);
        }
        
        // Update the patient list reference and state
        patientListRef.current = filteredPatients;
        setPatientList(filteredPatients);
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      // Fallback to props if API fails
      const initialPatients = groupPatients(patients);
      patientListRef.current = initialPatients;
      setPatientList(initialPatients);
    }
  }, [patients]);
  
  // Set up data fetching on component mount
  useEffect(() => {
    // Clean up any old cache on mount
    const cleanupOldCache = () => {
      localStorage.removeItem(PATIENT_QUEUE_KEY);
    };
    
    cleanupOldCache();
    
    // Initial fetch
    fetchPatientData();
    
    // Set up polling every 10 seconds
    const intervalId = setInterval(fetchPatientData, 10000);
    
    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, []); // Empty dependency array to run only on mount
  
  // Initialize current patient from localStorage or props
  const [current, setCurrent] = useState(() => {
    try {
      const savedCurrent = localStorage.getItem(CURRENT_PATIENT_KEY);
      if (savedCurrent) {
        return JSON.parse(savedCurrent);
      }
      return currentPatient ? normalizePatient(currentPatient) : null;
    } catch (e) {
      console.error('Error loading current patient:', e);
      return currentPatient || null;
    }
  });
  const [loadingCall, setLoadingCall] = useState(false);
  const [loadingEnd, setLoadingEnd] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [callingPatientId, setCallingPatientId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const tableRef = useRef(null);
  // State for real-time clock with initial value
  const [currentTime, setCurrentTime] = useState(new Date());

  // Initialize states with default values
  // Removed redundant initialization since we're now initializing with proper defaults

  // Update current time every second and handle new patient highlights
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      
      // Rotate new patients highlight
      setNewPatients(prev => {
        if (prev.length > 0) {
          return [...prev.slice(1), prev[0]];
        }
        return prev;
      });
      
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const [filters, setFilters] = useState({
    unit: null,
    destination: null,
    room: null
  });
  
  const [searchInput, setSearchInput] = useState({
    unit: '',
    destination: '',
    room: ''
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Initialize pagination state
  useEffect(() => {
    setCurrentPage(1);
  }, []);
  const patientsPerPage = 15;

  const handleRowClick = (patient) => {
    // Handle the row click event here
    // For example, you might want to select the patient or navigate to a detail view
    console.log('Patient clicked:', patient);
    // If you have a state to track the selected patient, you can update it here
    // setSelectedPatient(patient);
  };

  // Add new patient highlight effect
  useEffect(() => {
    if (newPatients.length > 0) {
      const timer = setTimeout(() => {
        setNewPatients(prev => prev.slice(1));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [newPatients]);
  
  // Memoize filtered patients to prevent unnecessary re-renders
  
  // Function to determine room based on examination type
  const getRoomForExamination = (examination) => {
    if (!examination) return null;
    const examUpper = examination.toUpperCase();
    
    if (examUpper.includes('USG') || examUpper.includes('ULTRASONOGRAPHY')) {
      return 'USG';
    } else if (examUpper.includes('CT') || examUpper.includes('TOMOGRAPHY')) {
      return 'CT SCAN';
    } else if (examUpper.includes('ABUS')) {
      return 'ABUS';
    }
    return 'X-RAY';
  };

  const filteredPatients = useMemo(() => {
    // Helper function to safely compare strings with case insensitivity
    const matchesFilter = (value, filter) => {
      if (!filter) return true;
      if (!value) return false;
      return String(value).toLowerCase().includes(String(filter).toLowerCase());
    };

    // Helper function to check if any examination matches the filter
    const anyExamMatches = (exams, filter) => {
      if (!filter) return true;
      if (!exams || !exams.length) return false;
      const filterLower = String(filter).toLowerCase();
      return exams.some(exam => exam && String(exam).toLowerCase().includes(filterLower));
    };

    return patientList
      .filter(patient => {
        if (!patient) return false;
        
        // Search term filter - check name, ID, or any examination
        const searchTermLower = searchTerm?.toLowerCase() || '';
        const matchesSearch = !searchTerm || 
          (patient.patient_name && patient.patient_name.toLowerCase().includes(searchTermLower)) ||
          (patient.registration_id && patient.registration_id.toLowerCase().includes(searchTermLower)) ||
          (patient.examination_list && patient.examination_list.some(exam => 
            exam && String(exam).toLowerCase().includes(searchTermLower)
          ));
        
        // Unit filter - case insensitive comparison
        const matchesUnit = !filters.unit || 
          (patient.unit && patient.unit.toLowerCase().includes(filters.unit.toLowerCase()));
        
        // Destination filter - check if any examination matches
        const matchesDestination = !filters.destination || 
          (patient.examination_list && patient.examination_list.some(exam => 
            exam && String(exam).toLowerCase().includes(filters.destination.toLowerCase())
          ));
        
        // Room filter - map examination to room and check
        const matchesRoom = !filters.room || 
          (patient.examination_list && patient.examination_list.some(exam => {
            if (!exam) return false;
            const room = getRoomForExamination(exam);
            return room && room.toLowerCase() === filters.room.toLowerCase();
          }));
        
        return matchesSearch && matchesUnit && matchesDestination && matchesRoom;
      })
      .map(patient => ({
        ...patient,
        isNew: newPatients.some(np => np.id === patient.id)
      }));
  }, [patientList, searchTerm, filters, newPatients]);

  // Get current patients for pagination
  const indexOfLastPatient = currentPage * patientsPerPage;
  const indexOfFirstPatient = indexOfLastPatient - patientsPerPage;
  const currentPatients = filteredPatients.slice(indexOfFirstPatient, indexOfLastPatient);
  const totalPages = Math.ceil(filteredPatients.length / patientsPerPage);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm]);

  const queuedAnnouncementsRef = useRef([]);
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  
  // Only save to localStorage on user interaction, not on initial load
  const saveToLocalStorage = useCallback((list) => {
    try {
      localStorage.setItem(PATIENT_QUEUE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Error saving queue to localStorage:', e);
    }
  }, []);
  
  // Handle currentPatient changes
  useEffect(() => {
    if (currentPatient) {
      const normalized = normalizePatient(currentPatient);

      setCurrent(normalized);

      setPatientList(prev =>
        prev.filter(p => p.id !== normalized.id)
      );

      localStorage.setItem(
        CURRENT_PATIENT_KEY,
        JSON.stringify(normalized)
      );
    }
  }, [currentPatient]);

  // Save patient list to localStorage whenever it changes
  useEffect(() => {
    if (patientList && patientList.length > 0) {
      try {
        // Only save essential data to prevent issues
        const simplifiedList = patientList.map(patient => ({
          id: patient.id,
          patient_name: patient.patient_name,
          registration_id: patient.registration_id,
          examination_names: patient.examination_names,
          examination_list: patient.examination_list || [],
          unit: patient.unit,
          arrival_date: patient.arrival_date,
          _uniqueId: patient._uniqueId || `patient-${patient.id}`
        }));
        
        localStorage.setItem(PATIENT_QUEUE_KEY, JSON.stringify(simplifiedList));
      } catch (e) {
        console.error('Error saving patient queue to localStorage:', e);
      }
    }
  }, [patientList]);

  const removePatientFromList = useCallback((id) => {
    setPatientList(prev => {
      const updated = prev.filter(p => p.id !== id);
      // Don't group here to preserve the exact structure
      return updated;
    });
  }, []);

  const removePatientWithRollback = useCallback((id) => {
    let removed = null;
    setPatientList(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx === -1) return prev;
      removed = prev[idx];
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
    return () => {
      if (!removed) return;
      setPatientList(prev => {
        if (prev.some(p => p.id === removed.id)) return prev;
        return [removed, ...prev];
      });
    };
  }, []);

  const voicesRef = useRef([]);
  const loadVoices = useCallback(() => {
    // Speech synthesis disabled
    console.log('Speech synthesis is disabled');
    voicesRef.current = [];
  }, []);

  const speak = useCallback(async (text, opts = {}) => {
    // Speech synthesis disabled
    console.log('Speech synthesis is disabled. Would have spoken:', text);
    return Promise.resolve();
  }, []);

  const speakIfAllowed = useCallback((text, opts = {}) => {
    // Speech synthesis disabled
    console.log('Speech synthesis is disabled. Would have spoken (if allowed):', text);
    return Promise.resolve();
  }, []);

  const flushQueuedAnnouncements = useCallback(() => {
    const q = queuedAnnouncementsRef.current.splice(0);
    q.forEach(item => {
      try {
        speak(item.text, item.opts);
      } catch (e) {
        console.error('Failed to play queued announcement', e);
      }
    });
  }, [speak]);

  // Handle user interaction for speech synthesis
  useEffect(() => {
    const onFirstInteraction = () => {
      console.log('First user interaction detected');
      setUserInteracted(true);
      loadVoices();
      setTimeout(() => flushQueuedAnnouncements(), 150);
      document.removeEventListener('click', onFirstInteraction);
      document.removeEventListener('keydown', onFirstInteraction);
      document.removeEventListener('touchstart', onFirstInteraction);
    };

    document.addEventListener('click', onFirstInteraction, { passive: true });
    document.addEventListener('keydown', onFirstInteraction, { passive: true });
    document.addEventListener('touchstart', onFirstInteraction, { passive: true });

    // Speech synthesis initialization disabled
    console.log('Speech synthesis initialization skipped');

    return () => {
      try {
        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('keydown', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
      } catch (e) {}
    };
  }, [loadVoices, flushQueuedAnnouncements]);

useEffect(() => {
  const key = import.meta.env.VITE_PUSHER_APP_KEY;
  const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER;

  if (!key) {
    console.warn('VITE_PUSHER_APP_KEY tidak ada, realtime mati');
    return;
  }

  if (pusherRef.current) return;

  const pusher = new Pusher(key, {
    cluster,
    forceTLS: true,
  });

  pusherRef.current = pusher;

  const channel = pusher.subscribe('public-patient-calls');
  channelRef.current = channel;

  const handlePatientCalled = (data) => {
    console.log('[PUSHER] PatientCalled:', data);

    const currentPatient = data?.current ?? null;
    const nextPatient = data?.next ?? null;

    if (currentPatient) {
      setCurrent(currentPatient);

      setPatientList(prev =>
        prev.filter(p => p.id !== currentPatient.id)
      );
    } else {
      setCurrent(null);
    }

    }; channel.bind('App\\Events\\PatientCalled', handlePatientCalled);
    channel.bind('patient.called', handlePatientCalled); // optional legacy

    pusher.connection.bind('error', err => {
      console.error('[PUSHER] error:', err);
    });

    console.log('[PUSHER] connected');
  pusher.connection.bind('error', err => {
    console.error('[PUSHER] error:', err);
  });

  console.log('[PUSHER] connected');

  return () => {
    try {
      channel.unbind_all();
      pusher.unsubscribe('public-patient-calls');
      pusher.disconnect();
      pusherRef.current = null;
      channelRef.current = null;
    } catch (e) {
      console.error('[PUSHER] cleanup error', e);
    }
  };
}, []);

  const callPatient = useCallback(async (patient, examination) => {
    // Prevent multiple simultaneous calls
    if (isCallInProgress) {
      console.log('Pemanggilan sedang berlangsung, mohon tunggu...');
      return;
    }
    
    console.log('=== MEMULAI PEMANGGILAN PASIEN ===');
    console.log('Pasien:', patient.patient_name);
    console.log('Pemeriksaan:', examination);
    
    // Set calling state
    setIsCallInProgress(true);
    setCallingPatientId(patient.id);
    
    // Disable interactions during call
    document.body.style.pointerEvents = 'none';
    
    const unit = patient.unit || 'pemeriksaan';
    const destination = examination ? examination.trim() : 'pemeriksaan';
    
    try {
      // Get examination result ID
      const resultId = patient.result_ids ? patient.result_ids.split(',')[0] : null;
      
      if (!resultId) {
        throw new Error('Tidak dapat menemukan ID hasil pemeriksaan untuk pasien ini');
      }
      
      // Dapatkan ID hasil pemeriksaan (ID_TRHASILRAD)
      console.log('Menggunakan ID hasil pemeriksaan:', resultId);
      
      // Format unit to always be uppercase like examType
      const formattedUnit = unit ? unit.toUpperCase() : 'RADIOLOGY';

      // Panggil endpoint dengan data yang benar
      const response = await axios.post(route('admin.patients.call'), {
        patient_id: resultId,
        patient_name: patient.name || 'Nama Pasien',
        unit: formattedUnit || 'Radiology',
        destination: destination,
        registration_id: patient.registration_id || null,
        examination_names: destination
      });

      console.log('Response dari server:', response.data);

      // Update current patient state dengan data terbaru
      setCurrent({
        ...patient,
        // Pastikan examination_name dan examination_names sama dengan yang dipilih
        examination_name: destination,
        examination_names: destination
      });
      
      // Send event to Pusher
      if (pusherRef.current) {
        try {
          const channel = pusherRef.current.channel('public-patient-calls');
          if (channel) {
            // Buat data yang akan dikirim
            const eventData = {
              current: {
                ...patient,
                unit: unit,
                examination_name: destination, // Gunakan destination yang sudah dihitung di atas
                examination_names: destination, // Gunakan destination yang sama
                examination_list: patient.examination_list || []
              },
              next: patientList.length > 0 ? patientList[0] : null
            };
            
            console.log('=== Mengirim data ke PatientCallDisplay ===');
            console.log('Data yang dikirim:', JSON.parse(JSON.stringify(eventData)));
            console.log('Pemeriksaan yang dipilih:', destination);
            
            console.log('Triggering patient-called event with data:', eventData);
            
            // Also send via HTTP as a fallback
            try {
              // Get CSRF token for the request
              const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
              // Prepare the data in the format expected by the backend
              const requestData = {
                patient_id: eventData.current.id || resultId,
                patient_name: eventData.current.name || 'Nama Pasien',
                unit: eventData.current.unit || 'Radiology',
                destination: eventData.current.examination_name || destination,
                registration_id: eventData.current.registration_id || null,
                examination_names: eventData.current.examination_names || destination
              };

              const response = await axios.post(route('admin.patients.call'), requestData, {
                headers: {
                  'X-CSRF-TOKEN': csrfToken,
                  'X-Requested-With': 'XMLHttpRequest',
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                }
              });
              console.log('Broadcast successful:', response.data);
            } catch (error) {
              console.error('Error broadcasting patient call:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
              });
            }
          } else {
            console.error('Channel public-patient-calls is not available');
          }
        } catch (err) {
          console.error('Error sending event:', err);
        }
      }
      
      // Determine the room based on examination type (X-RAY, USG, CT SCAN, etc.)
      const examType = examination 
        ? (() => {
            const exam = examination.toUpperCase();
            if (exam.includes('USG')) return 'USG';
            if (exam.includes('CT')) return 'CT SCAN';
            if (exam.includes('ABUS')) return 'ABUS';
            // For all other examinations, return as-is
            return examination || 'pemeriksaan';
          })()
        : 'pemeriksaan';
      
      // Format unit for speech
      const speechUnit = formatUnitForSpeechSimple(unit);
      
      // Debug log the unit processing
      console.log('Original unit:', unit);
      console.log('Formatted unit for speech:', speechUnit);
        
      // Debug log the final speech unit
      console.log('Final speechUnit:', speechUnit);
      
      // Log the patient call instead of speaking
      console.log(`Patient called: ${patient.patient_name}, from: ${speechUnit}, to: ${examType}`);
      
    } catch (err) {
      console.error('❌ Call patient error:', err);
      alert('Gagal memanggil pasien. Silakan coba lagi.');
    } finally {
      // Re-enable interactions
      document.body.style.pointerEvents = 'auto';
      
      // Reset calling state after a delay to prevent rapid successive calls
      setTimeout(() => {
        setIsCallInProgress(false);
        setCallingPatientId(null);
        console.log('✅ Tombol pemanggilan sudah aktif kembali');
        // Force UI update
        setPatientList(prev => [...prev]);
      }, 10000); // 7 second cooldown
      
      console.log('Call states reset - ready for next call');
    }
  }, [isCallInProgress, setPatientList]);

  const endCall = async () => {
    if (!current) return;
    if (!confirm('Akhiri panggilan saat ini?')) return;

    setLoadingEnd(true);

    try {
      await axios.post(route('admin.patients.end-call'), { patient_id: current?.id ?? null });
      setCurrent(null);
    } catch (err) {
      console.error('End call error', err);
    } finally {
      setLoadingEnd(false);
    }
  };

  // Get unique units and destinations from patient list
  const getUniqueValues = (key) => {
    const values = new Set();
    patientList.forEach(patient => {
      if (key === 'examination_list' && patient.examination_list) {
        patient.examination_list.forEach(exam => values.add(exam));
      } else if (patient[key]) {
        values.add(patient[key]);
      }
    });
    return Array.from(values).sort();
  };

  const units = getUniqueValues('unit');
  const destinations = getUniqueValues('examination_list');

  const clearFilters = () => {
    setFilters({
      unit: null,
      destination: null,
      room: null
    });
    setSearchInput({
      unit: '',
      destination: '',
      room: ''
    });
  };

  const removePatient = async (patient) => {
    if (!confirm(`Yakin ingin menghapus ${patient.patient_name} dari antrian?`)) {
      return;
    }
    
    const rollback = removePatientWithRollback(patient.id);
    try {
      await axios.delete(route('admin.patients.remove', patient.id));
    } catch (err) {
      console.error('Failed to remove patient:', err);
      rollback();
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <Head title="Panggilan Pasien Radiologi" />

      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Panggilan Pasien Radiologi</h2>
              <div className="text-sm text-gray-500">
                {new Date().toLocaleString('id-ID', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false 
                }).replace('pukul', '')}
              </div>
            </div>

            <div className="text-sm text-gray-500 flex items-center">
              <span className="px-2.5 py-0.5 text-xs font-semibold text-white bg-blue-600 rounded-full">
                {patientList.length} Pasien
              </span>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-3 sm:px-4 border-b border-gray-200">
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="text-base font-medium text-gray-900">Daftar Antrian</h3>
                  <div className="w-full sm:w-64">
                    <div className="relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-3 py-2 sm:text-sm border border-gray-300 rounded-md"
                        placeholder="Cari nama atau ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">Filter:</span>
                    <div className="relative w-48">
                      <div className="relative">
                        <Select.Root 
                          value={filters.unit || 'all'} 
                          onValueChange={(value) => setFilters(prev => ({ ...prev, unit: value === 'all' ? null : value }))}
                        >
                          <Select.Trigger className="inline-flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
                            <Select.Value placeholder="Semua Unit" />
                            <Select.Icon className="ml-2">
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            </Select.Icon>
                          </Select.Trigger>
                          <Select.Portal>
                            <Select.Content 
                              className="overflow-hidden bg-white rounded-md shadow-lg border border-gray-200 z-50 w-[var(--radix-select-trigger-width)]"
                              position="popper"
                              sideOffset={5}
                              style={{
                                position: 'fixed',
                                zIndex: 1000,
                                maxHeight: '300px',
                                overflowY: 'auto'
                              }}
                            >
                              <div className="px-3 py-2 border-b border-gray-100">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                  <input
                                    type="text"
                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Cari unit..."
                                    value={searchInput.unit}
                                    onChange={(e) => setSearchInput(prev => ({ ...prev, unit: e.target.value }))}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              <Select.Viewport className="p-1 max-h-60 overflow-auto">
                                <Select.Item value="all" className="relative flex items-center px-8 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100 focus:bg-gray-100 cursor-pointer">
                                  <Select.ItemText>Semua Unit</Select.ItemText>
                                  <Select.ItemIndicator className="absolute left-2">
                                    <Check className="h-4 w-4 text-blue-500" />
                                  </Select.ItemIndicator>
                                </Select.Item>
                                {Array.from(new Set(patientList.map(p => p.unit).filter(Boolean)))
                                  .filter(unit => 
                                    !searchInput.unit || 
                                    unit.toLowerCase().includes(searchInput.unit.toLowerCase())
                                  )
                                  .sort()
                                  .map((unit) => (
                                    <Select.Item 
                                      key={unit} 
                                      value={unit}
                                      className="relative flex items-center px-8 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100 focus:bg-gray-100 cursor-pointer"
                                    >
                                      <Select.ItemText>{unit}</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-2">
                                        <Check className="h-4 w-4 text-blue-500" />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                  ))}
                              </Select.Viewport>
                            </Select.Content>
                          </Select.Portal>
                        </Select.Root>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="relative w-48">
                      <div className="relative">
                        <Select.Root 
                          value={filters.destination || 'all'} 
                          onValueChange={(value) => setFilters(prev => ({ ...prev, destination: value === 'all' ? null : value }))}
                        >
                          <Select.Trigger className="inline-flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
                            <Select.Value placeholder="Semua Pemeriksaan" />
                            <Select.Icon className="ml-2">
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            </Select.Icon>
                          </Select.Trigger>
                          <Select.Portal>
                            <Select.Content 
                              className="overflow-hidden bg-white rounded-md shadow-lg border border-gray-200 z-50 w-[var(--radix-select-trigger-width)]"
                              position="popper"
                              sideOffset={5}
                              style={{
                                position: 'fixed',
                                zIndex: 1000,
                                maxHeight: '300px',
                                overflowY: 'auto'
                              }}
                            >
                              <div className="px-3 py-2 border-b border-gray-100">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                  <input
                                    type="text"
                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Cari pemeriksaan..."
                                    value={searchInput.destination}
                                    onChange={(e) => setSearchInput(prev => ({ ...prev, destination: e.target.value }))}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              <Select.Viewport className="p-1 max-h-60 overflow-auto">
                                <Select.Item value="all" className="relative flex items-center px-8 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100 focus:bg-gray-100 cursor-pointer">
                                  <Select.ItemText>Semua Pemeriksaan</Select.ItemText>
                                  <Select.ItemIndicator className="absolute left-2">
                                    <Check className="h-4 w-4 text-blue-500" />
                                  </Select.ItemIndicator>
                                </Select.Item>
                                {Array.from(new Set(patientList.flatMap(p => p.examination_list || [])))
                                  .filter(dest => 
                                    !searchInput.destination || 
                                    dest.toLowerCase().includes(searchInput.destination.toLowerCase())
                                  )
                                  .sort()
                                  .map((dest) => (
                                    <Select.Item 
                                      key={dest} 
                                      value={dest}
                                      className="relative flex items-center px-8 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100 focus:bg-gray-100 cursor-pointer"
                                    >
                                      <Select.ItemText className="truncate">{dest}</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-2">
                                        <Check className="h-4 w-4 text-blue-500" />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                  ))}
                              </Select.Viewport>
                            </Select.Content>
                          </Select.Portal>
                        </Select.Root>
                      </div>
                    </div>
                    
                    {/* Room Filter */}
                    <div className="relative w-40">
                      <div className="relative">
                        <Select.Root 
                          value={filters.room || 'all'} 
                          onValueChange={(value) => setFilters(prev => ({ ...prev, room: value === 'all' ? null : value }))}
                        >
                          <Select.Trigger className="inline-flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white">
                            <Select.Value placeholder="Pilih Ruangan" />
                            <Select.Icon className="ml-2">
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            </Select.Icon>
                          </Select.Trigger>
                          <Select.Portal>
                            <Select.Content 
                              className="overflow-hidden bg-white rounded-md shadow-lg border border-gray-200 z-50 w-[var(--radix-select-trigger-width)]"
                              position="popper"
                              sideOffset={5}
                              style={{
                                position: 'fixed',
                                zIndex: 1000,
                                maxHeight: '300px',
                                overflowY: 'auto'
                              }}
                            >
                              <div className="px-3 py-2 border-b border-gray-100">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                                  <input
                                    type="text"
                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Cari ruangan..."
                                    value={searchInput.room}
                                    onChange={(e) => setSearchInput(prev => ({ ...prev, room: e.target.value }))}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              <Select.Viewport className="p-1 max-h-60 overflow-auto">
                                <Select.Item value="all" className="relative flex items-center px-8 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100 focus:bg-gray-100 cursor-pointer">
                                  <Select.ItemText>Semua Ruangan</Select.ItemText>
                                  <Select.ItemIndicator className="absolute left-2">
                                    <Check className="h-4 w-4 text-blue-500" />
                                  </Select.ItemIndicator>
                                </Select.Item>
                                {['X-RAY', 'USG', 'CT SCAN', 'ABUS']
                                  .filter(room => 
                                    !searchInput.room || 
                                    room.toLowerCase().includes(searchInput.room.toLowerCase())
                                  )
                                  .map((room) => (
                                    <Select.Item 
                                      key={room} 
                                      value={room}
                                      className="relative flex items-center px-8 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100 focus:bg-gray-100 cursor-pointer"
                                    >
                                      <Select.ItemText>{room}</Select.ItemText>
                                      <Select.ItemIndicator className="absolute left-2">
                                        <Check className="h-4 w-4 text-blue-500" />
                                      </Select.ItemIndicator>
                                    </Select.Item>
                                  ))}
                              </Select.Viewport>
                            </Select.Content>
                          </Select.Portal>
                        </Select.Root>
                      </div>
                    </div>
                    
                    {(filters.unit || filters.destination || filters.room) && (
                      <button
                        onClick={clearFilters}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Reset Filter
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>

            <div className="overflow-x-auto text-xs">
              <div className="text-xs text-gray-500 mb-2">
                Menampilkan {Math.min(indexOfFirstPatient + 1, filteredPatients.length)}-{Math.min(indexOfLastPatient, filteredPatients.length)} dari {filteredPatients.length} pasien
              </div>
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-12 px-2 py-2 text-center text-gray-500">No</th>
                    <th className="w-48 px-3 py-2 text-left text-gray-500">Nama</th>
                    <th className="w-48 px-3 py-2 text-center text-gray-500">Pemeriksaan</th>
                    <th className="w-36 px-3 py-2 text-center text-gray-500">Waktu</th>
                    <th className="w-40 px-3 py-2 text-center text-gray-500">Ruang Pemeriksaan</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentPatients.length > 0 ? (
                    currentPatients.map((patient, index) => (
                      <React.Fragment key={`patient-${patient.id}-${index}`}>
                        {patient.examination_list && patient.examination_list.length > 0 ? (
                          patient.examination_list.map((exam, examIndex) => (
                            <tr 
                              key={`${patient._uniqueId}-exam-${examIndex}`}
                              className={`hover:bg-gray-50 transition-colors duration-200 ${
                                current?.id === patient.id 
                                  ? 'bg-blue-50' 
                                  : patient.isNew && examIndex === 0
                                    ? 'animate-pulse bg-green-50 border-l-4 border-green-500'
                                    : ''
                              }`}
                              onClick={() => handleRowClick(patient)}
                            >
                              {examIndex === 0 ? (
                                <td 
                                  rowSpan={patient.examination_list.length} 
                                  className="px-2 py-2 whitespace-nowrap text-center text-gray-900 align-top"
                                >
                                  {indexOfFirstPatient + index + 1}
                                </td>
                              ) : null}
                              {examIndex === 0 ? (
                                <td 
                                  rowSpan={patient.examination_list.length} 
                                  className="px-3 py-2 align-top"
                                >
                                  <div className="truncate">
                                    <div className="font-medium text-gray-900">{patient.patient_name}</div>
                                    <div className="text-2xs text-gray-500">ID: {patient.registration_id}</div>
                                  </div>
                                </td>
                              ) : null}
                              <td className="px-1 py-1">
                                <div className="flex justify-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      callPatient(patient, exam);
                                    }}
                                    disabled={isCallInProgress}
                                    className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium transition-colors duration-200 ${
                                      isCallInProgress
                                        ? callingPatientId === patient.id
                                          ? 'bg-yellow-500 cursor-wait'
                                          : 'bg-gray-400 cursor-not-allowed opacity-75'
                                        : 'bg-blue-800 hover:bg-blue-900 cursor-pointer'
                                    } text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                                    title={
                                      isCallInProgress
                                        ? callingPatientId === patient.id
                                          ? 'Sedang memproses panggilan...'
                                          : 'Tunggu hingga panggilan selesai'
                                        : `Panggil ${patient.patient_name} untuk pemeriksaan ${exam}`
                                    }
                                  >
                                    {isCallInProgress && callingPatientId === patient.id ? 'Memproses...' : exam}
                                    {isCallInProgress && callingPatientId === patient.id && (
                                      <svg className="ml-2 h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </td>
                              {examIndex === 0 ? (
                                <td 
                                  rowSpan={patient.examination_list.length} 
                                  className="px-3 py-2 whitespace-nowrap text-gray-500 text-center align-top"
                                >
                                  {patient.arrival_date
                                    ? new Date(patient.arrival_date).toLocaleString('id-ID', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false
                                      }).replace('pukul', '')
                                    : 'Belum ada waktu'}
                                </td>
                              ) : null}
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex justify-center">
                                  <span 
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                                  >
                                    {getRoomForExamination(exam) || 'Umum'}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr 
                            key={`${patient._uniqueId}-no-exam`}
                            className="hover:bg-gray-50 transition-colors duration-200"
                            onClick={() => handleRowClick(patient)}
                          >
                            <td className="px-2 py-2 whitespace-nowrap text-center text-gray-900">
                              {indexOfFirstPatient + index + 1}
                            </td>
                            <td className="px-3 py-2">
                              <div className="truncate">
                                <div className="font-medium text-gray-900">{patient.patient_name}</div>
                                <div className="text-2xs text-gray-500">ID: {patient.registration_id}</div>
                              </div>
                            </td>
                            <td className="px-1 py-1 text-center text-gray-500">
                              Tidak ada pemeriksaan
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-500 text-center">
                              {patient.arrival_date
                                ? new Date(patient.arrival_date).toLocaleString('id-ID', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  }).replace('pukul', '')
                                : 'Belum ada waktu'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center text-gray-500">
                              -
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr key="no-patients">
                      <td colSpan="5" className="px-4 py-6 text-center">
                        <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada antrian</h3>
                        <p className="mt-1 text-xs text-gray-500">Tidak ada pasien yang menunggu</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {filteredPatients.length > patientsPerPage && (
              <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
                <div className="flex justify-between flex-1 sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md ${
                      currentPage === 1 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium rounded-md ${
                      currentPage === totalPages 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Selanjutnya
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Menampilkan <span className="font-medium">{Math.min(indexOfFirstPatient + 1, filteredPatients.length)}</span> sampai{' '}
                      <span className="font-medium">{Math.min(indexOfLastPatient, filteredPatients.length)}</span> dari{' '}
                      <span className="font-medium">{filteredPatients.length}</span> pasien
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-2 py-2 rounded-l-md border ${
                          currentPage === 1 
                            ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed' 
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <span className="sr-only">First</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M8.707 5.293a1 1 0 010 1.414L5.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-2 py-2 border ${
                          currentPage === 1 
                            ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed' 
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <span className="sr-only">Previous</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        // Show pages around current page
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border ${
                              currentPage === pageNum
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center px-2 py-2 border ${
                          currentPage === totalPages 
                            ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed' 
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <span className="sr-only">Next</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center px-2 py-2 rounded-r-md border ${
                          currentPage === totalPages 
                            ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed' 
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <span className="sr-only">Last</span>
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          <path fillRule="evenodd" d="M11.293 14.707a1 1 0 010-1.414L14.586 10l-3.293-3.293a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
