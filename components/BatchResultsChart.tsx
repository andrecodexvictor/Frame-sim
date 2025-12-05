
import React from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, LineChart, Line
} from 'recharts';
import { BatchResult } from '../services/batchService';

interface BatchResultsChartProps {
    result: BatchResult;
}

export const BatchResultsChart: React.FC<BatchResultsChartProps> = ({ result }) => {

    // Data for Scatter Plot (ROI vs Adoption)
    const scatterData = result.outputs.map((o, i) => ({
        id: i + 1,
        roi: o.summary.totalRoi,
        adoption: o.summary.finalAdoption,
        validity: o.summary.scenarioValidity
    }));

    // Data for Histogram (Success vs Failure)
    const successCount = result.outputs.filter(o => o.summary.totalRoi > 0).length;
    const failureCount = result.outputs.length - successCount;
    const barData = [
        { name: 'Sucesso (ROI > 0)', count: successCount, fill: '#10B981' },
        { name: 'Prejuízo (ROI < 0)', count: failureCount, fill: '#EF4444' }
    ];

    // Data for Average Timeline
    // We need to aggregate the timelines of all runs
    const maxMonths = Math.max(...result.outputs.map(o => o.timeline.length));
    const timelineData = [];

    for (let m = 1; m <= maxMonths; m++) {
        const monthRuns = result.outputs
            .map(o => o.timeline.find(t => t.month === m))
            .filter(t => t !== undefined);

        if (monthRuns.length > 0) {
            const avgRoi = monthRuns.reduce((sum, t) => sum + t!.roi, 0) / monthRuns.length;
            const avgAdoption = monthRuns.reduce((sum, t) => sum + t!.adoptionRate, 0) / monthRuns.length;

            timelineData.push({
                month: m,
                avgRoi: parseFloat(avgRoi.toFixed(2)),
                avgAdoption: parseFloat(avgAdoption.toFixed(2))
            });
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">

            {/* Chart 1: Consistency Analysis (Scatter) */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Análise de Consistência (ROI x Adoção)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" dataKey="adoption" name="Adoção" unit="%" domain={[0, 100]} />
                            <YAxis type="number" dataKey="roi" name="ROI" unit="%" />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                            <Legend />
                            <Scatter name="Simulações" data={scatterData} fill="#8884d8" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    *Clusters indicam alta previsibilidade. Pontos dispersos indicam volatilidade do cenário.
                </p>
            </div>

            {/* Chart 2: Success Rate */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Taxa de Sucesso do Framework</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" name="Qtd. Simulações" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Chart 3: Average Evolution */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 col-span-1 lg:col-span-2">
                <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Evolução Média (Tendência Central)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timelineData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" label={{ value: 'Mês', position: 'insideBottomRight', offset: -5 }} />
                            <YAxis yAxisId="left" label={{ value: 'ROI Médio %', angle: -90, position: 'insideLeft' }} />
                            <YAxis yAxisId="right" orientation="right" label={{ value: 'Adoção Média %', angle: 90, position: 'insideRight' }} />
                            <Tooltip />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="avgRoi" stroke="#8884d8" activeDot={{ r: 8 }} name="ROI Médio" />
                            <Line yAxisId="right" type="monotone" dataKey="avgAdoption" stroke="#82ca9d" name="Adoção Média" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
};
