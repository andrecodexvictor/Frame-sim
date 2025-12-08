
import express from 'express';

console.log("🚀 Server script starting...");

import cors from 'cors';
import { config } from 'dotenv';
import path from 'path';
import { createOrchestrator } from './agents/orchestrator.js';
import type { SimulationConfig, PersonaProfile } from './types/index.js';

// Load .env
config({ path: path.join(process.cwd(), '../.env') });
config({ path: path.join(process.cwd(), '.env') });

const app = express();
const PORT = 3002;

// Keep process alive
setInterval(() => { }, 1000);

// Log exit
process.on('exit', (code) => {
    console.log(`❌ Process exiting with code ${code}`);
});

app.use(cors());
app.use(express.json());

// Initialize Orchestrator
// Ideally we should persist state per session/request, but for MVP we use a singleton or per-request instance
const orchestrator = createOrchestrator();

app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', mode: 'agentic', timestamp: new Date().toISOString() });
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
    return {
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
        parametros_simulacao: {
            duracao_meses: frontendConfig.durationMonths || 12,
            acuracia_alvo: 'High',
            adaptacao_pme: (frontendConfig.companySize || 100) < 500
        }
    };
};

app.post('/api/simulate', async (req, res) => {
    console.log('📨 Request received for Agentic Simulation');

    try {
        const { query, stakeholders, config } = req.body;

        if (!query || !stakeholders) {
            return res.status(400).json({ error: 'Missing query or stakeholders' });
        }

        // HYDRATION STEP: Convert string strings to PersonaProfile objects
        const hydratedStakeholders: PersonaProfile[] = Array.isArray(stakeholders)
            ? stakeholders.map((id: string, idx: number) => generatePersonaFromArchetype(id, idx))
            : [];

        if (hydratedStakeholders.length === 0) {
            return res.status(400).json({ error: 'No valid stakeholders provided' });
        }

        // HYDRATION STEP: Convert Frontend Config to Backend Config
        const hydratedConfig = generateBackendConfig(config);

        // Reset state for new simulation (simulating a fresh run)
        orchestrator.resetState();

        const result = await orchestrator.runSimulation(
            [query], // Run single query for now, or multiple if passed array
            hydratedStakeholders,
            hydratedConfig
        );

        console.log('✅ Simulation completed successfully');
        res.json({
            success: true,
            state: result.state,
            roi: result.roi
        });

    } catch (error: any) {
        console.error('❌ Simulation failed:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Agentic Server running at http://localhost:${PORT}`);
    console.log(`   - Status: http://localhost:${PORT}/api/status`);
    console.log(`   - Simulator: http://localhost:${PORT}/api/simulate (POST)`);
});
