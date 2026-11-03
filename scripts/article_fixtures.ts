import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { MOCK_SIMULATION_RESULT } from '../services/mockData';
import { buildReportData } from '../services/reportData';
import { createArticleFiles, createStandaloneArticle, createArticleZip } from '../services/articleExport';
import { ARTICLE_PREAMBLE } from '../data/article_template';
const root = resolve('artifacts/qa/article-fixtures');
const output = { ...MOCK_SIMULATION_RESULT, frameworkName: 'Fixture & precisão', summary: { ...MOCK_SIMULATION_RESULT.summary, totalRoi: -12.345678901, finalAdoption: null } };
for (const mode of ['individual', 'comparison', 'batch'] as const) {
    const report = buildReportData({ mode, outputs: [output] });
    for (const [name, text] of Object.entries(createArticleFiles(report))) {
        const path = resolve(root, mode, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, text);
        if (/^(figures|tables)\/.*\.tex$/.test(name)) {
            const standalone = resolve(root, mode, 'standalone', name.replaceAll('/', '-'));
            await mkdir(dirname(standalone), { recursive: true }); await writeFile(standalone, `${ARTICLE_PREAMBLE}\\begin{document}\n${text}\n\\end{document}`);
        }
    }
    await writeFile(resolve(root, `${mode}.tex`), createStandaloneArticle(report));
    await writeFile(resolve(root, `${mode}.zip`), await createArticleZip(report));
}
console.log(`Article fixtures saved: ${root}`);
