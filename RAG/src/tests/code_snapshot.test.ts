import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
const snapshot = await import('../services/CodeSnapshot.js').catch(() => null);
assert.ok(snapshot, 'local uncommitted sources need a separate version fingerprint');
const root = mkdtempSync(join(tmpdir(), 'framesim-code-snapshot-'));
try {
    mkdirSync(join(root, 'services'));
    writeFileSync(join(root, 'services', 'work.ts'), 'export const work = 1;');
    const first = snapshot.fingerprintSources(root);
    assert.match(first, /^[a-f0-9]{64}$/);
    writeFileSync(join(root, '.env'), 'PRIVATE_SENTINEL=changed');
    assert.equal(snapshot.fingerprintSources(root), first, 'credential files never participate in code snapshots');
    writeFileSync(join(root, 'services', 'new.ts'), 'export const extra = 2;');
    assert.notEqual(snapshot.fingerprintSources(root), first, 'new untracked modules affect the snapshot');
    const second = snapshot.fingerprintSources(root);
    writeFileSync(join(root, 'services', 'work.ts'), 'export const work = 3;');
    assert.notEqual(snapshot.fingerprintSources(root), second);
} finally {
    if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe test cleanup');
    rmSync(root, { recursive: true, force: true });
}
console.log('  ✓ source fingerprint captures local code changes and excludes credential files');
