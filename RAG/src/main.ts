/**
 * Main Entry Point - CLI para o sistema RAG otimizado
 * 
 * Uso:
 *   npx tsx src/main.ts --index                    # Indexar documentos
 *   npx tsx src/main.ts --query "sua query"        # Executar query
 *   npx tsx src/main.ts --simulate                 # Rodar simulação completa
 */

import { DocumentLoader } from './services/documentLoader.js';
import { VectorStoreService, createVectorStore } from './services/vectorStore.js';
import { QueryRouter, classifyQuery } from './services/queryRouter.js';
import { PersonaAgent } from './agents/personaAgent.js';
import { ROICalculatorAgent } from './agents/roiCalculator.js';
import { createOrchestrator } from './agents/orchestrator.js';
import type { PersonaProfile, SimulationConfig } from './types/index.js';
import { readFile } from 'fs/promises';
import { config } from 'dotenv';
import path from 'path';

// Load .env from root
config({ path: path.join(process.cwd(), '../.env') });
config({ path: path.join(process.cwd(), '.env') }); // Fallback for local RAG folder runs

// ===== CONFIGURATION =====

const CONFIG = {
    dataPath: '.',  // Diretório com os JSONs e MD
    chromaUrl: 'http://localhost:8000',
    defaultTopK: 5
};

// ===== CLI ARGUMENT PARSING =====

function parseArgs(): {
    mode: 'index' | 'query' | 'simulate' | 'test' | 'help';
    query?: string;
    persona?: string;
} {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
        return { mode: 'help' };
    }

    if (args.includes('--index')) {
        return { mode: 'index' };
    }

    if (args.includes('--simulate')) {
        return { mode: 'simulate' };
    }

    if (args.includes('--test')) {
        return { mode: 'test' };
    }

    const queryIndex = args.findIndex(a => a === '--query' || a === '-q');
    if (queryIndex !== -1 && args[queryIndex + 1]) {
        const personaIndex = args.findIndex(a => a === '--persona' || a === '-p');
        return {
            mode: 'query',
            query: args[queryIndex + 1],
            persona: personaIndex !== -1 ? args[personaIndex + 1] : undefined
        };
    }

    return { mode: 'help' };
}

function printHelp(): void {
    console.log(`
🤖 RAG Simulation System - CLI

COMANDOS:
  --index, -i           Indexar todos os documentos no ChromaDB
  --query, -q "texto"   Executar uma query (com Self-RAG automático)
  --persona, -p "cargo" Especificar cargo da persona para simulação
  --simulate            Rodar simulação completa multi-stakeholder
  --test                Executar testes de integração
  --help, -h            Mostrar esta ajuda

EXEMPLOS:
  npx tsx src/main.ts --index
  npx tsx src/main.ts --query "Como o CEO cético reagiria ao Scrum?"
  npx tsx src/main.ts --query "Qual o break-even para PME?"
  npx tsx src/main.ts --simulate

REQUISITOS:
  - GOOGLE_API_KEY configurada no ambiente
  - ChromaDB rodando em localhost:8000 (para indexação)
  `);
}

// ===== MAIN FUNCTIONS =====

async function indexDocuments(): Promise<void> {
    console.log('\n📚 Carregando documentos...\n');

    const loader = new DocumentLoader(CONFIG.dataPath);
    const documents = await loader.loadAll();

    console.log(`
📊 Documentos carregados:
  - Profiles: ${documents.profiles.length}
  - Métricas: ${documents.metrics.length}
  - Eventos: ${documents.events.length}
  - Playbooks: ${documents.playbooks.length}
  `);

    console.log('⚠️  Nota: Para indexação no ChromaDB, rode:');
    console.log('    docker run -p 8000:8000 chromadb/chroma\n');

    try {
        const vectorStore = await createVectorStore();
        await vectorStore.indexDocuments(documents);
        console.log('\n✅ Indexação completa!');
    } catch (error) {
        console.log('\n⚠️  ChromaDB não disponível. Pulando indexação vetorial.');
        console.log('    Os documentos foram carregados e podem ser usados diretamente.\n');
    }
}

