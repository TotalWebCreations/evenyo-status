// Leest een storingsmelding uit incidents/*.md (zie incidents/_voorbeeld.md).

const impacts = ['outage', 'degraded', 'maintenance', 'none'];

export function parseIncident(file, source, now) {
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

    if (! match) {
        throw new Error(`${file}: frontmatter (--- ... ---) ontbreekt.`);
    }

    const meta = Object.fromEntries(
        match[1].split(/\r?\n/)
            .map((line) => line.match(/^([a-z_]+):\s*(.*)$/i))
            .filter(Boolean)
            .map(([, key, value]) => [key.toLowerCase(), value.trim().replace(/^["']|["']$/g, '')]),
    );

    if (! meta.title) {
        throw new Error(`${file}: title ontbreekt.`);
    }

    const impact = impacts.includes(meta.impact) ? meta.impact : 'degraded';
    const startedAt = parseLocal(meta.started);
    const endsAt = parseLocal(meta.ends);
    const resolvedAt = parseLocal(meta.resolved) ?? (impact === 'maintenance' && endsAt && endsAt <= now ? endsAt : null);
    const scheduled = impact === 'maintenance' && ! resolvedAt && startedAt && startedAt > now;

    return {
        file,
        title: meta.title,
        impact,
        components: (meta.components ?? '').split(',').map((id) => id.trim()).filter(Boolean),
        started: meta.started ?? null,
        startedAt,
        endsAt,
        resolvedAt,
        scheduled,
        active: ! resolvedAt && ! scheduled,
        html: markdown(match[2].trim()),
    };
}

// Een melding uit app.evenyo.io/status.json (super admin → Statuspagina).
export function fromPlatform(incident, now) {
    const impact = impacts.includes(incident.impact) ? incident.impact : 'degraded';
    const startedAt = new Date(incident.starts_at);
    const endsAt = incident.ends_at ? new Date(incident.ends_at) : null;
    const resolvedAt = incident.resolved_at ? new Date(incident.resolved_at) : null;
    const scheduled = impact === 'maintenance' && ! resolvedAt && startedAt > now;
    const time = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    return {
        file: `evenyo-${incident.id}`,
        title: incident.title,
        impact,
        components: incident.components ?? [],
        started: incident.starts_at,
        startedAt,
        endsAt,
        resolvedAt,
        scheduled,
        active: ! resolvedAt && ! scheduled,
        html: (incident.updates ?? []).map((update) => `<h4>${escape(time.format(new Date(update.at)))}</h4><p>${escape(update.body).replace(/\r?\n/g, '<br>')}</p>`).join(''),
    };
}

// "2026-11-09 14:20" in Nederlandse tijd naar een Date.
function parseLocal(value) {
    if (! value) {
        return null;
    }

    const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);

    if (! parts) {
        return null;
    }

    const [, y, m, d, hh = '00', mm = '00'] = parts;
    const asUtc = Date.UTC(+y, +m - 1, +d, +hh, +mm);
    const offset = new Date(asUtc).toLocaleString('en-US', { timeZone: 'Europe/Amsterdam', timeZoneName: 'longOffset' }).match(/GMT([+-]\d{2}):(\d{2})/);
    const offsetMinutes = offset ? (Number(offset[1]) * 60 + Math.sign(Number(offset[1])) * Number(offset[2])) : 0;

    return new Date(asUtc - offsetMinutes * 60_000);
}

export function escape(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function inline(text) {
    return escape(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function markdown(source) {
    if (! source) {
        return '';
    }

    return source.split(/\r?\n\s*\r?\n/).map((block) => {
        const lines = block.split(/\r?\n/);

        if (/^#{1,6}\s/.test(lines[0]) && lines.length === 1) {
            return `<h4>${inline(lines[0].replace(/^#+\s*/, ''))}</h4>`;
        }

        if (lines.every((line) => /^\s*[-*]\s/.test(line))) {
            return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^\s*[-*]\s/, ''))}</li>`).join('')}</ul>`;
        }

        if (/^#{1,6}\s/.test(lines[0])) {
            return `<h4>${inline(lines[0].replace(/^#+\s*/, ''))}</h4><p>${lines.slice(1).map(inline).join('<br>')}</p>`;
        }

        return `<p>${lines.map(inline).join('<br>')}</p>`;
    }).join('');
}
