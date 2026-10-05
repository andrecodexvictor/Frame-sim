import { FLOWCHART_NODES, FLOWCHART_EDGES, FLOWCHART_SIZE, FLOWCHART_DESCRIPTION } from '../data/simulationFlowchart';
import { latexEscape } from './latexEscape';
const xml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
export function flowchartSVG(instance = 'framesim'): string {
    const prefix = instance.replace(/[^a-zA-Z0-9_-]/g, '') || 'framesim';
    const { width, height } = FLOWCHART_SIZE;
    const edges = FLOWCHART_EDGES.map(edge => `<polyline fill="none" stroke="#333" stroke-width="1.5" points="${edge.points.map(point => point.join(',')).join(' ')}" marker-end="url(#${prefix}-arrow)"/>${edge.label && edge.labelAt ? `<text x="${edge.labelAt[0]}" y="${edge.labelAt[1]}" text-anchor="middle" font-weight="700">${edge.label}</text>` : ''}`).join('\n');
    const nodes = FLOWCHART_NODES.map(node => {
        const shape = node.kind === 'decision'
            ? `<polygon points="${node.x},${node.y - node.height / 2} ${node.x + node.width / 2},${node.y} ${node.x},${node.y + node.height / 2} ${node.x - node.width / 2},${node.y}"/>`
            : `<rect x="${node.x - node.width / 2}" y="${node.y - node.height / 2}" width="${node.width}" height="${node.height}" rx="${node.kind === 'terminal' ? node.height / 2 : 0}"/>`;
        const text = node.lines.map((line, index) => `<tspan x="${node.x}" y="${node.y - (node.lines.length - 1) * 10 + index * 20 + 5}">${xml(line)}</tspan>`).join('');
        return `<g data-node="${node.id}"><g fill="#dedede" stroke="#333" stroke-width="1.5">${shape}</g><text text-anchor="middle" font-weight="600">${text}</text></g>`;
    }).join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${prefix}-title ${prefix}-desc"><title id="${prefix}-title">Fluxograma do FrameSIM</title><desc id="${prefix}-desc">${xml(FLOWCHART_DESCRIPTION)}</desc><defs><marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#333"/></marker></defs><rect width="${width}" height="${height}" fill="white"/><g font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#171717">${edges}\n${nodes}</g></svg>`;
}
export function flowchartTikz(): string {
    const shapes = FLOWCHART_NODES.map(node => {
        const style = 'fill=black!12,draw=black!75,line width=.45pt';
        const outline = node.kind === 'decision'
            ? `\\filldraw[${style}] (${node.x},${node.y - node.height / 2}) -- (${node.x + node.width / 2},${node.y}) -- (${node.x},${node.y + node.height / 2}) -- (${node.x - node.width / 2},${node.y}) -- cycle;`
            : `\\filldraw[${style}${node.kind === 'terminal' ? ',rounded corners=4mm' : ''}] (${node.x - node.width / 2},${node.y - node.height / 2}) rectangle (${node.x + node.width / 2},${node.y + node.height / 2});`;
        const textWidth = (node.width * .02 - (node.kind === 'decision' ? .75 : .2)).toFixed(2);
        return `${outline}\n\\node[align=center,text width=${textWidth}cm,font=\\scriptsize,inner sep=0pt] at (${node.x},${node.y}) {${node.lines.map(latexEscape).join('\\\\')}};`;
    }).join('\n');
    const edges = FLOWCHART_EDGES.map(edge => `\\draw[-{Latex[length=1.6mm]},draw=black!75,line width=.45pt] ${edge.points.map(point => `(${point.join(',')})`).join(' -- ')};${edge.label && edge.labelAt ? `\n\\node[font=\\scriptsize\\bfseries,inner sep=0pt] at (${edge.labelAt.join(',')}) {${edge.label}};` : ''}`).join('\n');
    return `\\begin{tikzpicture}[x=.02cm,y=-.02cm]\n${edges}\n${shapes}\n\\end{tikzpicture}`;
}
export function flowchartMermaid(): string {
    const nodes = FLOWCHART_NODES.map(node => {
        const label = node.lines.join('<br/>');
        const shape = node.kind === 'decision' ? `{"${label}"}` : node.kind === 'terminal' ? `(["${label}"])` : `["${label}"]`;
        return `    ${node.id}${shape}`;
    });
    return ['flowchart TD', ...nodes, ...FLOWCHART_EDGES.map(edge => `    ${edge.from} -->${edge.label ? `|${edge.label}|` : ''} ${edge.to}`), '    classDef step fill:#dedede,stroke:#333,color:#171717;', `    class ${FLOWCHART_NODES.map(node => node.id).join(',')} step;`, ''].join('\n');
}
