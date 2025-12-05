/**
 * Document Loader - Carrega e processa documentos para indexação
 * Aplica chunking estratégico por tipo de documento
 */

import { readFile } from 'fs/promises';
import { Document } from '@langchain/core/documents';
import type {
    PersonaProfile,
    SimulationConfig,
    SimulationEvent,
    FrameworkPlaybook
} from '../types/index.js';

// Paths dos documentos
const DATA_PATHS = {
    profiles: './profiles.json',
    metrics: './business_metrics_model.md',
    events: './simulation_events.json',
    playbooks: './framework_playbooks.json',
    config: './simulation_config.json'
};

export interface LoadedDocuments {
    profiles: Document[];
    metrics: Document[];
    events: Document[];
    playbooks: Document[];
}

export class DocumentLoader {
    private basePath: string;

    constructor(basePath: string = '.') {
        this.basePath = basePath;
    }

    /**
     * Carrega todos os documentos e retorna chunked
     */
    async loadAll(): Promise<LoadedDocuments> {
        const [profiles, metrics, events, playbooks] = await Promise.all([
            this.loadProfiles(),
            this.loadMetrics(),
            this.loadEvents(),
            this.loadPlaybooks()
        ]);

        return { profiles, metrics, events, playbooks };
    }

    /**
     * Carrega profiles com chunking hierárquico por cargo
     */
    async loadProfiles(): Promise<Document[]> {
        const filePath = `${this.basePath}/${DATA_PATHS.profiles}`;
        const content = await readFile(filePath, 'utf-8');
        const profiles: PersonaProfile[] = JSON.parse(content);

        const documents: Document[] = [];

        // Agrupar por cargo para hierarquia
        const byRole = new Map<string, PersonaProfile[]>();
        for (const profile of profiles) {
            const role = profile.informacoes_basicas.cargo;
            if (!byRole.has(role)) {
                byRole.set(role, []);
            }
            byRole.get(role)!.push(profile);
        }

        // Criar documentos com metadata rica
        for (const profile of profiles) {
            const doc = new Document({
                pageContent: this.formatProfileForEmbedding(profile),
                metadata: {
                    source: 'profiles',
                    id: profile.id,
                    tipo: profile.tipo,
                    cargo: profile.informacoes_basicas.cargo,
                    area: profile.informacoes_basicas.area,
                    comunicacao: profile.psicologia_comportamento['Estilo de Comunicação'],
                    abordagem: profile.psicologia_comportamento['Abordagem ao Trabalho'],
                    framework: profile.contexto.framework_preferido,
                    opiniao_agil: profile.contexto.opiniao_agil,
                    tags: profile.ace_metadata.tags_busca
                }
            });
            documents.push(doc);
        }

        console.log(`📄 Carregados ${documents.length} profiles`);
        return documents;
    }

    /**
     * Formata profile para embedding otimizado
     */
    private formatProfileForEmbedding(profile: PersonaProfile): string {
        const { ace_metadata, informacoes_basicas, psicologia_comportamento, contexto } = profile;

        // Usar formato ACE compacto para economia de tokens
        return `
PERSONA: ${informacoes_basicas.nome}
CARGO: ${informacoes_basicas.cargo} | ÁREA: ${informacoes_basicas.area}
EXPERIÊNCIA: ${informacoes_basicas.tempo_carreira} de carreira

ATRIBUTOS: ${ace_metadata.A}
CONTEXTO: ${ace_metadata.C}
EXECUÇÃO: ${ace_metadata.E}

COMPORTAMENTO:
- Comunicação: ${psicologia_comportamento['Estilo de Comunicação']}
- Trabalho: ${psicologia_comportamento['Abordagem ao Trabalho']}
- Conflitos: ${psicologia_comportamento['Gestão de Conflitos']}
- Liderança: ${psicologia_comportamento['Liderança e Influência']}
- Estresse: ${psicologia_comportamento['Gestão de Estresse']}

FRAMEWORK: ${contexto.framework_preferido} (${contexto.opiniao_agil})
DESAFIO: ${contexto.desafio_atual}
MOTIVAÇÃO: ${contexto.motivacao_atual}

RESUMO: ${ace_metadata.resumo_compacto}
`.trim();
    }

