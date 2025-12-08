
import React, { useState } from 'react';
import { UploadSection } from './components/UploadSection';
import { ConfigForm } from './components/ConfigForm';
import { SimulationLoader } from './components/SimulationLoader';
import { Dashboard } from './components/Dashboard';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { BatchSimulationPanel } from './components/BatchSimulationPanel';
import { FrameworkInput, SimulationConfig, SimulationOutput } from './types';
import { runSimulation } from './services/geminiService';
import { runAgenticSimulation } from './services/agenticService';

type Step = 'upload' | 'config' | 'simulating' | 'results' | 'batch';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('upload');
  const [frameworks, setFrameworks] = useState<FrameworkInput[]>([]);
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [results, setResults] = useState<SimulationOutput[]>([]);
  const [darkMode, setDarkMode] = useState(true);

  const handleFrameworksSubmit = (inputs: FrameworkInput[]) => {
    setFrameworks(inputs);
    setStep('config');
  };

  const handleConfigSubmit = async (simulationConfig: SimulationConfig) => {
    setConfig(simulationConfig);
    setStep('simulating');

    try {
      let promises: Promise<SimulationOutput>[] = [];

      if (simulationConfig.simulationMode === 'agentic') {
        // AGENTIC MODE (Node.js Backend)
        promises = simulationConfig.frameworks.map(fw => {
          const fwConfig = { ...simulationConfig, frameworks: [fw] };
          return runAgenticSimulation(fwConfig);
        });
      } else {
        // LEGACY/FAST MODE (Client-side Gemini)
        promises = simulationConfig.frameworks.map(fw => {
          const scenarioContext = simulationConfig.scenarioMode === 'custom'
            ? simulationConfig.customScenarioText || "Nenhum cenário específico."
            : `Cenário Recomendado: ${simulationConfig.selectedScenarioId} (Verificar preset)`;

          return runSimulation({
            frameworkName: fw.name,
            frameworkText: fw.text,
            frameworkCategory: simulationConfig.frameworkCategory,
            companySize: simulationConfig.companySize,
            sector: simulationConfig.sector,
            budgetLevel: simulationConfig.budgetLevel,
            currentMaturity: simulationConfig.currentMaturity,
            employeeArchetypes: simulationConfig.employeeArchetypes,
            techDebtLevel: simulationConfig.techDebtLevel,
            operationalVelocity: simulationConfig.operationalVelocity,
            previousFailures: simulationConfig.previousFailures,
            scenarioContext: scenarioContext,
            durationMonths: simulationConfig.durationMonths || 12
          });
        });
      }

      const simulationResults = await Promise.all(promises);
      setResults(simulationResults);
      setStep('results');
    } catch (error) {
      console.error("Simulation failed", error);
      setStep('config');
      alert("Erro ao executar a simulação. Verifique o console ou tente novamente.");
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFrameworks([]);
    setConfig(null);
    setResults([]);
  };

  return (
    <div className={`${darkMode ? 'dark' : ''} min-h-screen font-sans transition-colors duration-500`}>
      <div className="min-h-screen bg-brutal-white dark:bg-brutal-black text-brutal-black dark:text-brutal-white relative overflow-hidden">

        {/* Ambient Background Noise/Grid */}
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${darkMode ? '#333' : '#ccc'} 1px, transparent 1px), linear-gradient(90deg, ${darkMode ? '#333' : '#ccc'} 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}>
        </div>

        <main className="relative z-10 container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-screen">

          {step === 'upload' && (
            <UploadSection onNext={handleFrameworksSubmit} />
          )}

          {step === 'config' && (
            <ConfigForm
              frameworks={frameworks}
              onSubmit={handleConfigSubmit}
              onBack={() => setStep('upload')}
              onBatchMode={(config) => {
                setConfig(config);
                setStep('batch');
              }}
            />
          )}

          {step === 'batch' && config && (
            <BatchSimulationPanel
              config={config}
              onBack={() => setStep('config')}
            />
          )}

          {step === 'simulating' && (
            <SimulationLoader />
          )}

          {step === 'results' && config && (
            results.length === 1 ? (
              <Dashboard
                data={results[0]}
                config={config}
                onReset={handleReset}
              />
            ) : (
              <ComparisonDashboard
                results={results}
                config={config}
                onReset={handleReset}
              />
            )
          )}

        </main>
      </div>
    </div>
  );
};

export default App;
