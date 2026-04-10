import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function RealTimePatientQueue() {
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await axios.get(`/api/patients/radiology-queue?date=${today}`);
        setPatients(response.data.data);
      } catch (error) {
        console.error('Error fetching patients:', error);
      }
    };

    fetchPatients();

    const intervalId = setInterval(fetchPatients, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const getStatusVariant = (status) => {
    const statusMap = {
      '1': 'Menunggu',
      '2': 'Proses',
      '3': 'Selesai'
    };
    
    const displayStatus = statusMap[status] || status;
    
    switch (displayStatus) {
      case 'Selesai':
        return 'bg-green-100 text-green-800';
      case 'Proses':
        return 'bg-blue-100 text-blue-800';
      case 'Menunggu':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="mt-8 bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Daftar Antrian Hari Ini</h2>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>Umur</TableHead>
              <TableHead>Jenis Kelamin</TableHead>
              <TableHead>Dokter</TableHead>
              <TableHead>Tipe Pemeriksaan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Waktu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients && patients.map((patient, index) => (
              <TableRow key={`${patient.patient_id}-${index}`} className="hover:bg-gray-50">
                <TableCell>{index + 1}</TableCell>
                <TableCell className="font-medium">{patient.patient_name}</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell>{patient.exam_type}</TableCell>
                <TableCell>
                  <Badge className={getStatusVariant(patient.status)}>
                    {patient.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(patient.visit_date)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
