
import React, { useState } from 'react';
import { UploadSection } from './components/UploadSection';
import { ConfigForm } from './components/ConfigForm';
import { Dashboard } from './components/Dashboard';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { SimulationLoader } from './components/SimulationLoader';
import { AppState, SimulationConfig, SimulationOutput, FrameworkInput, SingleSimulationConfig } from './types';
import { runSimulation } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.UPLOAD);
  
  // Now managing an array of inputs
  const [frameworks, setFrameworks] = useState<FrameworkInput[]>([]);
  
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  // Store array of results (length 1 for single mode, >1 for comparison)
  const [results, setResults] = useState<SimulationOutput[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleUploadNext = (inputs: FrameworkInput[]) => {
    setFrameworks(inputs);
    setState(AppState.CONFIG);
  };

  const handleConfigSubmit = async (simulationConfig: SimulationConfig) => {
    setConfig(simulationConfig);
    setState(AppState.SIMULATING);
    setError(null);
    setResults([]);

    try {
      // Run simulations in parallel for all frameworks
      // We map over the frameworks stored in state (or config) and call the service for each
      // The service expects a single config object, so we spread the global config and override specific framework details
      const promises = simulationConfig.frameworks.map(async (fw) => {
        // Create a specific config for this run, keeping global params but isolating the framework text
        // We separate frameworks array from the base config to match SingleSimulationConfig type
        const { frameworks, ...baseConfig } = simulationConfig;
        
        const singleRunConfig: SingleSimulationConfig = {
          ...baseConfig,
          frameworkName: fw.name,
          frameworkText: fw.text,
        };
        
        const output = await runSimulation(singleRunConfig);
        // Ensure the output knows its name (service adds it, but just to be safe)
        output.frameworkName = fw.name; 
        return output;
      });

      const outputs = await Promise.all(promises);
      setResults(outputs);
      setState(AppState.RESULTS);

    } catch (err) {
      console.error(err);
      setError("Falha ao gerar simulação. Verifique sua API Key ou reduza o número de comparações.");
      setState(AppState.CONFIG);
    }
  };

  const handleReset = () => {
    setState(AppState.UPLOAD);
    setFrameworks([]);
    setConfig(null);
    setResults([]);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 relative">
      <div className="scanline"></div>
      
      {/* Brutalist Corner Decorations */}
      <div className="fixed top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-black pointer-events-none z-50 mix-blend-difference"></div>
      <div className="fixed top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-black pointer-events-none z-50 mix-blend-difference"></div>
      <div className="fixed bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-black pointer-events-none z-50 mix-blend-difference"></div>
      <div className="fixed bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-black pointer-events-none z-50 mix-blend-difference"></div>

      <main className="container mx-auto mt-12 mb-12">
        {state === AppState.UPLOAD && (
          <UploadSection onNext={handleUploadNext} />
        )}

        {state === AppState.CONFIG && (
          <ConfigForm 
            frameworks={frameworks}
            onSubmit={handleConfigSubmit}
            onBack={() => setState(AppState.UPLOAD)}
          />
        )}

        {state === AppState.SIMULATING && (
          <SimulationLoader />
        )}

        {state === AppState.RESULTS && results.length > 0 && config && (
          results.length === 1 ? (
             <Dashboard data={results[0]} config={config} onReset={handleReset} />
          ) : (
             <ComparisonDashboard results={results} config={config} onReset={handleReset} />
          )
        )}

        {error && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-100 border-4 border-red-500 text-red-600 p-4 font-bold shadow-hard animate-bounce z-50">
            ERRO: {error}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;