
import express from 'express';

console.log("🚀 Server script starting...");

import cors from 'cors';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'fs/promises';
import { createOrchestrator } from './agents/orchestrator.js';
import { createVectorStore, VectorStoreService } from './services/vectorStore.js';
import { ProviderGateway, ProviderGatewayError } from './services/ProviderGateway.js';
import type { SimulationConfig, PersonaProfile } from './types/index.js';
import { codeRevision, codeStateHash } from './services/RunManifest.js';
import { validateExperimentAssignment } from './core/experimentProtocol.js';
import { resolveWorkPolicy } from './core/syntheticWork.js';

// Resolve configuration in this backend; offline tests never load credential files.
if (process.env.FRAMESIM_OFFLINE_TESTS !== '1') {
    const backendRoot = fileURLToPath(new URL('../', import.meta.url));
    config({ path: path.join(backendRoot, '../.env'), quiet: true });
    config({ path: path.join(backendRoot, '.env'), quiet: true });
}

export const app = express();
const PORT = 3002;

// Log exit
process.on('exit', (code) => {
    console.log(`❌ Process exiting with code ${code}`);
});

const allowedOrigins = new Set((process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean));
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed'));
    }
}));
app.use(express.json({ limit: '2mb' }));

const providerGateway = new ProviderGateway();

// Dependencies are initialized once, while mutable simulation state is always
// created per request. This prevents concurrent POSTs from sharing brains/history.
let sharedVectorStore: VectorStoreService | undefined;
let personasReady = false;
let vectorStoreReady = false;
let vectorStoreDegraded = false;

// ========== Real Personas: load RAG/profiles.json into a lookup Map ==========
// The server can be started from repo root or from RAG/, so try both locations.
const realPersonasById = new Map<string, PersonaProfile>();

async function loadRealPersonas(): Promise<boolean> {
    const candidates = [
        path.join(process.cwd(), 'profiles.json'),
        path.join(process.cwd(), 'RAG', 'profiles.json')
    ];

    for (const candidate of candidates) {
        try {
            const raw = await readFile(candidate, 'utf-8');
            const profiles: PersonaProfile[] = JSON.parse(raw);
            for (const p of profiles) {
                realPersonasById.set(p.id, p);
            }
            console.log(`✅ Perfis sintéticos do catálogo carregados: ${realPersonasById.size} (de ${candidate})`);
            personasReady = true;
            return true;
        } catch {
            // try next candidate
        }
    }

    console.warn('⚠️  profiles.json não encontrado (tentado na raiz e em RAG/). Fallback sintético permanece ativo.');
    personasReady = true;
    return false;
}

