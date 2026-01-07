/**
 * DocumentAgent - Agente dedicado à ingestão e digestão de documentos de framework
 * 
 * Responsabilidades:
 * - Extrair "Manifesto Estruturado Denso" de textos brutos
 * - Chunking inteligente para documentos grandes
 * - Preparar contexto para simulação
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

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

    constructor(apiKey?: string) {
        this.llm = new ChatGoogleGenerativeAI({
            apiKey: apiKey || process.env.GOOGLE_API_KEY,
            model: 'gemini-1.5-flash', // Flash for speed in ingestion
            temperature: 0.3, // Low temperature for factual extraction
        });
    }

    /**
     * Digest a raw document into a structured manifesto
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
                    : 0
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
                compressionRatio: 100
            };
        }
    }

    /**
     * Digest multiple documents and merge into a single context
     */
    async digestMultiple(documents: string[]): Promise<DocumentDigest> {
        console.log(`📚 DocumentAgent: Processing ${documents.length} documents...`);

        const digests = await Promise.all(
            documents.map(doc => this.digest(doc))
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
            compressionRatio: 0
        };

        merged.compressionRatio = merged.rawLength > 0
            ? parseFloat((merged.digestedLength / merged.rawLength * 100).toFixed(2))
            : 0;

        return merged;
    }
}

// Export singleton for direct use
export const documentAgent = new DocumentAgent();
