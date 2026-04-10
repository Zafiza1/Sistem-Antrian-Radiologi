import React from 'react';

const CountCard = ({ title, value, variant }) => {

    const styles = {
        total: {
            bg: "bg-blue-600",
            title: "text-white",
            value: "text-white"
        },
        process: {
            bg: "bg-orange-500",
            title: "text-white",
            value: "text-white"
        },
        done: {
            bg: "bg-green-500",
            title: "text-white",
            value: "text-white"
        }
    };

    return (
        <div className={`
            px-4 py-4 rounded-lg shadow-sm h-24
            flex flex-col justify-center items-center
            ${styles[variant].bg}
        `}>
            <p className={`text-xl font-bold text-center mb-2 ${styles[variant].title}`}>
                {title}
            </p>
            <p className={`text-4xl font-black text-center mt-2 ${styles[variant].value}`}>
                {value}
            </p>
        </div>
    );
};

const PatientCountCards = ({ totalAll, totalInProcess, totalProcessed }) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <CountCard 
                        title="Total Pasien" 
                        value={totalAll} 
                        variant="total" 
                    />
                    <CountCard 
                        title="Pasien Dalam Proses" 
                        value={totalInProcess} 
                        variant="process"
                    />
                    <CountCard 
                        title="Pasien Selesai" 
                        value={totalProcessed} 
                        variant="done" 
                    />
                </div>
            </div>
        </div>
    );
};

export default PatientCountCards;
