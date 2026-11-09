// Controleert Evenyo van buitenaf en bouwt de statuspagina in dist/.
// Draait zonder dependencies op Node 20+: `node scripts/check.mjs`.

import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from './render.mjs';
import { parseIncident } from './incidents.mjs';
import { dayKey, lastDays } from './days.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const config = JSON.parse(await readFile(join(root, 'checks.config.json'), 'utf8'));
const timeZone = 'Europe/Amsterdam';
const rank = { operational: 0, maintenance: 1, degraded: 2, outage: 3 };

const now = new Date();
const history = await loadHistory();
const platform = await checkPlatform();
const incidents = await loadIncidents();

const components = [];

for (const component of config.components) {
    const results = [];

    if (component.http) {
        results.push(await checkHttp(component.http));
    }

    for (const key of component.platform ?? []) {
        results.push(platformResult(key));
    }

    const measured = worst(results.map((result) => result.state));
    const reported = worst(incidents.filter((incident) => incident.active && incident.components.includes(component.id)).map((incident) => incident.impact));
    const state = rank[reported] > rank[measured] ? reported : measured;

    components.push({
        ...component,
        state,
        measured,
        responseMs: results.find((result) => result.ms !== undefined)?.ms,
    });

    record(component.id, measured);
}

prune();

const overall = worst(components.map((component) => component.state));
const status = {
    status: overall,
    checked_at: now.toISOString(),
    components: Object.fromEntries(components.map((component) => [component.id, component.state])),
    active_incidents: incidents.filter((incident) => incident.active).map(({ title, impact, components: ids, started }) => ({ title, impact, components: ids, started })),
};

await mkdir(join(dist, 'assets'), { recursive: true });
await writeFile(join(dist, 'history.json'), JSON.stringify(history));
await writeFile(join(dist, 'status.json'), JSON.stringify(status, null, 2));
await writeFile(join(dist, 'index.html'), render({ config, components, history, incidents, overall, now, timeZone }));
await writeFile(join(dist, 'CNAME'), `${new URL(config.siteUrl).host}\n`);

for (const file of await readdir(join(root, 'assets'))) {
    await copyFile(join(root, 'assets', file), join(dist, 'assets', file));
}

for (const component of components) {
    console.log(`${component.state.padEnd(12)} ${component.name}${component.responseMs !== undefined ? ` (${component.responseMs} ms)` : ''}`);
}

console.log(`Totaal: ${overall}`);

async function loadHistory() {
    const empty = { version: 1, days: {} };

    if (process.env.HISTORY_FILE) {
        return existsSync(process.env.HISTORY_FILE) ? JSON.parse(await readFile(process.env.HISTORY_FILE, 'utf8')) : empty;
    }

    const allowFresh = process.env.ALLOW_FRESH_HISTORY === 'true';

    try {
        const response = await fetch(`${process.env.SITE_URL ?? config.siteUrl}/history.json`, { signal: AbortSignal.timeout(config.timeoutMs), cache: 'no-store' });

        if (response.status === 404) {
            console.log('Nog geen geschiedenis gepubliceerd, begin opnieuw.');

            return empty;
        }

        if (! response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        if (allowFresh) {
            console.log(`Geschiedenis niet op te halen (${error.message}), begin opnieuw omdat ALLOW_FRESH_HISTORY aan staat.`);

            return empty;
        }

        // Liever één meting overslaan dan 90 dagen geschiedenis overschrijven.
        console.error(`Kan de vorige geschiedenis niet ophalen: ${error.message}. Gestopt zonder te publiceren.`);
        process.exit(1);
    }
}

async function checkHttp({ url, headers = {} }, attempt = 1) {
    const started = performance.now();

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'evenyo-status-check', ...headers },
            redirect: 'follow',
            signal: AbortSignal.timeout(config.timeoutMs),
        });
        const ms = Math.round(performance.now() - started);

        await response.arrayBuffer();

        if (! response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return { state: ms > config.slowAfterMs ? 'degraded' : 'operational', ms };
    } catch (error) {
        if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            return checkHttp({ url, headers }, attempt + 1);
        }

        console.error(`${url}: ${error.message}`);

        return { state: 'outage' };
    }
}

async function checkPlatform(attempt = 1) {
    try {
        // 503 betekent "er is iets stuk", maar de inhoud zegt wat: die lezen we dus ook.
        const response = await fetch(process.env.PLATFORM_STATUS_URL ?? config.platformStatusUrl, {
            headers: { 'User-Agent': 'evenyo-status-check', Accept: 'application/json' },
            signal: AbortSignal.timeout(config.timeoutMs),
        });
        const body = await response.json();

        if (! body?.components) {
            throw new Error(`HTTP ${response.status} zonder onderdelen`);
        }

        return body.components;
    } catch (error) {
        if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            return checkPlatform(attempt + 1);
        }

        console.error(`${config.platformStatusUrl}: ${error.message}`);

        return null;
    }
}

function platformResult(key) {
    if (platform === null) {
        return { state: 'outage' };
    }

    return { state: platform[key] === 'operational' ? 'operational' : 'outage' };
}

async function loadIncidents() {
    const dir = join(root, 'incidents');
    const files = (await readdir(dir)).filter((file) => file.endsWith('.md') && ! file.startsWith('_'));
    const parsed = [];

    for (const file of files) {
        parsed.push(parseIncident(file, await readFile(join(dir, file), 'utf8'), now));
    }

    return parsed.sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0));
}

function worst(states) {
    return states.reduce((current, state) => (rank[state] > rank[current] ? state : current), 'operational');
}

function record(id, state) {
    const day = dayKey(now, timeZone);
    const bucket = (history.days[day] ??= {})[id] ??= { n: 0, down: 0, degraded: 0 };

    bucket.n += 1;

    if (state === 'outage') {
        bucket.down += 1;
    }

    if (state === 'degraded') {
        bucket.degraded += 1;
    }
}

function prune() {
    const keep = new Set(lastDays(now, config.historyDays, timeZone));

    for (const day of Object.keys(history.days)) {
        if (! keep.has(day)) {
            delete history.days[day];
        }
    }

    history.updated_at = now.toISOString();
}