async function runQuery(query: string, personaCargo?: string): Promise<void> {
    console.log(`\n🔍 Query: "${query}"\n`);

    // 1. Classificar a query
    const router = new QueryRouter();
    const classification = await router.classify(query);

    console.log(`📋 Classificação:
  - Modo: ${classification.mode}
  - Confiança: ${(classification.confidence * 100).toFixed(0)}%
  - Collections: ${classification.filters.collections.join(', ') || 'nenhuma (sem RAG)'}
  - Query refinada: "${classification.refinedQuery}"
  `);

    // 2. Se for persona pura, simular diretamente
    if (classification.mode === 'PERSONA_PURA') {
        console.log('⚡ Modo PERSONA_PURA - executando sem RAG\n');

        // Carregar uma persona do profile
        const profiles = await loadProfiles();
        let persona: PersonaProfile | undefined;

        if (personaCargo) {
            persona = profiles.find(p =>
                p.informacoes_basicas.cargo.toLowerCase().includes(personaCargo.toLowerCase())
            );
        }

        if (!persona) {
            // Tentar encontrar pela query
            persona = findPersonaFromQuery(query, profiles);
        }

        if (persona) {
            console.log(`👤 Persona selecionada: ${persona.informacoes_basicas.nome} (${persona.informacoes_basicas.cargo})\n`);

            const personaAgent = new PersonaAgent();
            const config = await loadConfig();
            const response = await personaAgent.simulateResponse(persona, query, config);

            console.log(`💬 Resposta:
${response.resposta_persona}

📊 Métricas:
  - Emoção: ${response.emocao_detectada}
  - Impacto Moral: ${response.impacto_moral > 0 ? '+' : ''}${response.impacto_moral}
  - RAG utilizado: ${response.rag_utilizado}
`);
        } else {
            console.log('⚠️  Nenhuma persona encontrada. Use --persona para especificar o cargo.');
        }
        return;
    }

    // 3. Para outros modos, tentar usar RAG
    if (classification.mode === 'CALCULO_ROI') {
        console.log('💰 Modo CALCULO_ROI - executando cálculo\n');

        const config = await loadConfig();
        const roiCalculator = new ROICalculatorAgent();
        const result = await roiCalculator.calculateROI(config);

        console.log(`📈 Resultado ROI:
  - ROI Final: ${result.roi_final.toFixed(2)}%
  - Break-even: ${result.break_even_mes ? `Mês ${result.break_even_mes}` : 'Não alcançado'}
  - Confiança: ${result.confianca_estimativa}
  
📊 Projeção (primeiros 6 meses):
${result.projecao_mensal.slice(0, 6).map(p =>
            `  Mês ${p.mes}: OpEx R$${p.opex.toLocaleString()} | Value R$${p.value.toLocaleString()} | ROI ${p.roi_parcial.toFixed(1)}%`
        ).join('\n')}
`);
        return;
    }

    // 4. Outros modos com RAG
    console.log(`📚 Modo ${classification.mode} - requer RAG (ChromaDB)\n`);
    console.log('⚠️  Para usar RAG completo, rode: npm run index primeiro');
}

async function runSimulation(): Promise<void> {
    console.log('\n🎮 Iniciando Simulação Multi-Stakeholder\n');

    // Carregar configuração e perfis
    const config = await loadConfig();
    const profiles = await loadProfiles();

    // Selecionar 3-4 stakeholders variados
    const stakeholders = selectDiverseStakeholders(profiles, 4);

    console.log(`📋 Stakeholders selecionados:
${stakeholders.map(s => `  - ${s.informacoes_basicas.nome} (${s.informacoes_basicas.cargo})`).join('\n')}
  `);

    // Cenários de simulação
    const queries = [
        'Estamos propondo implementar Daily Standups de 15 minutos. O que você acha?',
        'O primeiro Sprint terminou com 60% das tarefas incompletas. Como você reage?',
        'Estamos considerando adotar Pair Programming obrigatório. Sua opinião?'
    ];

    // Criar orquestrador e rodar simulação
    const orchestrator = createOrchestrator();
    const result = await orchestrator.runSimulation(queries, stakeholders, config);

    console.log(`\n📊 Resultado Final da Simulação:
  - Turnos: ${result.state.turno}
  - Moral Final: ${result.state.moral_time.toFixed(0)}%
  - Velocidade Final: ${result.state.velocidade_sprint.toFixed(0)}%
  - Confiança Final: ${result.state.confianca_stakeholders.toFixed(0)}%
  - Eventos: ${result.state.eventos_disparados.length}
  `);

    if (result.roi) {
        console.log(`💰 ROI Projetado: ${(result.roi as { roi_final: number }).roi_final.toFixed(2)}%`);
    }
}

