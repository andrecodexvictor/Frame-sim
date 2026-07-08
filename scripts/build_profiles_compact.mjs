#!/usr/bin/env node
// Projects RAG/profiles.json (350 rich personas) into data/profiles_compact.json
// (the flat shape consumed by services/personaEnricher.ts). Deterministic —
// no Math.random anywhere, so re-running produces a byte-identical file.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'RAG', 'profiles.json');
const OUT = path.join(ROOT, 'data', 'profiles_compact.json');

// Vocabulary reused verbatim from services/personaEnricher.ts (COGNITIVE_BIASES)
// plus additions already used elsewhere in the project (RAG/src/agents/personaAgent.ts)
// for Otimismo/Negatividade/Custo Irrecuperável/Efeito Manada.
const BIASES = [
    'Viés de Confirmação: Favorece informações que confirmam suas crenças.',
    'Viés do Status Quo: Prefere manter as coisas como estão.',
    'Aversão à Perda: Medo de perder supera desejo de ganhar.',
    'Efeito Dunning-Kruger: Superestima próprias habilidades.',
    'Viés de Ancoragem: Depende demais da primeira informação recebida.',
    'Viés de Autoridade: Aceita opiniões de figuras de autoridade sem questionar.',
    'Viés de Otimismo: Subestima riscos e prazos.',
    'Viés de Negatividade: Foca excessivamente nos problemas e riscos.',
    'Falácia do Custo Irrecuperável: Apegado a investimentos passados mesmo que não façam mais sentido.',
    'Efeito Manada: Segue as decisões da maioria sem questionar próprias convicções.',
];

// djb2 hash — stable across runs/platforms (used only as fallback below).
function djb2(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash;
}

// Ordered heuristics: first match wins. Falls back to a hash of the id so
// the result is still fully deterministic (never random) for profiles that
// don't hit any rule.
const RULES = [
    { test: (psych, ctx) => ctx.opiniao_agil === 'Cético', bias: BIASES[7] }, // Negatividade
    { test: (psych, ctx) => ctx.opiniao_agil === 'Entusiasta', bias: BIASES[6] }, // Otimismo
    {
        test: (psych) =>
            psych['Abordagem ao Trabalho'] === 'Conservador/tradicional' ||
            psych['Relação com Processos'] === 'Seguidor rigoroso',
        bias: BIASES[1], // Status Quo
    },
    { test: (psych) => psych['Gestão de Estresse'] === 'Workaholic', bias: BIASES[8] }, // Custo Irrecuperável
    {
        test: (psych) =>
            psych['Liderança e Influência'] === 'Executor' ||
            psych['Liderança e Influência'] === 'Contribuidor individual',
        bias: BIASES[9], // Efeito Manada
    },
    {
        test: (psych) =>
            psych['Gestão de Estresse'] === 'Necessita ambiente estável' ||
            psych['Gestão de Estresse'] === 'Precisa de previsibilidade',
        bias: BIASES[4], // Ancoragem
    },
    {
        test: (psych) =>
            psych['Liderança e Influência'] === 'Líder nato' ||
            psych['Liderança e Influência'] === 'Visionário',
        bias: BIASES[3], // Dunning-Kruger / Superconfiança
    },
    {
        test: (psych) =>
            psych['Relação com Processos'] === 'Questionador constante' ||
            psych['Relação com Tecnologia'] === 'Cético com novidades',
        bias: BIASES[0], // Confirmação
    },
    {
        test: (psych, ctx) =>
            psych['Gestão de Conflitos'] === 'Tomador de lados' || ctx.motivacao_atual === 'Estabilidade',
        bias: BIASES[2], // Aversão à Perda
    },
    {
        test: (psych) =>
            psych['Relação com Processos'] === 'Criador de processos' ||
            psych['Liderança e Influência'] === 'Político/networker',
        bias: BIASES[5], // Autoridade
    },
];

function deriveBias(profile) {
    const psych = profile.psicologia_comportamento || {};
    const ctx = profile.contexto || {};
    for (const rule of RULES) {
        if (rule.test(psych, ctx)) return rule.bias;
    }
    return BIASES[djb2(profile.id) % BIASES.length];
}

function toCompact(profile) {
    const info = profile.informacoes_basicas || {};
    const psych = profile.psicologia_comportamento || {};
    const ctx = profile.contexto || {};
    return {
        id: profile.id,
        nome: info.nome,
        cargo: info.cargo,
        area: info.area,
        estilo_comunicacao: psych['Estilo de Comunicação'],
        abordagem_trabalho: psych['Abordagem ao Trabalho'],
        gestao_conflitos: psych['Gestão de Conflitos'],
        gestao_estresse: psych['Gestão de Estresse'],
        opiniao_agil: ctx.opiniao_agil,
        desafio_atual: ctx.desafio_atual,
        motivacao: ctx.motivacao_atual,
        framework_preferido: ctx.framework_preferido,
        vies_cognitivo: deriveBias(profile),
    };
}

const full = JSON.parse(readFileSync(SRC, 'utf8'));
const compact = full.map(toCompact);
writeFileSync(OUT, JSON.stringify(compact, null, 2) + '\n');
console.log(`Wrote ${compact.length} personas to ${path.relative(ROOT, OUT)}`);
