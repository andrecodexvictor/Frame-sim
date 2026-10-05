import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

let frontendUrl;
const outputDir = path.resolve(process.env.FRAMESIM_QA_OUTPUT || 'artifacts/qa/report-browser');
const browserCandidates = [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
].filter(Boolean);

async function firstExisting(paths) {
    for (const candidate of paths) {
        try { await access(candidate); return candidate; } catch { /* try next */ }
    }
    throw new Error('No supported Chrome/Edge binary found. Set BROWSER_PATH.');
}

async function waitForEndpoint(url, timeoutMs = 45_000, processState) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (processState?.exitCode !== null && processState?.exitCode !== undefined) throw new Error(`Browser exited before debugging startup (${processState.exitCode})`);
        try {
            const response = await fetch(url);
            if (response.ok) return response.json();
        } catch { /* browser is still starting */ }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for the browser debugging endpoint.');
}

async function getFreePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}

class CDPClient {
    constructor(socket) {
        this.socket = socket;
        this.nextId = 1;
        this.pending = new Map();
        this.waiters = new Map();
        this.events = [];
        socket.addEventListener('message', ({ data }) => {
            const message = JSON.parse(String(data));
            if (message.id) {
                const pending = this.pending.get(message.id);
                if (!pending) return;
                this.pending.delete(message.id); clearTimeout(pending.timer);
                return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
            }
            this.events.push(message);
            const waiters = this.waiters.get(message.method) || [];
            this.waiters.delete(message.method);
            waiters.forEach(resolve => resolve(message.params));
        });
    }

