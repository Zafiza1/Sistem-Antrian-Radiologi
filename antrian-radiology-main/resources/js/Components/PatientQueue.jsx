import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const PatientQueue = () => {

    const PAGE_SIZE = 6;

    const [patients, setPatients] = useState([]);

    const [visibleInProcess, setVisibleInProcess] = useState([]);
    const [visibleProcessed, setVisibleProcessed] = useState([]);

    const inProcessRef = useRef([]);
    const processedRef = useRef([]);

    const fetchPatients = async () => {
        try {
            const response = await axios.get('/api/patients/queue');
            if (response.data?.success) {
                setPatients(response.data.data || []);
                console.log('Fetched patients:', response.data.data);
            } else {
                console.error('Unexpected response format:', response.data);
            }
        } catch (err) {
            console.error('Error fetching patients:', err);
        }
    };

    useEffect(() => {
        fetchPatients();
        const interval = setInterval(fetchPatients, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const processed = patients
            .filter(p => p.read_status === "1")
            .sort((a, b) => new Date(b.arrival_date) - new Date(a.arrival_date));

        const inProcess = patients
            .filter(p => p.read_status === "0")
            .sort((a, b) => new Date(b.arrival_date) - new Date(a.arrival_date));

        const syncList = (oldRef, newList) => {
            const key = p => `${p.patient_id}-${p.examination_name}-${p.arrival_date}`;

            const mapNew = new Map(newList.map(item => [key(item), item]));

            const preserved = oldRef
                .map(i => key(i))
                .filter(k => mapNew.has(k))
                .map(k => mapNew.get(k));

            const preservedKeys = new Set(preserved.map(i => key(i)));

            const appended = newList.filter(i => !preservedKeys.has(key(i)));

            return [...preserved, ...appended];
        };

        const syncedInProcess = syncList(inProcessRef.current, inProcess);
        const syncedProcessed = syncList(processedRef.current, processed);

        inProcessRef.current = syncedInProcess;
        processedRef.current = syncedProcessed;

        setVisibleInProcess(syncedInProcess.slice(0, PAGE_SIZE));
        setVisibleProcessed(syncedProcessed.slice(0, PAGE_SIZE));
    }, [patients]);

    useEffect(() => {
        const interval = setInterval(() => {

            if (inProcessRef.current.length > 0) {
                const list = [...inProcessRef.current];
                list.unshift(list.pop());
                inProcessRef.current = list;
                setVisibleInProcess(list.slice(0, PAGE_SIZE));
            }

            if (processedRef.current.length > 0) {
                const list = [...processedRef.current];
                list.unshift(list.pop());
                processedRef.current = list;
                setVisibleProcessed(list.slice(0, PAGE_SIZE));
            }

        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const renderTable = (data, fullList, title, variant) => (
        <div className="rounded-2xl border shadow-sm bg-white w-full h-full flex flex-col flex-1">
            <div className={`
                px-5 py-3 border-b
                ${variant === 'process'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-green-50 border-green-200'}
            `}>
                <h3 className={`
                    text-lg font-bold
                    ${variant === 'process'
                        ? 'text-amber-800'
                        : 'text-green-800'}
                `}>
                    {title}
                </h3>
            </div>

            <div className="overflow-auto flex-1">
                <table className="w-full table-fixed">
                    <colgroup>
                        <col className="w-12" />
                        <col className="w-2/5" />
                        <col className="w-1/2" />
                    </colgroup>
                    <thead className={`
  sticky top-0 z-10 shadow-sm
  ${variant === 'process'
    ? 'bg-amber-100 text-amber-900'
    : 'bg-green-100 text-green-900'}
`}>
                        <tr className="h-12">
                            <th className="px-2 py-3 text-sm font-semibold text-center">No</th>
                            <th className="px-3 py-3 text-sm font-semibold text-left">Nama Pasien</th>
                            <th className="px-3 py-3 text-sm font-semibold text-right">Pemeriksaan</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200">
                        {data.map((p) => {

                            const number = fullList.indexOf(p) + 1;
                            const uniqueKey = `${p.patient_id}-${p.examination_name}-${p.arrival_date}`;

                            return (
                                <tr
  key={uniqueKey}
  className={`
    h-12
    text-sm animate-slideRow
    ${variant === 'process'
      ? 'odd:bg-white even:bg-amber-50'
      : 'odd:bg-white even:bg-green-50'}
  `}
>
                                    <td className="px-2 py-3 text-center text-xl font-bold">{number}</td>
                                    <td className="px-3 py-3 text-left text-xl font-bold whitespace-nowrap">
                                        {p.patient_name}
                                    </td>
                                    <td className="px-3 py-3 text-right text-xl font-bold truncate" title={p.examination_name}>
                                        {p.examination_name}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

        </div>
    );

    const totalAll = patients.length;
    const totalInProcess = inProcessRef.current.length;
    const totalProcessed = processedRef.current.length;

    return (
        <div className="h-full flex flex-col">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-2 h-full gap-2 p-2">
                    {renderTable(visibleInProcess, inProcessRef.current, "Antrian Diproses", "process")}
                    {renderTable(visibleProcessed, processedRef.current, "Pasien Selesai", "processed")}
                </div>
            </div>
        </div>
    );
};

export default PatientQueue;
