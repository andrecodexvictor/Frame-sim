import JSZip from 'jszip';
import { ARTICLE_PREAMBLE, FLOWCHART_TIKZ } from '../data/article_template';
import { latexEscape as escape, csvCell } from './latexEscape';
import { publicArtifact, type ReportData, type ReportMetric } from './reportData';
import { flowchartSVG, flowchartMermaid } from './flowchartExport';
const number = (value: number | null | undefined): string => value === null || value === undefined ? 'unavailable' : String(value);
const numeric = (value: number): string => { if (!Number.isFinite(value)) throw new Error('Non-finite plot value'); return String(value); };
export function reportCSV(report: ReportData): string {
    const columns: Array<keyof ReportMetric> = ['key', 'id', 'label', 'group', 'runId', 'conditionId', 'replicaId', 'personaId', 'turnId', 'timeUnit', 'value', 'unit', 'source', 'status', 'nIndependent', 'nExcluded', 'method', 'numerator', 'denominator', 'coverage', 'missingReason', 'taskId', 'classId', 'censored'];
    return [[...columns, 'interval95_lower', 'interval95_upper', 'evidenceIds'].map(csvCell).join(','), ...report.metrics.map(row => [...columns.map(column => row[column]), row.interval95?.[0] ?? null, row.interval95?.[1] ?? null, JSON.stringify(row.evidenceIds ?? [])].map(csvCell).join(','))].join('\n');
}
function metricsTable(metrics: ReportMetric[]): string {
    const rows = metrics.map(row => String.raw`${escape(row.label)} & ${escape(row.group)} & ${escape(number(row.value))} & ${escape(row.unit)} & ${escape(row.interval95 ? `${row.interval95[0]} to ${row.interval95[1]}` : 'unavailable')} & ${escape(row.nIndependent ?? '')} \\`).join('\n');
    return String.raw`\begingroup\scriptsize
\begin{longtable}{p{.23\linewidth}p{.12\linewidth}p{.16\linewidth}p{.18\linewidth}p{.16\linewidth}r}
\caption{Canonical metrics. Full precision is preserved; unavailable values are not zero.}\\
\toprule Measure & Scope & Value & Unit & 95\% interval & $n$ \\
\midrule\endfirsthead
\toprule Measure & Scope & Value & Unit & 95\% interval & $n$ \\
\midrule\endhead
${rows}
\bottomrule
\end{longtable}\endgroup`;
}
function plotFigure(metrics: ReportMetric[], title: string, xLabel: string, unit: string, category: boolean): string {
    const labels = metrics.map((row, index) => `${index + 1}: ${row.label}`).join('; ');
    const points = metrics.map((row, index) => {
        const x = category ? index + 1 : row.turnId ?? index + 1;
        return row.value === null ? `(${x},nan)` : `(${x},${numeric(row.value)})${row.interval95 ? ` += (0,${numeric(row.interval95[1] - row.value)}) -= (0,${numeric(row.value - row.interval95[0])})` : ''}`;
    }).join(' ');
    return String.raw`\begin{tikzpicture}
\begin{axis}[width=.94\linewidth,height=6cm,xlabel={${escape(xLabel)}},ylabel={${escape(unit)}},title={${escape(title)}},grid=major,unbounded coords=jump,scaled ticks=false,tick label style={font=\small}]
\addplot+[${category ? 'only marks' : 'mark=*'},error bars/.cd,y dir=both,y explicit] coordinates {${points}};
\end{axis}
\end{tikzpicture}
${category ? String.raw`\par{\scriptsize ${escape(labels)}}` : ''}
\par{\scriptsize Source: ${escape([...new Set(metrics.map(row => row.source))].join(', '))}.}\par`;
}
export function createArticleFiles(source: ReportData): Record<string, string> {
    const report = publicArtifact(source), files: Record<string, string> = {};
    files['metrics.json'] = JSON.stringify(report, null, 2);
    files['manifest.json'] = JSON.stringify({ schemaVersion: report.schemaVersion, mode: report.mode, empiricalValidation: report.empiricalValidation, selectionProtocol: report.selectionProtocol, config: report.config, runs: report.runs.map(({ narrative: _narrative, traces: _traces, individualEvaluations: _evaluations, ...run }) => run), limitations: report.limitations }, null, 2);
    files['data/metrics.csv'] = reportCSV(report);
    files['data/traces.json'] = JSON.stringify(report.runs.map(run => ({ runId: run.id, traces: run.traces, individualEvaluations: run.individualEvaluations })), null, 2);
    files['data/runs.csv'] = [['runId', 'conditionId', 'replicaId', 'label', 'status', 'source', 'timeUnit', 'errorCode'].map(csvCell).join(','), ...report.runs.map(run => [run.id, run.conditionId, run.replicaId, run.label, run.status, run.source, run.timeUnit, run.errorCode].map(csvCell).join(','))].join('\n');
    files['tables/metrics.tex'] = metricsTable(report.metrics);
    files['figures/flowchart.tex'] = FLOWCHART_TIKZ;
    files['figures/flowchart.svg'] = flowchartSVG();
    files['figures/flowchart.mmd'] = flowchartMermaid();
    files['methodology.tex'] = String.raw`\section{Methodology}
This report uses the same canonical values as the application, with no export-time metric recomputation. Run manifests record scenario seeds, model identities, dataset and rubric hashes, code revision, isolation policy and execution status where available. Remote model responses are not guaranteed to be byte-reproducible.

Delivery and quality require attributed task evidence and denominators. Stress and energy are contextual states. Typed and generative judgments are separate from deterministic measurements. Missing evidence leads to unavailable values or abstention.

Independent-run means use sample variance and a Student $t$ interval when $n\geq2$. Paired deltas re-sample complete replica pairs. Fixtures, degraded runs, failures and incompatible pairs are excluded from inferential estimates and remain in the manifest. No mixed-scale composite selects a winner.

Selection protocol: ${escape(report.selectionProtocol)}. Validation status: ${escape(report.empiricalValidation)}. The export does not establish agreement with observed employee outcomes. Development, calibration and holdout require independent cohorts before empirical claims can be made.`;
    files['limitations.tex'] = `\\section{Limitations}\n\\begin{itemize}\n${report.limitations.map(item => `\\item ${escape(item)}`).join('\n')}\n\\end{itemize}`;
    files['references.bib'] = String.raw`@misc{framesim,
  title = {FrameSIM: Enterprise Framework Simulator},
  howpublished = {Versioned simulation artifacts and protocol},
  note = {Synthetic results; empirical validation pending}
}
@misc{jevdocs,
  title = {TypeSafe System One API},
  howpublished = {\url{https://docs.typesafe.ai}},
  note = {Typed judgments are distinct from deterministic measurements}
}
`;
    const figureNames: string[] = [];
    const groups = new Map<string, ReportMetric[]>();
    for (const row of report.metrics.filter(row => ['run', 'individual', 'semantic', 'aggregate', 'delta', 'auxiliary'].includes(row.group))) {
        const key = JSON.stringify([row.group, row.id, row.unit]); groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    for (const values of groups.values()) {
        if (!values.some(row => row.value !== null)) continue;
        const name = `figures/metric-${figureNames.length + 1}.tex`; figureNames.push(name);
        files[name] = plotFigure(values, `${values[0].group}: ${values[0].id}`, 'Series index (see key below)', values[0].unit, true);
    }
    const durations = new Map<string, ReportMetric[]>();
    for (const row of report.metrics.filter(row => row.group === 'task-duration' && row.status === 'accepted')) { const key = JSON.stringify([row.runId, row.personaId, row.classId]); durations.set(key, [...(durations.get(key) ?? []), row]); }
    for (const values of durations.values()) {
        if (!values.some(row => row.value !== null)) continue;
        const name = `figures/metric-${figureNames.length + 1}.tex`; figureNames.push(name);
        files[name] = plotFigure(values, `Accepted-task duration: ${values[0].personaId} / ${values[0].classId}`, 'Task index; conditional on acceptance, censored tasks excluded', 'hours', true);
    }
    for (const run of report.runs) for (const id of ['roi', 'adoptionRate', 'compliance', 'efficiency']) {
        const values = report.metrics.filter(row => row.runId === run.id && row.group === 'timeline' && row.id === id).sort((a, b) => a.turnId! - b.turnId!);
        if (!values.some(row => row.value !== null)) continue;
        const name = `figures/metric-${figureNames.length + 1}.tex`; figureNames.push(name);
        files[name] = plotFigure(values, `${run.label}: ${id}`, run.timeUnit, values[0].unit, false);
    }
    for (const timeUnit of ['month', 'turn']) for (const id of ['roi', 'adoptionRate', 'compliance', 'efficiency']) {
        const values = report.metrics.filter(row => row.group === 'aggregate-timeline' && row.id === id && row.timeUnit === timeUnit).sort((a, b) => a.turnId! - b.turnId!);
        if (!values.some(row => row.value !== null)) continue;
        const name = `figures/metric-${figureNames.length + 1}.tex`; figureNames.push(name);
        files[name] = plotFigure(values, `Batch mean: ${id}`, timeUnit, values[0].unit, false);
    }
    files['article.tex'] = `${ARTICLE_PREAMBLE}\\title{${escape(report.title)}}\n\\begin{document}\n\\maketitle\n\\noindent Source and validation status are recorded per run. Unavailable dimensions remain missing.\\par\n\\input{methodology.tex}\n\\input{limitations.tex}\n\\clearpage\n\\section{Flowchart}\n\\begin{center}\\input{figures/flowchart.tex}\\end{center}\n\\clearpage\n\\section{Metrics}\n\\input{tables/metrics.tex}\n\\clearpage\n\\section{Native figures}\n${figureNames.map(name => `\\begin{figure}[htbp]\\centering\n\\input{${name}}\n\\caption{${escape(name)}. Source: recorded simulation artifacts; missing values are gaps.}\\end{figure}\n\\clearpage`).join('\n')}\n\\end{document}\n`;
    files['README.md'] = `# FrameSIM native article export\n\nCompile article.tex with LuaLaTeX (recommended for Unicode), without shell escape or network access. Requires standard TikZ, PGFPlots, booktabs and longtable packages. Do not enable shell-escape. All paths are relative and fixed by the exporter.\n\nmetrics.json is the canonical report; CSV preserves full numerical precision and blanks for unavailable values. TeX uses “unavailable”, never a fabricated zero. Figures are native PGFPlots/TikZ source; no screenshot digitization is used. Error bars preserve asymmetric bounds. Data and trajectories are in data/. All failures and selection trials remain recorded.\n\nValidation is pending. Synthetic fixtures and model judgments do not establish real-world fidelity. No PDF is included unless a compiler has actually verified this package.\n`;
    return files;
}
export function createStandaloneArticle(report: ReportData): string {
    const files = createArticleFiles(report);
    return files['article.tex'].replace(/\\input\{([^}]+)\}/g, (_, name: string) => { if (!(name in files)) throw new Error('Unknown template input'); return files[name]; });
}
export async function createArticleZip(report: ReportData, subset: 'article' | 'snippets' | 'data' = 'article'): Promise<Uint8Array> {
    const archive = new JSZip();
    for (const [name, content] of Object.entries(createArticleFiles(report))) if (subset === 'article' || (subset === 'snippets' && /^(figures|tables|data)\//.test(name)) || (subset === 'data' && /^data\//.test(name)) || ['README.md', 'manifest.json', 'metrics.json', 'methodology.tex', 'limitations.tex', 'references.bib'].includes(name)) archive.file(name, content, { date: new Date('2026-10-04T00:00:00Z') });
    return archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
export async function downloadArticle(report: ReportData, format: 'article' | 'source' | 'snippets' | 'data' = 'article'): Promise<void> {
    const content = format === 'source' ? createStandaloneArticle(report) : await createArticleZip(report, format);
    const blob = new Blob([typeof content === 'string' ? content : new Uint8Array(content).buffer], { type: format === 'source' ? 'application/x-tex;charset=utf-8' : 'application/zip' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `framesim-${report.mode}-${format}.${format === 'source' ? 'tex' : 'zip'}`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