async function runTests(): Promise<void> {
    console.log('\n🧪 Executando Testes de Integração\n');

    const tests = [
        { name: 'Query Router - Persona Pura', query: 'Como o CEO cético reagiria?' },
        { name: 'Query Router - ROI', query: 'Qual o break-even em 12 meses?' },
        { name: 'Query Router - Comparativo', query: 'Scrum vs Kanban para PME?' },
        { name: 'Query Router - Evento', query: 'O que causa queda de produção?' }
    ];

    const router = new QueryRouter();
    let passed = 0;

    for (const test of tests) {
        try {
            const result = await router.classify(test.query);
            console.log(`✅ ${test.name}: ${result.mode} (${(result.confidence * 100).toFixed(0)}%)`);
            passed++;
        } catch (error) {
            console.log(`❌ ${test.name}: Falhou - ${error}`);
        }
    }

    console.log(`\n📊 Resultado: ${passed}/${tests.length} testes passaram\n`);
}

// ===== HELPER FUNCTIONS =====

async function loadProfiles(): Promise<PersonaProfile[]> {
    const content = await readFile(`${CONFIG.dataPath}/profiles.json`, 'utf-8');
    return JSON.parse(content);
}

async function loadConfig(): Promise<SimulationConfig> {
    const content = await readFile(`${CONFIG.dataPath}/simulation_config.json`, 'utf-8');
    return JSON.parse(content);
}

function findPersonaFromQuery(query: string, profiles: PersonaProfile[]): PersonaProfile | undefined {
    const queryLower = query.toLowerCase();

    // Procurar por cargos comuns mencionados na query
    const cargoMentions = [
        { keywords: ['ceo', 'presidente', 'c-level'], priority: 1 },
        { keywords: ['cfo', 'financeiro', 'finanças'], priority: 2 },
        { keywords: ['cto', 'tecnologia', 'tech'], priority: 3 },
        { keywords: ['tech lead', 'lead', 'líder técnico'], priority: 4 },
        { keywords: ['gerente', 'manager'], priority: 5 },
        { keywords: ['sênior', 'senior', 'sr'], priority: 6 },
        { keywords: ['diretor'], priority: 7 }
    ];

    for (const mention of cargoMentions) {
        if (mention.keywords.some(k => queryLower.includes(k))) {
            // Encontrar perfil correspondente
            const found = profiles.find(p => {
                const cargo = p.informacoes_basicas.cargo.toLowerCase();
                return mention.keywords.some(k => cargo.includes(k));
            });

            // Se a query menciona "cético", priorizar perfis céticos
            if (found && queryLower.includes('cético')) {
                const cetico = profiles.find(p =>
                    mention.keywords.some(k => p.informacoes_basicas.cargo.toLowerCase().includes(k)) &&
                    p.contexto.opiniao_agil.toLowerCase().includes('cético')
                );
                if (cetico) return cetico;
            }

            if (found) return found;
        }
    }

    // Fallback: retornar um sênior aleatório
    return profiles.find(p => p.informacoes_basicas.cargo.includes('Sênior'));
}

function selectDiverseStakeholders(profiles: PersonaProfile[], count: number): PersonaProfile[] {
    const selected: PersonaProfile[] = [];
    const cargos = ['C-Level', 'Diretor', 'Tech Lead', 'Sênior', 'Pleno'];

    for (const cargo of cargos) {
        if (selected.length >= count) break;

        const candidate = profiles.find(p =>
            p.informacoes_basicas.cargo.includes(cargo) &&
            !selected.includes(p)
        );

        if (candidate) {
            selected.push(candidate);
        }
    }

    // Completar em ordem estável: seleção de personas faz parte do replay.
    const remaining = profiles
        .filter(profile => !selected.includes(profile))
        .sort((left, right) => left.id.localeCompare(right.id));
    selected.push(...remaining.slice(0, Math.max(0, count - selected.length)));

    return selected;
}

// ===== ENTRY POINT =====

async function main(): Promise<void> {
    const args = parseArgs();

    console.log('\n🤖 RAG Simulation System v1.0\n');

    switch (args.mode) {
        case 'index':
            await indexDocuments();
            break;
        case 'query':
            if (args.query) {
                await runQuery(args.query, args.persona);
            }
            break;
        case 'simulate':
            await runSimulation();
            break;
        case 'test':
            await runTests();
            break;
        case 'help':
        default:
            printHelp();
    }
}

// Run
main().catch(console.error);