    /**
     * Carrega métricas de negócio com chunking por seção
     */
    async loadMetrics(): Promise<Document[]> {
        const filePath = `${this.basePath}/${DATA_PATHS.metrics}`;
        const content = await readFile(filePath, 'utf-8');

        const documents: Document[] = [];

        // Split por seções H2 (##)
        const sections = content.split(/(?=^## )/gm);

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i].trim();
            if (!section) continue;

            // Extrair título da seção
            const titleMatch = section.match(/^##?\s*(.+)$/m);
            const title = titleMatch ? titleMatch[1] : `Seção ${i + 1}`;

            // Determinar tipo de conteúdo
            let sectionType = 'general';
            if (section.includes('ROI') || section.includes('Retorno')) sectionType = 'roi';
            else if (section.includes('OpEx') || section.includes('Custo')) sectionType = 'cost';
            else if (section.includes('Variáveis') || section.includes('PME')) sectionType = 'variables';
            else if (section.includes('Modificadores') || section.includes('Cenário')) sectionType = 'modifiers';
            else if (section.includes('Dinâmica') || section.includes('Motor')) sectionType = 'dynamics';

            documents.push(new Document({
                pageContent: section,
                metadata: {
                    source: 'metrics',
                    section: title,
                    type: sectionType,
                    index: i
                }
            }));
        }

        console.log(`📊 Carregadas ${documents.length} seções de métricas`);
        return documents;
    }

    /**
     * Carrega eventos de simulação
     */
    async loadEvents(): Promise<Document[]> {
        const filePath = `${this.basePath}/${DATA_PATHS.events}`;
        const content = await readFile(filePath, 'utf-8');
        const events: SimulationEvent[] = JSON.parse(content);

        const documents: Document[] = [];

        for (const event of events) {
            const doc = new Document({
                pageContent: this.formatEventForEmbedding(event),
                metadata: {
                    source: 'events',
                    id: event.id,
                    tipo: event.tipo,
                    titulo: event.titulo,
                    probabilidade: event.gatilhos.probabilidade_base,
                    impactos: Object.keys(event.impacto)
                }
            });
            documents.push(doc);
        }

        console.log(`⚡ Carregados ${documents.length} eventos`);
        return documents;
    }

    private formatEventForEmbedding(event: SimulationEvent): string {
        const gatilhos = Object.entries(event.gatilhos)
            .filter(([k]) => k !== 'probabilidade_base' && k !== 'modificadores')
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n');

        const impactos = Object.entries(event.impacto)
            .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
            .join(', ');

        return `
EVENTO: ${event.titulo}
TIPO: ${event.tipo}
PROBABILIDADE BASE: ${(event.gatilhos.probabilidade_base * 100).toFixed(0)}%

GATILHOS:
${gatilhos}

IMPACTOS: ${impactos}

DESCRIÇÃO: ${event.descricao}
`.trim();
    }

    /**
     * Carrega playbooks de frameworks
     */
    async loadPlaybooks(): Promise<Document[]> {
        const filePath = `${this.basePath}/${DATA_PATHS.playbooks}`;
        const content = await readFile(filePath, 'utf-8');
        const playbooks: Record<string, FrameworkPlaybook> = JSON.parse(content);

        const documents: Document[] = [];

        for (const [key, playbook] of Object.entries(playbooks)) {
            const doc = new Document({
                pageContent: this.formatPlaybookForEmbedding(key, playbook),
                metadata: {
                    source: 'playbooks',
                    framework: key,
                    nome: playbook.nome,
                    rituais: playbook.rituais.map(r => r.nome),
                    regras: playbook.regras_ouro.length
                }
            });
            documents.push(doc);
        }

        console.log(`📚 Carregados ${documents.length} playbooks`);
        return documents;
    }

    private formatPlaybookForEmbedding(key: string, playbook: FrameworkPlaybook): string {
        const rituais = playbook.rituais
            .map(r => `- ${r.nome}: ${r.duracao} (${r.frequencia}) - Custo tempo: ${(r.custo_tempo * 100).toFixed(1)}%`)
            .join('\n');

        const falhas = playbook.falhas_comuns_simulacao
            .map(f => `- SE ${f.gatilho} → ${f.efeito}`)
            .join('\n');

        return `
FRAMEWORK: ${playbook.nome} (${key})

RITUAIS:
${rituais}

REGRAS DE OURO:
${playbook.regras_ouro.map(r => `- ${r}`).join('\n')}

FALHAS COMUNS EM SIMULAÇÃO:
${falhas}
`.trim();
    }

    /**
     * Carrega configuração atual da simulação
     */
    async loadConfig(): Promise<SimulationConfig> {
        const filePath = `${this.basePath}/${DATA_PATHS.config}`;
        const content = await readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }
}

// Export singleton para uso direto
export const documentLoader = new DocumentLoader();
