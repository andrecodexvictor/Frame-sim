import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MOCK_SIMULATION_RESULT } from '../services/mockData';
import { buildReportData } from '../services/reportData';
const controls = await import('../components/ArticleExportControls').catch(() => null);
assert.ok(controls, 'article downloads must be available in every mode');
for (const mode of ['individual', 'comparison', 'batch'] as const) {
    const report = buildReportData({ mode, outputs: [MOCK_SIMULATION_RESULT] });
    const markup = renderToStaticMarkup(<controls.ArticleExportControls report={report} />);
    assert.ok(markup.includes('Artigo LaTeX'));
    assert.ok(markup.includes('Fonte única') && markup.includes('Gráficos e tabelas') && markup.includes('Dados'));
    let clicked = false, blob: Blob | undefined;
    const previousDocument = globalThis.document;
    const originalCreate = URL.createObjectURL;
    (globalThis as any).document = { createElement: () => ({ click: () => { clicked = true; } }) };
    URL.createObjectURL = value => { blob = value as Blob; return 'blob:fixture'; };
    try { await (await import('../services/articleExport')).downloadArticle(report); }
    finally { (globalThis as any).document = previousDocument; URL.createObjectURL = originalCreate; }
    assert.ok(clicked && blob?.type === 'application/zip');
    const archive = await (await import('jszip')).default.loadAsync(await blob!.arrayBuffer());
    assert.equal(JSON.parse(await archive.file('manifest.json')!.async('string')).mode, mode);
}
console.log('  ✓ all report modes expose and download complete native article packages');
