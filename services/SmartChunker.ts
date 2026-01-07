/**
 * SmartChunker - Chunking inteligente para documentos grandes
 * 
 * Divide documentos respeitando estrutura semântica (capítulos, seções)
 * e gera metadata para indexação no Vector Store.
 */

export interface ChunkMetadata {
    index: number;
    section: string;
    page?: number;
    keywords: string[];
    charStart: number;
    charEnd: number;
}

export interface DocumentChunk {
    id: string;
    content: string;
    metadata: ChunkMetadata;
}

export interface ChunkingResult {
    documentId: string;
    originalLength: number;
    chunks: DocumentChunk[];
    structure: DocumentStructure;
}

export interface DocumentStructure {
    title?: string;
    sections: string[];
    estimatedPages: number;
    framework?: string;
}

// Padrões para detectar estrutura de documentos
const STRUCTURE_PATTERNS = {
    // Capítulos e seções genéricos
    chapter: /^(Chapter|Capítulo|CAPÍTULO|CHAPTER)\s+(\d+)/im,
    section: /^(Section|Seção|SEÇÃO|SECTION)\s+(\d+(?:\.\d+)*)/im,

    // COBIT específico
    cobitDomain: /^(Domínio|Domain)?\s*(EDM|APO|BAI|DSS|MEA)\d{0,2}/im,
    cobitProcess: /(EDM|APO|BAI|DSS|MEA)\d{2}\s*[-–]\s*(.+)/im,

    // Markdown headers
    markdownH1: /^#\s+(.+)$/m,
    markdownH2: /^##\s+(.+)$/m,
    markdownH3: /^###\s+(.+)$/m,

    // Numeração genérica
    numberedSection: /^(\d+(?:\.\d+)*)\s+([A-Z])/m,

    // Page breaks (PDF extraction artifacts)
    pageBreak: /---\s*Page\s+(\d+)\s*---/i,
};

// Keywords relevantes para frameworks de governança
const FRAMEWORK_KEYWORDS = [
    // COBIT
    'governance', 'management', 'objectives', 'components', 'enablers',
    'stakeholder', 'value creation', 'risk optimization', 'resource optimization',

    // Geral
    'process', 'control', 'audit', 'compliance', 'security',
    'implementation', 'assessment', 'maturity', 'capability',

    // Ágil
    'sprint', 'backlog', 'scrum', 'kanban', 'retrospective',
    'daily', 'burndown', 'velocity', 'story points',
];

export class SmartChunker {
    private chunkSize: number;
    private chunkOverlap: number;
    private minChunkSize: number;

    constructor(options?: {
        chunkSize?: number;
        chunkOverlap?: number;
        minChunkSize?: number;
    }) {
        this.chunkSize = options?.chunkSize || 2000;
        this.chunkOverlap = options?.chunkOverlap || 200;
        this.minChunkSize = options?.minChunkSize || 500;
    }

    /**
     * Processa documento grande e retorna chunks indexáveis
     */
    chunk(text: string, documentId?: string): ChunkingResult {
        const docId = documentId || this.generateId();
        console.log(`📄 SmartChunker: Processing ${text.length} chars...`);

        // 1. Detectar estrutura do documento
        const structure = this.detectStructure(text);
        console.log(`   Structure: ${structure.sections.length} sections detected`);

        // 2. Dividir por seções primeiro (se houver)
        const sections = this.splitBySections(text);

        // 3. Chunkar cada seção respeitando limites
        const chunks: DocumentChunk[] = [];
        let globalIndex = 0;

        for (const section of sections) {
            const sectionChunks = this.chunkSection(section.content, section.title, globalIndex);
            chunks.push(...sectionChunks);
            globalIndex += sectionChunks.length;
        }

        console.log(`   Chunks: ${chunks.length} created`);

        return {
            documentId: docId,
            originalLength: text.length,
            chunks,
            structure
        };
    }

