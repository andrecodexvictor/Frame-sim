import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const candidates = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
async function bundleFiles(folder) {
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? bundleFiles(path.join(folder, entry.name)) : [path.relative(root, path.join(folder, entry.name))]))).flat();
}
candidates.push(...await bundleFiles(path.join(root, 'dist')));
const findings = [], seen = new Set();
for (const file of candidates) {
    if (seen.has(file)) continue;
    seen.add(file);
    if (/(^|[\\/])\.env$/.test(file)) { findings.push({ file, reason: 'Credential file is versionable' }); continue; }
    const content = await readFile(path.join(root, file), 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
    // Never include matching values in diagnostics.
    if (/(?:apikey_[a-zA-Z0-9_]{40,}|nvapi-[a-zA-Z0-9_-]{40,}|AQ\.Ab[a-zA-Z0-9_-]{30,}|AIza[a-zA-Z0-9_-]{30,}|sk-[a-zA-Z0-9_-]{40,})/.test(content)) findings.push({ file, reason: 'Long credential pattern detected' });
}
const result = { schemaVersion: 1, scannedFiles: seen.size, findings, status: findings.length ? 'failed' : 'passed', limitation: 'Pattern scan is a guard against recognized provider credential shapes, not proof against every possible secret format.' };
await mkdir(path.join(root, 'artifacts/qa'), { recursive: true });
await writeFile(path.join(root, 'artifacts/qa/credential-scan.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (findings.length) process.exitCode = 1;
