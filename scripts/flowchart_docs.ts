import { writeFile } from 'node:fs/promises';
import { flowchartSVG, flowchartTikz, flowchartMermaid } from '../services/flowchartExport';
import { ARTICLE_PREAMBLE } from '../data/article_template';
await writeFile('next_steps/framesim_flowchart.mmd', flowchartMermaid());
await writeFile('next_steps/framesim_flowchart.svg', flowchartSVG());
await writeFile('next_steps/framesim_flowchart.tex', `${ARTICLE_PREAMBLE}\\title{FrameSIM: fluxo da simulação e das avaliações}\n\\begin{document}\n\\maketitle\nEste diagrama descreve o processo implementado, não uma execução nem validação empírica. Os provedores são opcionais; chamadas remotas dependem da configuração e do orçamento autorizado.\n\\clearpage\n\\section*{Fluxograma}\n\\begin{center}\n${flowchartTikz()}\n\\end{center}\n\\end{document}\n`);
console.log('Shared flowchart exported to next_steps: SVG, Mermaid and standalone TikZ.');