// ========== RAG: connect ChromaDB if available (fail-open, matches src/main.ts pattern) ==========
async function initVectorStore(): Promise<boolean> {
    try {
        const vectorStore = await Promise.race([
            createVectorStore(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);
        sharedVectorStore = vectorStore;
        vectorStoreReady = true;
        console.log('✅ ChromaDB conectado — RAG ativo');
        return true;
    } catch {
        vectorStoreDegraded = true;
        console.warn('⚠️  ChromaDB offline — RAG desativado (fail-open)');
        return false;
    }
}

export const startupPromise = Promise.all([loadRealPersonas(), initVectorStore()]);

app.get('/api/status', (req, res) => {
    const providers = providerGateway.capabilities();
    const providerConfigured = Object.values(providers).some(Boolean);
    // Agentic simulation retains a deterministic fail-open path without an LLM;
    // generation endpoints require a configured provider. Reachability is kept
    // explicitly unknown here instead of treating the presence of a key as proof.
    const simulationReady = personasReady && (vectorStoreReady || vectorStoreDegraded);
    const ready = simulationReady;
    const degraded = ready && (vectorStoreDegraded || !providerConfigured);
    res.status(ready ? 200 : 503).json({
        status: ready ? (degraded ? 'degraded' : 'ok') : 'starting',
        mode: 'agentic',
        ready,
        degraded,
        graph: 'langgraph-stategraph-v1',
        providers,
        providerStatus: providerGateway.providerStatus(),
        providerConfigured,
        providerReachable: 'unknown',
        capabilities: {
            simulation: simulationReady,
            generation: providerConfigured,
            realPersonas: personasReady,
            vectorStore: vectorStoreReady
        },
        timestamp: new Date().toISOString()
    });
});

app.post('/api/generate', async (req, res) => {
    const controller = new AbortController();
    const abortIfDisconnected = () => {
        if (!res.writableEnded) controller.abort('client-disconnected');
    };
    res.once('close', abortIfDisconnected);
    try {
        await startupPromise;
        const result = await providerGateway.generate({
            task: req.body?.task,
            prompt: req.body?.prompt,
            responseSchema: req.body?.responseSchema,
            temperature: req.body?.temperature,
            seed: req.body?.seed,
            modelPreference: req.body?.modelPreference,
            agentPersona: req.body?.agentPersona,
            signal: controller.signal,
            timeoutMs: req.body?.timeoutMs,
            maxAttempts: req.body?.maxAttempts,
            maxOutputTokens: req.body?.maxOutputTokens,
            allowFallback: req.body?.allowFallback
        });
        res.json({ ...result, codeRevision: codeRevision(), codeStateHash: codeStateHash() });
    } catch (error) {
        const gatewayError = error instanceof ProviderGatewayError ? error : undefined;
        res.status(gatewayError?.status || 500).json({
            error: gatewayError?.message || 'Provider gateway failed.',
            retryable: gatewayError?.retryable ?? false,
            failureCodes: gatewayError?.failureCodes || []
        });
    } finally {
        res.removeListener('close', abortIfDisconnected);
    }
});

// Helper to hydrate Front-end IDs into Back-end PersonaProfiles
const generatePersonaFromArchetype = (archetypeId: string, index: number): PersonaProfile => {
    const isTech = ['cto', 'senior_staff', 'mid_level', 'data_driven', 'dev_senior_autonomo', 'tech_lead_cetico'].includes(archetypeId);

    // Simple maps for variety
    const names = ['Ana', 'Carlos', 'Eduardo', 'Beatriz', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Julia', 'Lucas'];
    const name = `${names[index % names.length]} (${archetypeId.toUpperCase()})`;

    return {
        id: `${archetypeId}_${index}`,
        tipo: isTech ? 'Tech' : 'Non-Tech',
        informacoes_basicas: {
            nome: name,
            genero: index % 2 === 0 ? 'F' : 'M',
            idade: 30 + (index * 2),
            cargo: archetypeId.toUpperCase().replace('_', ' '),
            area: isTech ? 'Engenharia' : 'Negócios',
            tempo_empresa: '2 anos',
            tempo_carreira: '10 anos',
            formacao: 'Ciência da Computação',
            localizacao: 'São Paulo',
            neurodivergencia: null
        },
        psicologia_comportamento: {
            'Estilo de Comunicação': 'Direto',
            'Abordagem ao Trabalho': 'Analítico',
            'Gestão de Conflitos': 'Compromisso',
            'Relação com Tecnologia': isTech ? 'Alta' : 'Média',
            'Liderança e Influência': 'Média',
            'Relação com Processos': 'Crítico',
            'Gestão de Estresse': 'Resiliente',
            'Motivadores Principais': 'Autonomia'
        },
        habilidades: {
            hard_skills: isTech ? ['Architecture', 'Cloud'] : ['Management'],
            soft_skills: ['Comunicação', 'Negociação']
        },
        contexto: {
            framework_preferido: 'Scrum',
            opiniao_agil: archetypeId.includes('cetico') || archetypeId.includes('skeptic') ? 'Cético' : 'Entusiasta',
            desafio_atual: 'Entregas atrasadas',
            motivacao_atual: 'Melhorar eficiência'
        },
        historia: `Profissional experiente com foco em ${isTech ? 'tecnologia' : 'gestão'}.`,
        ace_metadata: {
            A: 'High',
            C: 'Medium',
            E: 'Low',
            resumo_compacto: 'Profissional padrão',
            tags_busca: [archetypeId]
        }
    };
};

// Helper to hydrate Front-end Config into Back-end SimulationConfig
const generateBackendConfig = (frontendConfig: any): SimulationConfig => {
    const experiment = frontendConfig.experiment ? validateExperimentAssignment(frontendConfig.experiment) : undefined;
    const frameworkName = String(frontendConfig.frameworks?.[0]?.name || frontendConfig.frameworkName || 'Framework personalizado').slice(0, 160);
    const frameworkId = String(frontendConfig.frameworks?.[0]?.id || frameworkName)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        .slice(0, 80) || 'custom';
    const seed = experiment?.scenarioSeed ?? (Number.isFinite(Number(frontendConfig.simulationSeed))
        ? (Number(frontendConfig.simulationSeed) >>> 0)
        : 0);
    return {
        ...(experiment ? { experiment } : {}),
        task_policy: resolveWorkPolicy(frontendConfig.workloadPolicy),
        framework_config: {
            id: frameworkId,
            name: frameworkName,
            source: frontendConfig.frameworks?.[0]?.text ? 'uploaded' : 'inferred',
            description: String(frontendConfig.frameworks?.[0]?.text || '').slice(0, 4_000)
        },
        contexto_estrutural: {
            categoria_cenario: { valor: frontendConfig.frameworkCategory || 'Management', opcoes: [] },
            setor_atuacao: { valor: frontendConfig.sector || 'Tech', opcoes: [] },
            tamanho_ftes: { valor: frontendConfig.companySize || 100, descricao: 'FTEs' },
            orcamento_disponivel: { valor: frontendConfig.budgetLevel || 'Medium', opcoes: [] }
        },
        calibragem_realismo: {
            divida_tecnica: { valor: frontendConfig.techDebtLevel || 'medium', opcoes: [] },
            velocidade_operacional: { valor: frontendConfig.operationalVelocity || 'agile', opcoes: [] },
            historico_traumatico: { valor: frontendConfig.previousFailures || false, descricao: 'Historic Failure' }
        },
        ecossistema_humano: {
            distribuicao_selecionada: [],
            descricao: 'Generated from Frontend'
        },
        contexto_situacional: {
            cenario_atual: frontendConfig.customScenarioText || frontendConfig.selectedScenarioId || 'Generic Scenario',
            opcoes: []
        },
        contexto_economico: {
            profile_id: String(frontendConfig.economicProfileId || 'br_pme').slice(0, 80),
            scenario_id: String(frontendConfig.economicScenarioId || 'base').slice(0, 32),
            seed
        },
        semantic_evaluation: { enabled: frontendConfig.semanticEvaluation === true, max_requests: 3, timeout_ms: 15_000 },
        parametros_simulacao: {
            duracao_meses: Math.min(Math.max(Number(frontendConfig.durationMonths) || 12, 1), 60),
            acuracia_alvo: 'High',
            adaptacao_pme: (frontendConfig.companySize || 100) < 500,
            seed
        }
    };
};

app.post('/api/simulate', async (req, res) => {
    console.log('📨 Request received for Agentic Simulation');
    const controller = new AbortController();
    const abortIfDisconnected = () => {
        if (!res.writableEnded) controller.abort('client-disconnected');
    };
    res.once('close', abortIfDisconnected);

    try {
        await startupPromise;
        const { query, stakeholders, config, teamSample } = req.body;
        if (config?.experiment) {
            try { validateExperimentAssignment(config.experiment); }
            catch { return res.status(400).json({ error: 'Invalid experiment protocol' }); }
        }
        try { resolveWorkPolicy(config?.workloadPolicy); }
        catch { return res.status(400).json({ error: 'Invalid workload policy' }); }

        const queries = (Array.isArray(query) ? query : [query])
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .map(item => item.trim());
        if (queries.length === 0 || queries.length > 60 || queries.some(item => item.length > 10_000)
            || !Array.isArray(stakeholders) || stakeholders.length === 0 || stakeholders.length > 50
            || !config || typeof config !== 'object' || Array.isArray(config)) {
            return res.status(400).json({ error: 'Missing query, stakeholders, or config' });
        }
        if (config.experiment && queries.length !== config.experiment.exogenousSchedule.length) return res.status(400).json({ error: 'Query count differs from paired schedule' });

        // HYDRATION STEP: accepts two shapes (retrocompat):
        // (a) new: [{ id, archetype? }] → real persona by id, fallback synthetic
        // (b) old: string[] of archetype names → synthetic personas
        let realCount = 0;
        let syntheticCount = 0;
        const hydratedStakeholders: PersonaProfile[] = Array.isArray(stakeholders)
            ? stakeholders.map((s: string | { id?: string; archetype?: string }, idx: number) => {
                const id = typeof s === 'string' ? s : s?.id;
                const real = id ? realPersonasById.get(id) : undefined;
                if (real) { realCount++; return real; }
                syntheticCount++;
                const archetype = typeof s === 'string' ? s : (s?.archetype || s?.id || 'mid_level');
                return generatePersonaFromArchetype(archetype, idx);
            })
            : [];

        if (hydratedStakeholders.length === 0) {
            return res.status(400).json({ error: 'No valid stakeholders provided' });
        }

        console.log(`👥 Personas hidratadas: ${realCount} do catálogo sintético, ${syntheticCount} sintéticas — ${hydratedStakeholders.map(p => p.informacoes_basicas.nome).join(', ')}`);

        // Resolve background team sample (ids → real profiles)
        const teamProfiles: PersonaProfile[] = Array.isArray(teamSample)
            ? teamSample.slice(0, 100).map((id: string) => realPersonasById.get(id)).filter((p): p is PersonaProfile => !!p)
            : [];
        if (teamProfiles.length > 0) {
            console.log(`👥 Team sample resolvido: ${teamProfiles.length} perfis`);
        }
        // HYDRATION STEP: Convert Frontend Config to Backend Config
        const hydratedConfig = generateBackendConfig(config);

        // Mutable state is intentionally request-scoped. The vector store is the
        // only shared dependency and is initialized before requests are accepted.
        const orchestrator = createOrchestrator(undefined, sharedVectorStore);
        const result = await orchestrator.runSimulation(
            queries,
            hydratedStakeholders,
            hydratedConfig,
            teamProfiles, // EmployeeBrain: time de fundo simulado deterministicamente
            { signal: controller.signal }
        );

        console.log('✅ Simulation completed successfully');
        res.json({
            success: true,
            state: result.state,
            manifest: result.state.manifest,
            roi: result.roi,
            metricas_agenticas: result.state.metricas_agenticas
        });

    } catch (error: any) {
        const aborted = controller.signal.aborted || error?.name === 'AbortError';
        console.error(`❌ Simulation failed: ${aborted ? 'cancelled' : (error instanceof Error ? error.name : 'unknown')}`);
        if (res.writableEnded || res.destroyed) return;
        res.status(500).json({
            error: aborted ? 'Simulation cancelled' : 'Internal Server Error'
        });
    } finally {
        res.removeListener('close', abortIfDisconnected);
    }
});

// ========== NEW: Document Ingestion Endpoint ==========
import { getDocumentAgent } from './agents/DocumentAgent.js';

app.post('/api/ingest', async (req, res) => {
    console.log('📨 Request received for Document Ingestion');

    try {
        await startupPromise;
        const { rawText, documents } = req.body;

        const validRawText = typeof rawText === 'string' && rawText.trim().length > 0 && rawText.length <= 500_000;
        const validDocuments = Array.isArray(documents)
            && documents.length > 0
            && documents.length <= 10
            && documents.every((document: unknown) => typeof document === 'string' && document.trim().length > 0 && document.length <= 500_000)
            && documents.reduce((total: number, document: string) => total + document.length, 0) <= 1_000_000;
        if (!validRawText && !validDocuments) {
            return res.status(400).json({ error: 'Provide rawText (up to 500k chars) or 1-10 bounded documents.' });
        }

        let digest;
        const documentAgent = getDocumentAgent();
        if (validDocuments) {
            digest = await documentAgent.digestMultiple(documents);
        } else {
            digest = await documentAgent.digest(rawText);
        }

        console.log('✅ Document ingestion completed');
        res.json({
            success: true,
            digest
        });

    } catch (error: any) {
        console.error(`❌ Ingestion failed (${error instanceof Error ? error.name : 'unknown'}).`);
        res.status(500).json({
            error: 'Internal Server Error'
        });
    }
});

export async function startServer() {
    await startupPromise;
    return app.listen(PORT, () => {
        console.log(`\n🚀 Agentic Server running at http://localhost:${PORT}`);
        console.log(`   - Status: http://localhost:${PORT}/api/status`);
        console.log(`   - Simulator: http://localhost:${PORT}/api/simulate (POST)`);
        console.log(`   - Ingest: http://localhost:${PORT}/api/ingest (POST)`);
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    startServer().catch((error) => {
        console.error('❌ Server startup failed:', error);
        process.exitCode = 1;
    });
}
