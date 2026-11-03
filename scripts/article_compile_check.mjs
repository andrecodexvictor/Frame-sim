import { spawnSync } from 'node:child_process';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, basename, join } from 'node:path';
const root = resolve('artifacts/qa/article-fixtures');
const engines = ['lualatex', 'pdflatex'];
const available = engines.find(engine => spawnSync(engine, ['--version'], { windowsHide: true, timeout: 5000, stdio: 'ignore' }).status === 0);
const result = { schemaVersion: 1, status: available ? 'running' : 'unavailable', engine: available ?? null, files: [], limitation: available ? null : 'No supported local TeX compiler is available. The integrated editor compiler previously failed during environment initialization. Sources remain editable; compilation and PDF layout are not verified.' };
if (available) {
    const targets = [];
    for (const mode of ['individual', 'comparison', 'batch']) {
        targets.push(join(root, mode, 'article.tex'), join(root, `${mode}.tex`));
        for (const name of await readdir(join(root, mode, 'standalone'))) targets.push(join(root, mode, 'standalone', name));
    }
    for (const path of targets) {
        // No shell, network helper or shell-escape; only exporter-owned fixed paths are compiled.
        const call = spawnSync(available, ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', basename(path)], { cwd: dirname(path), windowsHide: true, timeout: 60000, encoding: 'utf8', maxBuffer: 5e6, env: { ...process.env, openin_any: 'p', openout_any: 'p' } });
        result.files.push({ path, status: call.status === 0 ? 'compiled' : 'failed', exitCode: call.status, diagnostic: call.status === 0 ? null : String(call.stdout ?? call.error?.message ?? '').slice(-2500) });
    }
    result.status = result.files.every(file => file.status === 'compiled') ? 'compiled' : 'failed';
}
await mkdir(root, { recursive: true }); await writeFile(join(root, 'compilation.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (result.status === 'failed' || (result.status === 'unavailable' && process.argv.includes('--require-compiler'))) process.exitCode = 1;