    send(method, params = {}) {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 30000);
            this.pending.set(id, { resolve, reject, timer });
            this.socket.send(JSON.stringify({ id, method, params }));
        });
    }

    event(method, timeoutMs = 15_000) {
        const existing = this.events.find(event => event.method === method);
        if (existing) return Promise.resolve(existing.params);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}.`)), timeoutMs);
            const wrapped = value => { clearTimeout(timer); resolve(value); };
            this.waiters.set(method, [...(this.waiters.get(method) || []), wrapped]);
        });
    }
}

async function evaluate(client, expression) {
    const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser evaluation failed.');
    return result.result?.value;
}

async function waitFor(client, expression, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await evaluate(client, `Boolean(${expression})`)) return;
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`UI condition timed out: ${expression}`);
}

async function screenshot(client, fileName, mobile = false) {
    await client.send('Emulation.setDeviceMetricsOverride', mobile
        ? { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }
        : { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    const metrics = await client.send('Page.getLayoutMetrics');
    const height = Math.min(Math.ceil(metrics.cssContentSize?.height || (mobile ? 844 : 1000)), 5000);
    const capture = await client.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 78,
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: mobile ? 390 : 1440, height, scale: 1 }
    });
    const target = path.join(outputDir, fileName);
    await writeFile(target, Buffer.from(capture.data, 'base64'));
    return target;
}


const frontendPort = await getFreePort();
frontendUrl = `http://127.0.0.1:${frontendPort}/`;
const frontendProcess = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], { cwd: process.cwd(), windowsHide: true, stdio: 'ignore' });
const browserPath = await firstExisting(browserCandidates);
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'framesim-report-browser-'));
const debuggingPort = await getFreePort();
await mkdir(outputDir, { recursive: true });
const browserProcess = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${debuggingPort}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
let browserDiagnostics = '';
browserProcess.stderr.on('data', chunk => { browserDiagnostics = (browserDiagnostics + chunk.toString()).slice(-4000); });
let socket, client;
const checks = [];
try {
    try { await waitForEndpoint(`http://127.0.0.1:${debuggingPort}/json/version`, 45_000, browserProcess); }
    catch (error) { throw new Error(`${error.message}; ${browserDiagnostics || 'browser emitted no diagnostic'}`); }
    const target = await fetch(`http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' }).then(response => response.json());
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    client = new CDPClient(socket);
    await Promise.all([client.send('Page.enable'), client.send('Runtime.enable'), client.send('Log.enable')]);
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `
        window.__downloads = []; window.__blobs = new Map(); window.__inferenceAttempts = 0;
        const create = URL.createObjectURL.bind(URL);
        URL.createObjectURL = blob => { const url = create(blob); window.__blobs.set(url, blob); return url; };
        HTMLAnchorElement.prototype.click = function() { if (this.download) window.__downloads.push({ name: this.download, blob: window.__blobs.get(this.href) }); };
        const nativeFetch = window.fetch.bind(window);
        window.fetch = (url, init) => { if (String(url).includes('/api/generate') || String(url).includes('/api/simulate')) window.__inferenceAttempts++; return String(url).includes('/api/') ? Promise.resolve(new Response(JSON.stringify({ available: false, ready: false, mode: 'offline-browser-fixture' }), { headers: { 'Content-Type': 'application/json' } })) : nativeFetch(url, init); };
    ` });
    let online = false;
    for (let attempt = 0; attempt < 100; attempt++) {
        try { if ((await fetch(frontendUrl)).ok) { online = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!online) throw new Error('Owned Vite test server did not start');
    await client.send('Page.navigate', { url: frontendUrl });
    await waitFor(client, `document.querySelector('#framework-name')`, 20000);
    await evaluate(client, `(async () => {
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const ReactDOM = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
        const { MOCK_SIMULATION_RESULT } = await import('/services/mockData.ts');
        const { deriveInitialBrain } = await import('/RAG/src/core/employeeBrainCore.ts');
        const { evaluateIndividualMetrics } = await import('/RAG/src/services/IndividualMetrics.ts');
        const { simulateWorkBlock, resolveWorkPolicy } = await import('/RAG/src/core/syntheticWork.ts');
        const { browserArtifactHash } = await import('/services/clientRunManifest.ts');
        const { buildReportData } = await import('/services/reportData.ts');
        const { summarizeOutputs } = await import('/services/batchService.ts');
        const { Dashboard } = await import('/components/Dashboard.tsx');
        const { ComparisonDashboard } = await import('/components/ComparisonDashboard.tsx');
        const { BatchResultsChart } = await import('/components/BatchResultsChart.tsx');
        const { ArticleExportControls } = await import('/components/ArticleExportControls.tsx');
        const { IndividualEvaluationPanel } = await import('/components/IndividualEvaluationPanel.tsx');
        document.querySelector('#root').style.display = 'none';
        const mount = document.createElement('div'); document.body.append(mount); const root = ReactDOM.createRoot(mount);
        const state = deriveInitialBrain({ id: 'person-a', nome: 'Pessoa sintética', cargo: 'Engineer' }, 71);
        const policy = resolveWorkPolicy({ defectProbability: 0 });
        const traces = simulateWorkBlock([{ runId: 'browser-run', personaId: 'person-a', turnId: 1, role: 'Engineer', before: state, after: state, tasks: [], source: 'synthetic', events: [{ eventId: 'browser-e1', personaId: 'person-a', turnId: 1, type: 'transition', text: 'Synthetic context recorded.', source: 'synthetic', kind: 'state-transition' }] }], { seed: 71, policy });
        const output = { ...MOCK_SIMULATION_RESULT, frameworkName: 'Fixture de artigo', timeUnit: 'turn', summary: { ...MOCK_SIMULATION_RESULT.summary, totalRoi: -12.345678901, finalAdoption: null, maturityScore: null, monthsToComplete: null }, timeline: [{ month: 1, adoptionRate: null, roi: null, efficiency: 80, compliance: null }], keyPersonas: [{ id: 'person-a', name: state.nome, role: state.cargo, archetype: 'synthetic', sentiment: 50, impact: 'Recorded context only.' }], personaTraces: traces, individualEvaluations: evaluateIndividualMetrics(traces), execution: { mode: 'fixture', provider: 'none', model: 'browser-fixture', attempts: 0 } };
        const config = { frameworks: [{ id: 'a', name: 'Fixture', text: '' }], companySize: 20, sector: 'technology', budgetLevel: 'medium', currentMaturity: 2, employeeArchetypes: ['cto'], simulationMode: 'agentic' };
        output.manifest = { taskModel: { policy, policyHash: await browserArtifactHash(policy), source: 'synthetic', scope: 'sampled-work-block' } };
        window.__renderReport = mode => {
            if (mode === 'individual') return root.render(React.createElement(Dashboard, { data: output, config, onReset: () => {} }));
            if (mode === 'comparison') return root.render(React.createElement(ComparisonDashboard, { results: [output, { ...output, frameworkName: 'Outra condição' }], config, onReset: () => {} }));
            const batch = { config, outputs: [output], summary: summarizeOutputs([output]), runs: [{ replicaId: '1', conditionId: 'a', seed: 71, status: 'fixture', output }, { replicaId: '2', conditionId: 'a', seed: 72, status: 'failed' }], selectionProtocol: 'independent-replicas' };
            const report = buildReportData({ mode: 'batch', outputs: batch.outputs, config, batch });
            root.render(React.createElement('main', { className: 'dark bg-zinc-950 text-zinc-100 p-5 space-y-6 min-h-screen' }, React.createElement('h1', null, 'Lote sintético'), React.createElement(ArticleExportControls, { report }), React.createElement(BatchResultsChart, { result: batch, report }), React.createElement(IndividualEvaluationPanel, { data: output })));
        };
    })()`);
    for (const mode of ['individual', 'comparison', 'batch']) {
        await evaluate(client, `window.__renderReport('${mode}')`);
        await waitFor(client, `document.querySelector('[aria-label="Formato do artigo"]') && document.body.textContent.includes('Validação empírica pendente')`, 20000);
        await evaluate(client, `[...document.querySelectorAll('details')].find(detail => detail.querySelector('summary')?.textContent.includes('Distribuição do tempo por classe')).open = true`);
        await waitFor(client, `document.body.textContent.includes('Engineer:sampled-unit') && document.body.textContent.includes('censurada') && document.body.textContent.includes('produção mensal total')`, 10000);
        await evaluate(client, `[...document.querySelectorAll('button')].find(button => button.textContent.includes('Exportar artigo')).click()`);
        await waitFor(client, `window.__downloads.some(download => download.name === 'framesim-${mode}-article.zip')`, 20000);
        const zip = await evaluate(client, `(async () => { const entry = window.__downloads.find(download => download.name === 'framesim-${mode}-article.zip'); const bytes = new Uint8Array(await entry.blob.arrayBuffer()); return { size: bytes.length, signature: Array.from(bytes.slice(0, 4)), type: entry.blob.type }; })()`);
        if (zip.signature.join(',') !== '80,75,3,4' || zip.size < 1000) throw new Error('Invalid downloaded ZIP');
        await evaluate(client, `[...document.querySelectorAll('details')].find(detail => detail.querySelector('summary')?.textContent.includes('Fluxograma da simulação')).open = true`);
        await waitFor(client, `document.querySelector('[aria-label="Fluxograma navegável"] svg')?.getBoundingClientRect().height > 500`, 10000);
        const flowchart = await evaluate(client, `(() => {
            const region = document.querySelector('[aria-label="Fluxograma navegável"]');
            const svg = region.querySelector('svg');
            const overflow = [...svg.querySelectorAll('[data-node]')].flatMap(node => {
                const shape = node.querySelector('rect, polygon').getBBox();
                return [...node.querySelectorAll('tspan')].filter(text => {
                    const box = text.getBBox();
                    return box.x < shape.x || box.x + box.width > shape.x + shape.width || box.y < shape.y || box.y + box.height > shape.y + shape.height;
                }).map(text => text.textContent);
            });
            region.scrollIntoView({ block: 'start' });
            return { diamonds: svg.querySelectorAll('polygon').length, terminals: svg.querySelectorAll('[data-node] rect[rx="21"]').length, hasYesNo: svg.textContent.includes('Sim') && svg.textContent.includes('Não'), overflow };
        })()`);
        if (flowchart.diamonds !== 2 || flowchart.terminals !== 2 || !flowchart.hasYesNo || flowchart.overflow.length) throw new Error(`Invalid flowchart in ${mode}: ${JSON.stringify(flowchart)}`);
        const flowchartCapture = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, captureBeyondViewport: false });
        await writeFile(path.join(outputDir, `${mode}-flowchart-desktop.jpg`), Buffer.from(flowchartCapture.data, 'base64'));
        await screenshot(client, `${mode}-desktop.jpg`);
        await screenshot(client, `${mode}-mobile.jpg`, true);
        const layout = await evaluate(client, `({ viewport: innerWidth, body: document.body.scrollWidth, exportControl: document.querySelector('[aria-label="Formato do artigo"]').getBoundingClientRect().width })`);
        if (layout.body > layout.viewport + 2 || layout.exportControl > layout.viewport) throw new Error(`Mobile overflow in ${mode}: ${JSON.stringify(layout)}`);
        const distribution = await evaluate(client, `(() => { const detail = [...document.querySelectorAll('details')].find(item => item.querySelector('summary')?.textContent.includes('Distribuição do tempo por classe')); detail.scrollIntoView({ block: 'start' }); return { open: detail.open, classVisible: detail.textContent.includes('Engineer:sampled-unit'), censoringVisible: detail.textContent.includes('censurada') }; })()`);
        const distributionCapture = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 78, captureBeyondViewport: false });
        await writeFile(path.join(outputDir, `${mode}-distribution-mobile.jpg`), Buffer.from(distributionCapture.data, 'base64'));
        const flowchartMobile = await evaluate(client, `(() => {
            const region = document.querySelector('[aria-label="Fluxograma navegável"]');
            region.scrollLeft = (region.scrollWidth - region.clientWidth) / 2;
            region.scrollIntoView({ block: 'start' });
            return { viewportWidth: region.clientWidth, diagramWidth: region.scrollWidth, keyboardScrollable: region.tabIndex === 0 };
        })()`);
        const flowchartMobileCapture = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, captureBeyondViewport: false });
        await writeFile(path.join(outputDir, `${mode}-flowchart-mobile.jpg`), Buffer.from(flowchartMobileCapture.data, 'base64'));
        checks.push({ mode, zip, layout, distribution, flowchart, flowchartMobile });
    }
    const errors = client.events.filter(event => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'));
    if (errors.length) throw new Error(`Browser errors: ${JSON.stringify(errors).slice(0, 2000)}`);
    const inferenceAttempts = await evaluate(client, 'window.__inferenceAttempts');
    if (inferenceAttempts !== 0) throw new Error('Report-only UI attempted inference');
    const result = { ok: true, source: 'offline fixtures', inferencingCalls: inferenceAttempts, checks, screenshotsDirectory: outputDir };
    await writeFile(path.join(outputDir, 'results.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally {
    await client?.send('Browser.close').catch(() => undefined); socket?.close(); browserProcess.kill(); frontendProcess.kill();
    const resolvedProfile = path.resolve(profileDir), tempRoot = path.resolve(os.tmpdir());
    if (resolvedProfile.startsWith(tempRoot + path.sep)) await rm(resolvedProfile, { recursive: true, force: true }).catch(() => undefined);
}
