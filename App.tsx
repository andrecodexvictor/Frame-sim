
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { FrameworkInput, SimulationConfig, SimulationOutput } from './types';
import { runSimulation } from './services/geminiService';
import { checkAgenticStatus, runAgenticSimulation } from './services/agenticService';
import { createExperimentAssignment } from './services/experimentProtocol';
import { collectInteractiveRuns, type FailedCondition } from './services/interactiveRuns';

const UploadSection = lazy(() => import('./components/UploadSection').then(m => ({ default: m.UploadSection })));
const ConfigForm = lazy(() => import('./components/ConfigForm').then(m => ({ default: m.ConfigForm })));
const SimulationLoader = lazy(() => import('./components/SimulationLoader').then(m => ({ default: m.SimulationLoader })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const ComparisonDashboard = lazy(() => import('./components/ComparisonDashboard').then(m => ({ default: m.ComparisonDashboard })));
const BatchSimulationPanel = lazy(() => import('./components/BatchSimulationPanel').then(m => ({ default: m.BatchSimulationPanel })));

type Step = 'upload' | 'config' | 'simulating' | 'results' | 'batch';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>('upload');
  const [frameworks, setFrameworks] = useState<FrameworkInput[]>([]);
  const [config, setConfig] = useState<SimulationConfig | null>(null);
  const [results, setResults] = useState<SimulationOutput[]>([]);
  const [failures, setFailures] = useState<FailedCondition[]>([]);
  const [agenticAvailable, setAgenticAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    checkAgenticStatus().then(status => {
      if (active) setAgenticAvailable(status.available);
    });
    return () => { active = false; };
  }, []);

  const handleFrameworksSubmit = (inputs: FrameworkInput[]) => {
    setErrorMessage(null);
    setFrameworks(inputs);
    setStep('config');
  };

  const handleConfigSubmit = async (simulationConfig: SimulationConfig) => {
    setErrorMessage(null);
    if (simulationConfig.simulationMode === 'agentic' && agenticAvailable !== true) {
      setErrorMessage('O modo agêntico está indisponível no momento. Inicie o backend local na porta 3002 ou desative o modo agêntico para executar no modo padrão.');
      setStep('config');
      return;
    }
    setConfig(simulationConfig);
    setStep('simulating');

    try {
      const experimentId = `interactive-${crypto.randomUUID()}`;
      const assignment = (frameworkId: string) => createExperimentAssignment(simulationConfig, { experimentId, replicaId: '1', interventionId: frameworkId });
      let promises: Promise<SimulationOutput>[] = [];

      if (simulationConfig.simulationMode === 'agentic') {
        // AGENTIC MODE (Node.js Backend)
        promises = simulationConfig.frameworks.map(fw => {
          const fwConfig = { ...simulationConfig, frameworks: [fw], experiment: assignment(fw.id) };
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
            durationMonths: simulationConfig.durationMonths || 12,
            economicProfileId: simulationConfig.economicProfileId,
            economicScenarioId: simulationConfig.economicScenarioId,
            workloadPolicy: simulationConfig.workloadPolicy,
            experiment: assignment(fw.id), seed: assignment(fw.id).scenarioSeed
          });
        });
      }

      const simulationResults = await collectInteractiveRuns(simulationConfig.frameworks.map((framework, index) => ({ label: framework.name, experiment: assignment(framework.id), run: () => promises[index] })));
      setResults(simulationResults.outputs);
      setFailures(simulationResults.failures);
      if (simulationResults.failures.length) setErrorMessage(`${simulationResults.failures.length} condição(ões) falharam. Os resultados disponíveis e as exclusões foram preservados.`);
      setStep('results');
    } catch (error) {
      console.error("Simulation failed", error);
      setErrorMessage('Não foi possível concluir a simulação. Verifique a conexão, tente novamente ou desative o modo agêntico. Suas configurações foram preservadas.');
      setStep('config');
    }
  };

  const handleReset = () => {
    setErrorMessage(null);
    setStep('upload');
    setFrameworks([]);
    setConfig(null);
    setResults([]);
    setFailures([]);
  };

  return (
    <div className="dark min-h-screen font-sans bg-brutal-black text-brutal-white">
      <main className="container mx-auto px-4 py-12 flex flex-col items-center justify-center min-h-screen">
        {errorMessage && (
          <div className="w-full max-w-5xl mb-6 flex items-start justify-between gap-4 border-2 border-red-400 bg-red-950/60 p-4 text-sm text-red-100" role="alert">
            <p>{errorMessage}</p>
            <button
              type="button"
              className="shrink-0 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200"
              onClick={() => setErrorMessage(null)}
            >
              Fechar
            </button>
          </div>
        )}

        <Suspense fallback={<div className="w-full max-w-5xl py-16 text-center font-mono text-sm" role="status">Carregando interface…</div>}>

          {step === 'upload' && (
            <UploadSection onNext={handleFrameworksSubmit} />
          )}

          {step === 'config' && (
            <ConfigForm
              frameworks={frameworks}
              onSubmit={handleConfigSubmit}
              onBack={() => setStep('upload')}
              agenticAvailable={agenticAvailable}
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
            results.length === 1 && failures.length === 0 ? (
              <Dashboard
                data={results[0]}
                config={config}
                onReset={handleReset}
              />
            ) : (
              <ComparisonDashboard
                results={results}
                failures={failures}
                config={config}
                onReset={handleReset}
              />
            )
          )}
        </Suspense>
      </main>
    </div>
  );
};

export default App;
