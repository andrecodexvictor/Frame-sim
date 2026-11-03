import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
/** Explicit code/build inputs only. Credential files and run artifacts are excluded by construction. */
export function fingerprintSources(root: string): string {
    const files: string[] = [];
    const walk = (folder: string) => {
        if (!existsSync(folder)) return;
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            const path = join(folder, entry.name);
            if (entry.isDirectory() && !['node_modules', 'dist'].includes(entry.name)) walk(path);
            else if (entry.isFile() && /\.(?:ts|tsx|js|mjs|json|css|html)$/.test(entry.name)) files.push(path);
        }
    };
    for (const folder of ['services', 'components', 'data', 'RAG/src', 'RAG/evals/rubrics']) walk(join(root, folder));
    for (const file of ['App.tsx', 'index.tsx', 'index.html', 'index.css', 'types.ts', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json', 'RAG/package.json', 'RAG/package-lock.json', 'RAG/tsconfig.json']) if (existsSync(join(root, file))) files.push(join(root, file));
    const hash = createHash('sha256');
    for (const path of files.sort((a,b) => { const left = relative(root,a).replaceAll('\\','/'), right = relative(root,b).replaceAll('\\','/'); return left < right ? -1 : left > right ? 1 : 0; })) {
        hash.update(relative(root, path).replaceAll('\\','/')); hash.update('\0');
        // Normalize checkout line endings so the same code has the same fingerprint across OSes.
        hash.update(readFileSync(path, 'utf8').replaceAll('\r\n', '\n')); hash.update('\0');
    }
    return hash.digest('hex');
}
