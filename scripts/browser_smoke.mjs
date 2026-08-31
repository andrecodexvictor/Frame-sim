import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const frontendUrl = process.env.FRAMESIM_FRONTEND_URL || 'http://127.0.0.1:3000/';
const outputDir = path.resolve(process.env.FRAMESIM_QA_OUTPUT || 'artifacts/qa');
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

async function waitForEndpoint(url, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
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
                this.pending.delete(message.id);
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
            this.pending.set(id, { resolve, reject });
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
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

const browserPath = await firstExisting(browserCandidates);
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'framesim-browser-'));
const debuggingPort = await getFreePort();
await mkdir(outputDir, { recursive: true });
const browserProcess = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${profileDir}`,
    'about:blank'
], { stdio: 'ignore', windowsHide: true });

let socket;
let client;
try {
    await waitForEndpoint(`http://127.0.0.1:${debuggingPort}/json/version`);
    const target = await fetch(`http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' }).then(response => response.json());
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });
    client = new CDPClient(socket);
    await Promise.all([
        client.send('Page.enable'),
        client.send('Runtime.enable'),
        client.send('Log.enable'),
        client.send('Network.enable')
    ]);
    const loaded = client.event('Page.loadEventFired', 20_000);
    await client.send('Page.navigate', { url: frontendUrl });
    await loaded;
    await waitFor(client, `document.readyState === 'complete'`, 20_000);
    await new Promise(resolve => setTimeout(resolve, 1_000));
    const bootState = await evaluate(client, `({ href: location.href, title: document.title, text: document.body?.innerText?.slice(0, 500), html: document.documentElement?.outerHTML?.slice(0, 500) })`);
    console.log(`browser_boot=${JSON.stringify(bootState)}`);
    await waitFor(client, `document.querySelector('#framework-name')`, 20_000);

    const initialTitle = await evaluate(client, 'document.title');
    const initialShot = await screenshot(client, 'framesim-upload-desktop.jpg');
    const frameworkInput = `(() => {
        const input = document.querySelector('#framework-name');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'Flow Lattice 9');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const button = [...document.querySelectorAll('button')].find(item => item.textContent.includes('INICIAR SIMULAÇÃO ÚNICA'));
        if (!button || button.disabled) return false;
        button.click();
        return true;
    })()`;
    if (!await evaluate(client, frameworkInput)) throw new Error('Upload step could not be submitted.');

    await waitFor(client, `document.querySelector('#agentic-mode')`, 20_000);
    await waitFor(client, `!document.querySelector('#agentic-mode').disabled`, 15_000);
    const explanationPresent = await evaluate(client, `document.body.textContent.includes('Como a simulação reage') && document.body.textContent.includes('Não são previsões')`);
    if (!explanationPresent) throw new Error('Simulation explanation or warning copy is missing.');
    const configShot = await screenshot(client, 'framesim-config-desktop.jpg');

    const submitted = await evaluate(client, `(() => {
        const mode = document.querySelector('#agentic-mode');
        if (!mode.checked) mode.click();
        const size = document.querySelector('#company-size');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(size, '20');
        size.dispatchEvent(new Event('input', { bubbles: true }));
        size.dispatchEvent(new Event('change', { bubbles: true }));
        const form = document.querySelector('form');
        if (!form) return false;
        form.requestSubmit();
        return true;
    })()`);
    if (!submitted) throw new Error('Configuration step could not be submitted.');

    await waitFor(client, `document.body.textContent.includes('Simulation Hash:')`, 300_000);
    const resultSignals = await evaluate(client, `({
        hasSignals: document.body.textContent.includes('Sinais') || document.body.textContent.includes('SINAL'),
        hasProvenance: document.body.textContent.includes('Execução ao vivo') || document.body.textContent.includes('Resultado degradado'),
        hasMetrics: document.body.textContent.includes('QPC') && document.body.textContent.includes('TIR'),
        hasMacro: document.body.textContent.includes('MACRO'),
        hash: (document.body.textContent.match(/Simulation Hash:\\s*([a-z0-9]+)/i) || [])[1] || null
    })`);
    if (!resultSignals.hasSignals || !resultSignals.hasProvenance || !resultSignals.hasMetrics || !resultSignals.hash) {
        throw new Error(`Result observability incomplete: ${JSON.stringify(resultSignals)}`);
    }
    const resultShot = await screenshot(client, 'framesim-result-desktop.jpg');
    const mobileShot = await screenshot(client, 'framesim-result-mobile.jpg', true);
    const severeLogs = client.events
        .filter(event => event.method === 'Log.entryAdded' && ['error', 'warning'].includes(event.params?.entry?.level))
        .map(event => ({ level: event.params.entry.level, text: String(event.params.entry.text).slice(0, 240) }));
    if (severeLogs.length > 0) {
        throw new Error(`Browser emitted warning/error logs: ${JSON.stringify(severeLogs)}`);
    }

    console.log(JSON.stringify({
        ok: true,
        title: initialTitle,
        url: frontendUrl,
        explanationPresent,
        resultSignals,
        severeLogs,
        screenshots: [initialShot, configShot, resultShot, mobileShot]
    }, null, 2));
} catch (error) {
    const diagnostic = client ? await evaluate(client, `({
        href: location.href,
        readyState: document.readyState,
        body: document.body?.innerText?.slice(0, 1_500),
        root: document.querySelector('#root')?.innerHTML?.slice(0, 1_500)
    })`).catch(() => null) : null;
    const browserEvents = client?.events
        .filter(event => ['Log.entryAdded', 'Runtime.exceptionThrown', 'Network.loadingFailed'].includes(event.method))
        .slice(-20)
        .map(event => ({ method: event.method, params: event.params })) || [];
    console.error(`browser_diagnostic=${JSON.stringify({ diagnostic, browserEvents }, null, 2)}`);
    throw error;
} finally {
    await client?.send('Browser.close').catch(() => undefined);
    socket?.close();
    browserProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 500));
    await rm(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 }).catch(() => undefined);
}
