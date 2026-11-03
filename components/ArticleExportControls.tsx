import React, { useState } from 'react';
import type { ReportData } from '../services/reportData';
import { SimulationFlowchart } from './SimulationFlowchart';
export const ArticleExportControls: React.FC<{ report: ReportData }> = ({ report }) => {
    const [format, setFormat] = useState<'article' | 'source' | 'snippets' | 'data'>('article');
    const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
    const download = async () => {
        setBusy(true); setError(null);
        try { await (await import('../services/articleExport')).downloadArticle(report, format); }
        catch { setError('Não foi possível preparar a exportação. Tente novamente.'); }
        finally { setBusy(false); }
    };
    return <section aria-label="Exportação para artigo" className="border border-zinc-500/40 rounded p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3"><label className="text-sm font-medium flex flex-wrap items-center gap-3">Artigo LaTeX<select aria-label="Formato do artigo" value={format} onChange={event => setFormat(event.target.value as typeof format)} className="min-h-11 border border-zinc-500 rounded bg-inherit px-3 py-2 focus-visible:outline"><option value="article">Pacote completo (.zip)</option><option value="source">Fonte única (.tex)</option><option value="snippets">Gráficos e tabelas (.zip)</option><option value="data">Dados (.zip)</option></select></label><button type="button" disabled={busy} onClick={download} className="min-h-11 border border-zinc-500 rounded px-4 py-2 font-semibold text-sm hover:bg-zinc-500/15 focus-visible:outline disabled:opacity-50">{busy ? 'Preparando…' : 'Exportar artigo'}</button></div>
        <p className="text-xs leading-relaxed">Os gráficos e tabelas conservam os dados desta tela, incluindo valores ausentes e limitações. O pacote inclui fonte editável, dados, manifesto e fluxograma. Validação empírica pendente.</p>
        {error && <p role="alert" className="text-sm">{error}</p>}
        <SimulationFlowchart />
    </section>;
};
