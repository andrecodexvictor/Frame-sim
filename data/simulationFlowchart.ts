/** Static protocol diagram, shared by the UI and exports; never a live run. */
export type FlowNode = { id: string; kind: 'terminal' | 'process' | 'decision'; x: number; y: number; width: number; height: number; lines: string[] };
export type FlowEdge = { from: string; to: string; points: Array<[number, number]>; label?: 'Sim' | 'Não'; labelAt?: [number, number] };
export const FLOWCHART_SIZE = { width: 760, height: 1088 };
export const FLOWCHART_DESCRIPTION = 'Fluxo do FrameSIM. Sem evidência atribuída, registrar indisponibilidade e abster-se. Com evidência, medir e avaliar; aceitar julgamentos apenas com evidência e calibração suficientes. Resultados e limitações alimentam o dashboard e as exportações.';
export const FLOWCHART_NODES: FlowNode[] = [
    { id: 'start', kind: 'terminal', x: 380, y: 28, width: 152, height: 42, lines: ['Início'] },
    { id: 'config', kind: 'process', x: 380, y: 106, width: 252, height: 58, lines: ['Configurar cenário, equipe', 'e rubrica versionada'] },
    { id: 'protocol', kind: 'process', x: 380, y: 184, width: 252, height: 58, lines: ['Registrar manifesto e seeds', 'Parear equipe e choques'] },
    { id: 'trace', kind: 'process', x: 380, y: 266, width: 252, height: 68, lines: ['Simular e registrar traços', 'personaId / turnId / eventId'] },
    { id: 'evidence', kind: 'decision', x: 380, y: 366, width: 230, height: 112, lines: ['Há evidência', 'atribuída?'] },
    { id: 'missing', kind: 'process', x: 128, y: 366, width: 208, height: 60, lines: ['Registrar indisponível', 'sem inventar uma nota'] },
    { id: 'metrics', kind: 'process', x: 632, y: 366, width: 208, height: 60, lines: ['Medir por persona', 'com denominadores'] },
    { id: 'judges', kind: 'process', x: 380, y: 480, width: 252, height: 68, lines: ['Jev: julgamento tipado', 'Gemini / DeepSeek: geração', 'GLM / Kimi: juiz distinto'] },
    { id: 'calibration', kind: 'decision', x: 380, y: 596, width: 230, height: 112, lines: ['Evidência e calibração', 'suficientes?'] },
    { id: 'abstain', kind: 'process', x: 128, y: 596, width: 208, height: 68, lines: ['Abstenção', 'Revisão independente', 'quando disponível'] },
    { id: 'accept', kind: 'process', x: 632, y: 596, width: 208, height: 68, lines: ['Aceitar julgamento', 'com origem e cobertura'] },
    { id: 'compare', kind: 'process', x: 380, y: 724, width: 252, height: 68, lines: ['Individual / comparação / lote', 'Réplicas pareadas, ICs', 'e exclusões identificadas'] },
    { id: 'report', kind: 'process', x: 380, y: 806, width: 252, height: 58, lines: ['ReportData canônico', 'Evidências e limitações'] },
    { id: 'dashboard', kind: 'process', x: 380, y: 888, width: 252, height: 58, lines: ['Exibir no dashboard', 'Dados sintéticos identificados'] },
    { id: 'export', kind: 'process', x: 380, y: 970, width: 252, height: 58, lines: ['Exportar artigo e dados', 'LaTeX / PGFPlots / CSV / ZIP'] },
    { id: 'finish', kind: 'terminal', x: 380, y: 1052, width: 152, height: 42, lines: ['Fim'] },
];
export const FLOWCHART_EDGES: FlowEdge[] = [
    { from: 'start', to: 'config', points: [[380, 49], [380, 77]] },
    { from: 'config', to: 'protocol', points: [[380, 135], [380, 155]] },
    { from: 'protocol', to: 'trace', points: [[380, 213], [380, 232]] },
    { from: 'trace', to: 'evidence', points: [[380, 300], [380, 310]] },
    { from: 'evidence', to: 'missing', points: [[265, 366], [232, 366]], label: 'Não', labelAt: [248, 349] },
    { from: 'evidence', to: 'metrics', points: [[495, 366], [528, 366]], label: 'Sim', labelAt: [512, 349] },
    { from: 'missing', to: 'abstain', points: [[128, 396], [128, 562]] },
    { from: 'metrics', to: 'judges', points: [[632, 396], [632, 480], [506, 480]] },
    { from: 'judges', to: 'calibration', points: [[380, 514], [380, 540]] },
    { from: 'calibration', to: 'abstain', points: [[265, 596], [232, 596]], label: 'Não', labelAt: [248, 579] },
    { from: 'calibration', to: 'accept', points: [[495, 596], [528, 596]], label: 'Sim', labelAt: [512, 579] },
    { from: 'abstain', to: 'compare', points: [[128, 630], [128, 664], [380, 664], [380, 690]] },
    { from: 'accept', to: 'compare', points: [[632, 630], [632, 676], [380, 676], [380, 690]] },
    { from: 'compare', to: 'report', points: [[380, 758], [380, 777]] },
    { from: 'report', to: 'dashboard', points: [[380, 835], [380, 859]] },
    { from: 'dashboard', to: 'export', points: [[380, 917], [380, 941]] },
    { from: 'export', to: 'finish', points: [[380, 999], [380, 1031]] },
];
