/**
 * DocumentAgent - Agente dedicado à ingestão e digestão de documentos de framework
 * 
 * Responsabilidades:
 * - Extrair "Manifesto Estruturado Denso" de textos brutos
 * - Chunking inteligente para documentos grandes
 * - Preparar contexto para simulação
 * - Indexar chunks no Vector Store para RAG dinâmico
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SmartChunker, ChunkingResult } from '../services/SmartChunker.js';
import { UserFrameworkStore, IndexingResult } from '../services/UserFrameworkStore.js';

// Threshold para considerar documento "grande"
const LARGE_DOCUMENT_THRESHOLD = 50000; // 50k chars (~15-20 páginas)

export interface DocumentDigest {
    manifesto: string;
    coreValues: string[];
    roles: string[];
    ceremonies: string[];
    artifacts: string[];
    adoptionStrategies: string[];
    rawLength: number;
    digestedLength: number;
    compressionRatio: number;
    // Novos campos para documentos grandes
    isLargeDocument?: boolean;
    chunksCreated?: number;
    documentId?: string;
    indexed?: boolean;
}

export interface LargeDocumentResult {
    digest: DocumentDigest;
    chunking: ChunkingResult;
    indexing?: IndexingResult;
}

const DIGEST_PROMPT = `Você é um Arquiteto de Soluções Sênior. Sua tarefa é analisar este documento técnico de um Framework Corporativo e extrair um MANIFESTO ESTRUTURADO DENSO para ser usado em uma simulação.

Foque em:
1. Valores Core e Filosofia
2. Papéis e Responsabilidades (Quem faz o que)
3. Cerimônias, Reuniões e Eventos
4. Artefatos e Saídas
5. Estratégias de Adoção Recomendadas

Se o texto for muito longo, priorize os processos e regras de negócio.

SAÍDA: Responda em JSON com este formato:
{
    "manifesto": "Texto Markdown bem estruturado e conciso (máximo 4000 caracteres) com essas seções",
    "coreValues": ["valor1", "valor2"],
    "roles": ["papel1", "papel2"],
    "ceremonies": ["cerimonia1", "cerimonia2"],
    "artifacts": ["artefato1", "artefato2"],
    "adoptionStrategies": ["estrategia1", "estrategia2"]
}

DOCUMENTO ORIGINAL:
{document}`;

export class DocumentAgent {
    private llm: ChatGoogleGenerativeAI;
    private chunker: SmartChunker;
    private vectorStore: UserFrameworkStore;

    constructor(apiKey?: string) {
        this.llm = new ChatGoogleGenerativeAI({
            apiKey: apiKey || process.env.GOOGLE_API_KEY,
            model: 'gemini-1.5-flash', // Flash for speed in ingestion
            temperature: 0.3, // Low temperature for factual extraction
        });
        this.chunker = new SmartChunker();
        this.vectorStore = new UserFrameworkStore();
    }

    /**
     * Verifica se documento é grande o suficiente para chunking
     */
    isLargeDocument(text: string): boolean {
        return text.length > LARGE_DOCUMENT_THRESHOLD;
    }

    /**
     * Processa documento automaticamente (escolhe método baseado no tamanho)
     */
    async process(rawText: string, indexInVectorStore: boolean = true): Promise<DocumentDigest> {
        if (this.isLargeDocument(rawText)) {
            console.log(`📦 DocumentAgent: Large document detected (${rawText.length} chars), using chunking...`);
            const result = await this.digestLargeDocument(rawText, indexInVectorStore);
            return result.digest;
        } else {
            return this.digest(rawText);
        }
    }

    /**
     * Digest a raw document into a structured manifesto (para documentos pequenos)
     */
    async digest(rawText: string): Promise<DocumentDigest> {
        console.log(`📄 DocumentAgent: Processing ${rawText.length} characters...`);

        // Truncate for safety (Flash context limit)
        const truncatedText = rawText.slice(0, 500000);

        const prompt = DIGEST_PROMPT.replace('{document}', truncatedText);

        try {
            const response = await this.llm.invoke(prompt);
            const content = typeof response.content === 'string'
                ? response.content
                : JSON.stringify(response.content);

            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('JSON não encontrado na resposta do DocumentAgent');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            const digest: DocumentDigest = {
                manifesto: parsed.manifesto || '',
                coreValues: parsed.coreValues || [],
                roles: parsed.roles || [],
                ceremonies: parsed.ceremonies || [],
                artifacts: parsed.artifacts || [],
                adoptionStrategies: parsed.adoptionStrategies || [],
                rawLength: rawText.length,
                digestedLength: parsed.manifesto?.length || 0,
                compressionRatio: rawText.length > 0
                    ? parseFloat(((parsed.manifesto?.length || 0) / rawText.length * 100).toFixed(2))
                    : 0,
                isLargeDocument: false
            };

            console.log(`✅ DocumentAgent: Digested to ${digest.digestedLength} chars (${digest.compressionRatio}% of original)`);
            return digest;

        } catch (error) {
            console.error('❌ DocumentAgent: Falha na digestão:', error);
            // Fallback: return raw text as manifesto
            return {
                manifesto: rawText.slice(0, 4000),
                coreValues: [],
                roles: [],
                ceremonies: [],
                artifacts: [],
                adoptionStrategies: [],
                rawLength: rawText.length,
                digestedLength: Math.min(rawText.length, 4000),
                compressionRatio: 100,
                isLargeDocument: false
            };
        }
    }

    /**
     * Processa documento grande com chunking e indexação no Vector Store
     */
    async digestLargeDocument(rawText: string, indexInVectorStore: boolean = true): Promise<LargeDocumentResult> {
        console.log(`📦 DocumentAgent: Processing LARGE document (${rawText.length} chars)...`);

        // 1. Chunk do documento
        const chunkingResult = this.chunker.chunk(rawText);
        console.log(`   Chunked into ${chunkingResult.chunks.length} segments`);

        // 2. Gerar digest resumido (usando primeiros e últimos chunks + estrutura)
        const summaryText = this.buildSummaryForDigest(chunkingResult);
        const baseDigest = await this.digest(summaryText);

        // 3. Indexar no Vector Store (se habilitado)
        let indexingResult: IndexingResult | undefined;
        if (indexInVectorStore) {
            try {
                indexingResult = await this.vectorStore.indexDocument(chunkingResult);
                console.log(`   Indexed ${indexingResult.chunksIndexed} chunks in Vector Store`);
            } catch (error) {
                console.warn('   ⚠️ Vector Store indexing failed (continuing without):', error);
            }
        }

        // 4. Enriquecer digest com informações do chunking
        const enrichedDigest: DocumentDigest = {
            ...baseDigest,
            isLargeDocument: true,
            chunksCreated: chunkingResult.chunks.length,
            documentId: chunkingResult.documentId,
            indexed: indexingResult?.success || false,
            // Adicionar info de estrutura ao manifesto
            manifesto: this.enrichManifestoWithStructure(baseDigest.manifesto, chunkingResult)
        };

        return {
            digest: enrichedDigest,
            chunking: chunkingResult,
            indexing: indexingResult
        };
    }

    /**
     * Constrói texto resumido para digestão de documento grande
     */
    private buildSummaryForDigest(chunkingResult: ChunkingResult): string {
        const { chunks, structure } = chunkingResult;

        // Pegar primeiros 3 chunks (introdução)
        const introChunks = chunks.slice(0, 3).map(c => c.content).join('\n\n');

        // Pegar chunks do meio (1 de cada seção principal)
        const middleChunks: string[] = [];
        const seenSections = new Set<string>();
        for (const chunk of chunks) {
            if (!seenSections.has(chunk.metadata.section) && middleChunks.length < 5) {
                middleChunks.push(`[${chunk.metadata.section}]\n${chunk.content.substring(0, 500)}...`);
                seenSections.add(chunk.metadata.section);
            }
        }

        // Pegar últimos 2 chunks (conclusão)
        const outroChunks = chunks.slice(-2).map(c => c.content).join('\n\n');

        // Estrutura detectada
        const structureInfo = `
ESTRUTURA DO DOCUMENTO:
- Título: ${structure.title || 'Não detectado'}
- Framework: ${structure.framework || 'Genérico'}
- Páginas estimadas: ${structure.estimatedPages}
- Seções detectadas: ${structure.sections.slice(0, 10).join(', ')}
`;

        return `${structureInfo}\n\n=== INTRODUÇÃO ===\n${introChunks}\n\n=== SEÇÕES PRINCIPAIS ===\n${middleChunks.join('\n\n')}\n\n=== CONCLUSÃO ===\n${outroChunks}`;
    }

    /**
     * Enriquece manifesto com informações da estrutura
     */
    private enrichManifestoWithStructure(manifesto: string, chunkingResult: ChunkingResult): string {
        const { structure, chunks } = chunkingResult;

        const structureNote = `
> **📦 Documento Grande Processado**
> - ${structure.estimatedPages} páginas | ${chunks.length} chunks indexados
> - Framework: ${structure.framework || 'Detectado automaticamente'}
> - Seções: ${structure.sections.slice(0, 5).join(', ')}${structure.sections.length > 5 ? '...' : ''}

`;
        return structureNote + manifesto;
    }

    /**
     * Digest multiple documents and merge into a single context
     */
    async digestMultiple(documents: string[]): Promise<DocumentDigest> {
        console.log(`📚 DocumentAgent: Processing ${documents.length} documents...`);

        const digests = await Promise.all(
            documents.map(doc => this.process(doc, true)) // Usar process() que detecta tamanho
        );

        // Merge all digests
        const merged: DocumentDigest = {
            manifesto: digests.map(d => d.manifesto).join('\n\n---\n\n'),
            coreValues: [...new Set(digests.flatMap(d => d.coreValues))],
            roles: [...new Set(digests.flatMap(d => d.roles))],
            ceremonies: [...new Set(digests.flatMap(d => d.ceremonies))],
            artifacts: [...new Set(digests.flatMap(d => d.artifacts))],
            adoptionStrategies: [...new Set(digests.flatMap(d => d.adoptionStrategies))],
            rawLength: digests.reduce((sum, d) => sum + d.rawLength, 0),
            digestedLength: digests.reduce((sum, d) => sum + d.digestedLength, 0),
            compressionRatio: 0,
            isLargeDocument: digests.some(d => d.isLargeDocument),
            chunksCreated: digests.reduce((sum, d) => sum + (d.chunksCreated || 0), 0),
            indexed: digests.some(d => d.indexed)
        };

        merged.compressionRatio = merged.rawLength > 0
            ? parseFloat((merged.digestedLength / merged.rawLength * 100).toFixed(2))
            : 0;

        return merged;
    }

    /**
     * Busca contexto relevante do Vector Store para uma query
     */
    async getRelevantContext(query: string, topK: number = 5): Promise<string> {
        return this.vectorStore.generateContext(query, topK);
    }
}

// Export singleton for direct use
export const documentAgent = new DocumentAgent();