    /**
     * Detecta estrutura do documento (título, seções, framework)
     */
    private detectStructure(text: string): DocumentStructure {
        const sections: string[] = [];
        let title: string | undefined;
        let framework: string | undefined;

        // Detectar título (primeira linha grande ou H1)
        const h1Match = text.match(STRUCTURE_PATTERNS.markdownH1);
        if (h1Match) {
            title = h1Match[1].trim();
        }

        // Detectar se é COBIT
        if (text.match(/COBIT/i)) {
            framework = 'COBIT';
            // Extrair domínios
            const domains = text.matchAll(/\b(EDM|APO|BAI|DSS|MEA)\d{2}\b/g);
            for (const match of domains) {
                if (!sections.includes(match[0])) {
                    sections.push(match[0]);
                }
            }
        }

        // Detectar seções genéricas
        const chapterMatches = text.matchAll(/(?:^|\n)(Chapter|Capítulo)\s+(\d+)[:\s]+([^\n]+)/gi);
        for (const match of chapterMatches) {
            sections.push(`${match[1]} ${match[2]}: ${match[3].trim()}`);
        }

        // Detectar headers markdown
        const h2Matches = text.matchAll(/^##\s+([^\n]+)$/gm);
        for (const match of h2Matches) {
            sections.push(match[1].trim());
        }

        // Estimar páginas (assumindo ~3000 chars/página)
        const estimatedPages = Math.ceil(text.length / 3000);

        return {
            title,
            sections: sections.slice(0, 50), // Limitar a 50 seções
            estimatedPages,
            framework
        };
    }

    /**
     * Divide texto por seções estruturais
     */
    private splitBySections(text: string): Array<{ title: string; content: string }> {
        const sections: Array<{ title: string; content: string }> = [];

        // Padrões de divisão
        const splitPatterns = [
            /\n(?=#{1,3}\s)/g,  // Markdown headers
            /\n(?=Chapter\s+\d+)/gi,  // Chapters
            /\n(?=(?:EDM|APO|BAI|DSS|MEA)\d{2}\s*[-–])/gi,  // COBIT processes
            /\n(?=\d+\.\d+\s+[A-Z])/g,  // Numbered sections
        ];

        // Tentar dividir por padrões
        let parts: string[] = [text];
        for (const pattern of splitPatterns) {
            if (text.match(pattern)) {
                parts = text.split(pattern).filter(p => p.trim().length > 0);
                break;
            }
        }

        // Se não encontrou estrutura, dividir por parágrafos grandes
        if (parts.length === 1 && text.length > this.chunkSize * 2) {
            parts = text.split(/\n\n+/).filter(p => p.trim().length > 0);
        }

        // Criar seções
        for (let i = 0; i < parts.length; i++) {
            const content = parts[i].trim();
            const firstLine = content.split('\n')[0].substring(0, 100);
            sections.push({
                title: this.extractTitle(firstLine) || `Section ${i + 1}`,
                content
            });
        }

        return sections;
    }

    /**
     * Chunka uma seção individual
     */
    private chunkSection(content: string, sectionTitle: string, startIndex: number): DocumentChunk[] {
        const chunks: DocumentChunk[] = [];

        if (content.length <= this.chunkSize) {
            // Seção pequena, retornar como único chunk
            chunks.push({
                id: `chunk_${startIndex}`,
                content: content,
                metadata: {
                    index: startIndex,
                    section: sectionTitle,
                    keywords: this.extractKeywords(content),
                    charStart: 0,
                    charEnd: content.length
                }
            });
            return chunks;
        }

        // Dividir por sentenças para não cortar no meio
        const sentences = this.splitIntoSentences(content);
        let currentChunk = '';
        let charStart = 0;
        let chunkIndex = startIndex;

        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length >= this.minChunkSize) {
                // Salvar chunk atual
                chunks.push({
                    id: `chunk_${chunkIndex}`,
                    content: currentChunk.trim(),
                    metadata: {
                        index: chunkIndex,
                        section: sectionTitle,
                        keywords: this.extractKeywords(currentChunk),
                        charStart,
                        charEnd: charStart + currentChunk.length
                    }
                });

                // Preparar próximo chunk com overlap
                const overlapText = currentChunk.slice(-this.chunkOverlap);
                charStart += currentChunk.length - this.chunkOverlap;
                currentChunk = overlapText;
                chunkIndex++;
            }
            currentChunk += sentence;
        }

        // Chunk final
        if (currentChunk.trim().length >= this.minChunkSize) {
            chunks.push({
                id: `chunk_${chunkIndex}`,
                content: currentChunk.trim(),
                metadata: {
                    index: chunkIndex,
                    section: sectionTitle,
                    keywords: this.extractKeywords(currentChunk),
                    charStart,
                    charEnd: charStart + currentChunk.length
                }
            });
        } else if (chunks.length > 0) {
            // Anexar ao chunk anterior se muito pequeno
            chunks[chunks.length - 1].content += ' ' + currentChunk.trim();
        }

        return chunks;
    }

    /**
     * Divide texto em sentenças
     */
    private splitIntoSentences(text: string): string[] {
        // Padrão para detectar fim de sentença
        const sentencePattern = /[.!?]+[\s\n]+|[\n]{2,}/g;
        const parts = text.split(sentencePattern);

        // Reconstruir com pontuação
        const sentences: string[] = [];
        let lastEnd = 0;

        for (const match of text.matchAll(sentencePattern)) {
            if (match.index !== undefined) {
                sentences.push(text.substring(lastEnd, match.index + match[0].length));
                lastEnd = match.index + match[0].length;
            }
        }

        // Adicionar resto
        if (lastEnd < text.length) {
            sentences.push(text.substring(lastEnd));
        }

        return sentences.filter(s => s.trim().length > 0);
    }

    /**
     * Extrai keywords do texto
     */
    private extractKeywords(text: string): string[] {
        const lowerText = text.toLowerCase();
        const found: string[] = [];

        for (const keyword of FRAMEWORK_KEYWORDS) {
            if (lowerText.includes(keyword.toLowerCase())) {
                found.push(keyword);
            }
        }

        // Extrair termos em CAPS (acrônimos)
        const acronyms = text.match(/\b[A-Z]{2,6}\b/g) || [];
        for (const acr of acronyms.slice(0, 5)) {
            if (!found.includes(acr)) {
                found.push(acr);
            }
        }

        return found.slice(0, 10); // Limitar a 10 keywords
    }

    /**
     * Extrai título de uma linha
     */
    private extractTitle(line: string): string | null {
        // Remover markdown
        let title = line.replace(/^#+\s*/, '').trim();

        // Remover numeração
        title = title.replace(/^\d+(\.\d+)*\s*/, '').trim();

        // Limitar tamanho
        if (title.length > 80) {
            title = title.substring(0, 77) + '...';
        }

        return title.length > 3 ? title : null;
    }

    /**
     * Gera ID único
     */
    private generateId(): string {
        return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export singleton
export const smartChunker = new SmartChunker();
