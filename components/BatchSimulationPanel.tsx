
import React, { useState } from 'react';
import { SimulationConfig } from '../types';
import { runBatchSimulation, BatchResult, generateCSV } from '../services/batchService';
import { BatchResultsChart } from './BatchResultsChart';
import { Download, Play, AlertTriangle, CheckCircle } from 'lucide-react';

interface BatchSimulationPanelProps {
    config: SimulationConfig;
    onBack: () => void;
}

export const BatchSimulationPanel: React.FC<BatchSimulationPanelProps> = ({ config, onBack }) => {
    const [iterations, setIterations] = useState(10);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<BatchResult | null>(null);

    const handleRun = async () => {
        setIsRunning(true);
        setProgress(0);
        setResult(null);

        try {
            const batchResult = await runBatchSimulation(config, iterations, (completed) => {
                setProgress(completed);
            });
            setResult(batchResult);
        } catch (error) {
            console.error("Batch failed", error);
            alert("Erro na execução em lote.");
        } finally {
            setIsRunning(false);
        }
    };

    const handleDownload = () => {
        if (!result) return;
        const csv = generateCSV(result);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `validacao_tcc_${config.frameworks[0].name}_${new Date().getTime()}.csv`;
        a.click();
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black uppercase tracking-tighter">
                    Validação em Lote (TCC Evidence)
                </h2>
                <button
                    onClick={onBack}
                    className="text-sm underline hover:text-blue-500"
                >
                    Voltar para Configuração
                </button>
            </div>

            {/* Configuration Card */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-8">
                <div className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-bold mb-2">Número de Iterações (N)</label>
                        <input
                            type="number"
                            min="2"
                            max="50"
                            value={iterations}
                            onChange={(e) => setIterations(parseInt(e.target.value))}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg"
                        />
                        <p className="text-xs text-gray-500 mt-1">Recomendado: 10 para testes rápidos, 30 para significância estatística.</p>
                    </div>

                    <div className="flex-1">
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                Esta operação executará o modelo {iterations} vezes. Pode levar alguns minutos.
                                Certifique-se de estar conectado à internet (ou usando o Modo Mock).
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleRun}
                        disabled={isRunning}
                        className={`
              px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all
              ${isRunning
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-500/30'}
            `}
                    >
                        {isRunning ? (
                            <>Rodando ({progress}/{iterations})...</>
                        ) : (
                            <><Play className="w-5 h-5" /> Iniciar Validação</>
                        )}
                    </button>
                </div>

                {/* Progress Bar */}
                {isRunning && (
                    <div className="mt-6 w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${(progress / iterations) * 100}%` }}
                        ></div>
                    </div>
                )}
            </div>

            {/* Results Section */}
            {result && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <p className="text-sm text-gray-500">ROI Médio</p>
                            <p className={`text-2xl font-black ${result.summary.averageRoi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {result.summary.averageRoi.toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-400">σ = {result.summary.stdDevRoi.toFixed(1)}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <p className="text-sm text-gray-500">Adoção Média</p>
                            <p className="text-2xl font-black text-blue-500">
                                {result.summary.averageAdoption.toFixed(1)}%
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <p className="text-sm text-gray-500">Taxa de Sucesso</p>
                            <p className="text-2xl font-black text-purple-500">
                                {result.summary.successRate.toFixed(0)}%
                            </p>
                        </div>
                        <button
                            onClick={handleDownload}
                            className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg font-bold flex flex-col items-center justify-center gap-1 shadow-lg hover:shadow-green-500/30 transition-all"
                        >
                            <Download className="w-6 h-6" />
                            <span className="text-sm">Exportar Excel (CSV)</span>
                        </button>
                    </div>

                    {/* Charts */}
                    <BatchResultsChart result={result} />

                </div>
            )}
        </div>
    );
};
