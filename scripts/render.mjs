import { escape } from './incidents.mjs';
import { lastDays } from './days.mjs';

export const languages = ['nl', 'en', 'de'];

const T = {
    nl: {
        locale: 'nl-NL',
        description: 'De actuele status van Evenyo: backoffice, inschrijfsites, apps en live timing.',
        back: 'Naar evenyo.io',
        states: { operational: 'Werkt', degraded: 'Traag of beperkt', maintenance: 'Onderhoud', outage: 'Storing' },
        banners: {
            operational: ['Alles werkt', 'Alle onderdelen van Evenyo werken normaal.'],
            maintenance: ['Onderhoud', 'Een deel van Evenyo is tijdelijk in onderhoud.'],
            degraded: ['Werkt beperkt', 'Sommige onderdelen zijn traag of werken niet volledig.'],
            outage: ['Storing', 'Een deel van Evenyo werkt nu niet. We werken aan een oplossing.'],
        },
        impacts: { outage: 'Storing', degraded: 'Verstoring', maintenance: 'Onderhoud', none: 'Mededeling' },
        checked: (when) => `Laatst gecontroleerd ${when}. We controleren elke paar minuten van buitenaf.`,
        scheduled: 'Gepland', started: 'Begonnen', until: 'tot', resolved: 'opgelost',
        noData: 'geen metingen', inMaintenance: 'onderhoud', available: 'beschikbaar', noChecks: 'Nog geen metingen',
        daysAgo: (n) => `${n} dagen geleden`, today: 'Vandaag', barsLabel: (n) => `Beschikbaarheid per dag, laatste ${n} dagen`,
        past: 'Eerdere meldingen', noPast: 'Geen meldingen in de afgelopen 90 dagen.',
        stale: 'Let op: de laatste controle is al {m} minuten oud. Deze pagina is mogelijk niet actueel.',
        footer: 'Werkt er iets niet, maar staat het hier niet? Mail ons via',
    },
    en: {
        locale: 'en-GB',
        description: 'The current status of Evenyo: back office, registration sites, apps and live timing.',
        back: 'To evenyo.io',
        states: { operational: 'Operational', degraded: 'Slow or limited', maintenance: 'Maintenance', outage: 'Outage' },
        banners: {
            operational: ['All systems operational', 'All parts of Evenyo are working normally.'],
            maintenance: ['Maintenance', 'Part of Evenyo is temporarily under maintenance.'],
            degraded: ['Partially limited', 'Some parts are slow or not fully working.'],
            outage: ['Outage', 'Part of Evenyo is not working right now. We are working on a fix.'],
        },
        impacts: { outage: 'Outage', degraded: 'Degraded', maintenance: 'Maintenance', none: 'Notice' },
        checked: (when) => `Last checked ${when}. We check every few minutes from the outside.`,
        scheduled: 'Scheduled', started: 'Started', until: 'until', resolved: 'resolved',
        noData: 'no checks', inMaintenance: 'maintenance', available: 'available', noChecks: 'No checks yet',
        daysAgo: (n) => `${n} days ago`, today: 'Today', barsLabel: (n) => `Availability per day, last ${n} days`,
        past: 'Past notices', noPast: 'No notices in the last 90 days.',
        stale: 'Note: the last check was {m} minutes ago. This page may be out of date.',
        footer: 'Something not working, but not listed here? Email us at',
    },
    de: {
        locale: 'de-DE',
        description: 'Der aktuelle Status von Evenyo: Backoffice, Anmeldeseiten, Apps und Live-Timing.',
        back: 'Zu evenyo.io',
        states: { operational: 'Funktioniert', degraded: 'Langsam oder eingeschränkt', maintenance: 'Wartung', outage: 'Störung' },
        banners: {
            operational: ['Alles funktioniert', 'Alle Bereiche von Evenyo funktionieren normal.'],
            maintenance: ['Wartung', 'Ein Teil von Evenyo wird gerade gewartet.'],
            degraded: ['Eingeschränkt', 'Einige Bereiche sind langsam oder funktionieren nicht vollständig.'],
            outage: ['Störung', 'Ein Teil von Evenyo funktioniert gerade nicht. Wir arbeiten an einer Lösung.'],
        },
        impacts: { outage: 'Störung', degraded: 'Einschränkung', maintenance: 'Wartung', none: 'Mitteilung' },
        checked: (when) => `Zuletzt geprüft ${when}. Wir prüfen alle paar Minuten von außen.`,
        scheduled: 'Geplant', started: 'Begonnen', until: 'bis', resolved: 'behoben',
        noData: 'keine Messungen', inMaintenance: 'Wartung', available: 'verfügbar', noChecks: 'Noch keine Messungen',
        daysAgo: (n) => `vor ${n} Tagen`, today: 'Heute', barsLabel: (n) => `Verfügbarkeit pro Tag, letzte ${n} Tage`,
        past: 'Frühere Meldungen', noPast: 'Keine Meldungen in den letzten 90 Tagen.',
        stale: 'Hinweis: Die letzte Prüfung ist schon {m} Minuten alt. Diese Seite ist möglicherweise nicht aktuell.',
        footer: 'Funktioniert etwas nicht, steht aber nicht hier? Schreib uns an',
    },
};

// Tekst uit checks.config.json: een string (alleen Nederlands) of { nl, en, de }.
export function text(value, lang) {
    if (value === null || value === undefined) {
        return '';
    }

    return typeof value === 'string' ? value : (value[lang] ?? value.nl ?? '');
}

export function uptimeOf(bucket) {
    const counted = bucket.n - (bucket.maintenance ?? 0);

    return counted <= 0 ? null : ((counted - bucket.down) / counted) * 100;
}

export function render({ config, components, history, incidents, overall, now, timeZone, lang = 'nl' }) {
    const t = T[lang];
    const base = lang === 'nl' ? '' : '../';
    const days = lastDays(now, config.historyDays, timeZone);
    const time = (date, options) => new Intl.DateTimeFormat(t.locale, { timeZone, ...options }).format(date);
    const dateLabel = (day) => time(new Date(`${day}T12:00:00Z`), { day: 'numeric', month: 'short' });
    const active = incidents.filter((incident) => incident.active);
    const scheduled = incidents.filter((incident) => incident.scheduled);
    const past = incidents.filter((incident) => incident.resolvedAt && now - incident.resolvedAt < 90 * 86_400_000).slice(0, 10);
    const names = Object.fromEntries(components.map((component) => [component.id, text(component.name, lang)]));
    const [bannerTitle, bannerText] = t.banners[overall];

    const uptime = (id) => {
        const total = { n: 0, down: 0, maintenance: 0 };

        for (const day of days) {
            const bucket = history.days[day]?.[id];
            total.n += bucket?.n ?? 0;
            total.down += bucket?.down ?? 0;
            total.maintenance += bucket?.maintenance ?? 0;
        }

        return total.n === 0 ? null : uptimeOf(total);
    };

    const percent = (value) => `${value.toLocaleString(t.locale, { minimumFractionDigits: value === 100 ? 0 : 2, maximumFractionDigits: 2 })}%`;

    const bar = (id) => days.map((day) => {
        const bucket = history.days[day]?.[id];

        if (! bucket?.n) {
            return `<span class="day none" title="${dateLabel(day)} · ${t.noData}"></span>`;
        }

        const value = uptimeOf(bucket);

        if (value === null) {
            return `<span class="day maintenance" title="${dateLabel(day)} · ${t.inMaintenance}"></span>`;
        }

        const level = bucket.down === 0
            ? (bucket.degraded > 0 ? 'degraded' : (bucket.maintenance > 0 ? 'maintenance' : 'operational'))
            : (value >= 98 ? 'degraded' : 'outage');

        return `<span class="day ${level}" title="${dateLabel(day)} · ${percent(value)} ${t.available}${bucket.maintenance ? ` · ${t.inMaintenance}` : ''}"></span>`;
    }).join('');

    const incidentCard = (incident) => `
        <article class="incident ${incident.impact}">
            <div class="incident-head">
                <span class="tag ${incident.impact}">${t.impacts[incident.impact]}</span>
                <h3>${escape(incident.title)}</h3>
            </div>
            <p class="meta">${[
                incident.startedAt ? `${incident.scheduled ? t.scheduled : t.started} ${time(incident.startedAt, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : null,
                incident.endsAt && ! incident.resolvedAt ? `${t.until} ${time(incident.endsAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : null,
                incident.resolvedAt ? `${t.resolved} ${time(incident.resolvedAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : null,
                incident.components.length ? incident.components.map((id) => escape(names[id] ?? id)).join(', ') : null,
            ].filter(Boolean).join(' · ')}</p>
            ${incident.html ? `<div class="body">${incident.html}</div>` : ''}
        </article>`;

    const rows = components.map((component) => {
        const value = uptime(component.id);

        return `
        <li class="component">
            <div class="component-head">
                <div>
                    <h3>${escape(text(component.name, lang))}</h3>
                    <p>${escape(text(component.description, lang))}</p>
                </div>
                <span class="state ${component.state}"><i></i>${t.states[component.state]}</span>
            </div>
            <div class="bars" aria-label="${t.barsLabel(config.historyDays)}">${bar(component.id)}</div>
            <div class="bar-legend"><span class="long">${t.daysAgo(config.historyDays)}</span><span class="short">${t.daysAgo(30)}</span><span>${value === null ? t.noChecks : `${percent(value)} ${t.available}`}</span><span>${t.today}</span></div>
        </li>`;
    }).join('');

    const langLinks = languages.map((code) => {
        const href = code === 'nl' ? `${base}./` : `${base}${code}/`;

        return `<a href="${href}" hreflang="${code}" data-lang="${code}"${code === lang ? ' aria-current="true"' : ''}>${code.toUpperCase()}</a>`;
    }).join('');

    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="120">
<title>Evenyo status</title>
<meta name="description" content="${t.description}">
${languages.map((code) => `<link rel="alternate" hreflang="${code}" href="${config.siteUrl}/${code === 'nl' ? '' : `${code}/`}">`).join('\n')}
<link rel="icon" href="${base}assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap">
<style>
:root{--ink:#0B1733;--ink-2:#3A4A66;--muted:#5B6B85;--line:#DDE3EE;--soft:#F6F7FB;--blue:#0D6EFD;--green:#1F9D55;--green-soft:#E6F5EC;--amber:#D98B06;--amber-soft:#FDF3DC;--red:#D92D20;--red-soft:#FDECEA;--grey:#E3E8F0}
*{box-sizing:border-box}
body{margin:0;background:var(--soft);color:var(--ink);font-family:Figtree,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--blue)}
.wrap{max-width:820px;margin:0 auto;padding:0 16px}
.hero{position:relative;overflow:hidden;background:var(--ink);color:#fff}
.hero .track{position:absolute;left:0;right:0;bottom:0;width:100%;height:160px;display:block}
.hero .wrap{position:relative}
nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:28px}
.logo{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:999px;background:#fff;box-shadow:0 6px 18px rgba(11,23,51,.12)}
.logo img{height:22px;display:block}
.logo span{height:20px;padding:0 8px;border-radius:6px;background:var(--blue);color:#fff;font-size:11px;font-weight:800;letter-spacing:1.2px;display:flex;align-items:center}
nav .right{display:flex;align-items:center;gap:18px}
nav a.back{color:#C9D3E6;font-size:15px;font-weight:700;text-decoration:none}
nav a.back:hover{color:#fff}
.langs{display:flex;gap:2px;padding:3px;border-radius:999px;background:rgba(255,255,255,.08)}
.langs a{min-width:34px;height:28px;padding:0 8px;border-radius:999px;color:#C9D3E6;font-size:13px;font-weight:800;text-decoration:none;display:flex;align-items:center;justify-content:center}
.langs a:hover{color:#fff}
.langs a[aria-current]{background:#fff;color:var(--ink)}
.summary{padding:72px 0 148px;max-width:560px}
.pill{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px;border-radius:999px;background:#fff;font-size:14px;font-weight:800}
.pill i{width:9px;height:9px;border-radius:999px}
.pill.operational{color:var(--green)}.pill.operational i{background:var(--green)}
.pill.degraded{color:#9A6200}.pill.degraded i{background:var(--amber)}
.pill.maintenance{color:var(--blue)}.pill.maintenance i{background:var(--blue)}
.pill.outage{color:var(--red)}.pill.outage i{background:var(--red)}
.summary h1{margin:18px 0 0;font-size:40px;line-height:1.1;font-weight:900;letter-spacing:-.8px}
.summary p{margin:14px 0 0;font-size:15px;line-height:1.5;color:#C9D3E6}
.summary .stale{display:inline-block;margin-top:14px;padding:8px 12px;border-radius:12px;background:var(--amber-soft);color:#7A4E00;font-weight:700}
.summary .stale[hidden]{display:none}
main.wrap{position:relative;margin-top:-88px;padding-bottom:48px}
.panel+.panel{margin-top:16px}
.panel{background:#fff;border-radius:28px;box-shadow:0 1px 2px rgba(11,23,51,.04),0 12px 32px rgba(11,23,51,.06)}
h2{margin:40px 4px 14px;font-size:20px;font-weight:900;letter-spacing:-.3px}
.components{list-style:none;margin:0;padding:6px 28px}
.component{padding:22px 0;border-top:1px solid var(--line)}
.component:first-child{border-top:0}
.component-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.component h3{margin:0;font-size:17px;font-weight:800}
.component p{margin:3px 0 0;font-size:14px;color:var(--muted);line-height:1.4}
.state{flex:none;display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:800;white-space:nowrap}
.state i{width:8px;height:8px;border-radius:999px;background:currentColor}
.state.operational{background:var(--green-soft);color:var(--green)}
.state.degraded{background:var(--amber-soft);color:#9A6200}
.state.maintenance{background:#E7F0FF;color:var(--blue)}
.state.outage{background:var(--red-soft);color:var(--red)}
.bars{display:flex;gap:2px;height:34px;margin-top:16px}
.day{flex:1;border-radius:3px;background:var(--grey)}
.day.operational{background:var(--green)}
.day.degraded{background:var(--amber)}
.day.outage{background:var(--red)}
.day.maintenance{background:#7FA9F5}
.day:hover{opacity:.7}
.bar-legend{display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--muted);font-weight:600}
.bar-legend .short{display:none}
.incident{padding:22px 28px;border-top:1px solid var(--line)}
.incident:first-child{border-top:0}
.incident-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.incident h3{margin:0;font-size:17px;font-weight:800}
.tag{height:24px;padding:0 9px;border-radius:7px;font-size:12px;font-weight:800;display:inline-flex;align-items:center}
.tag.outage{background:var(--red-soft);color:var(--red)}
.tag.degraded{background:var(--amber-soft);color:#9A6200}
.tag.maintenance{background:#E7F0FF;color:var(--blue)}
.tag.none{background:var(--soft);color:var(--ink-2)}
.incident .meta{margin:6px 0 0;font-size:13px;color:var(--muted)}
.incident .body{margin-top:10px;font-size:15px;line-height:1.55;color:var(--ink-2)}
.incident .body p{margin:8px 0}
.incident .body h4{margin:14px 0 2px;font-size:14px;font-weight:800;color:var(--ink)}
.incident .body ul{margin:8px 0;padding-left:20px}
.empty{padding:22px 28px;margin:0;font-size:15px;color:var(--muted)}
.panel.alert{border:2px solid var(--red-soft)}
footer{padding:8px 4px 0;font-size:13px;color:var(--muted);line-height:1.6}
.pill i,.state i{position:relative}
.pill i::after,.state i::after{content:"";position:absolute;inset:0;border-radius:999px;background:inherit;animation:ping 2s cubic-bezier(0,0,.2,1) infinite}
.state.outage i::after,.pill.outage i::after{animation-duration:1.2s}
@keyframes ping{75%,100%{transform:scale(2.6);opacity:0}}
@media (prefers-reduced-motion:reduce){.pill i::after,.state i::after{animation:none}}
@media (max-width:640px){
  nav{padding-top:20px}
  nav a.back{display:none}
  .summary{padding:44px 0 104px}
  main.wrap{margin-top:-56px}
  .hero .track{height:110px}
  .summary h1{font-size:30px}
  .components{padding:4px 20px}
  .incident,.empty{padding:20px}
  .component-head{flex-direction:column;gap:10px}
  .day:nth-child(-n+60){display:none}
  .bar-legend .long{display:none}
  .bar-legend .short{display:inline}
}
</style>
${lang === 'nl' ? `<script>
// Eerste bezoek zonder gekozen taal: Duits of Engels als de browser dat vraagt.
try {
    const chosen = localStorage.getItem('evenyo-status-lang');
    const browser = (navigator.language || '').slice(0, 2);
    if (! chosen && (browser === 'de' || browser === 'en')) location.replace(browser + '/');
} catch (error) {}
</script>` : ''}
</head>
<body>
<header class="hero ${overall}">
    <svg class="track" aria-hidden="true" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path d="M-20 150 C 420 175 760 30 1460 60" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="54" vector-effect="non-scaling-stroke"/>
        <path d="M-20 150 C 420 175 760 30 1460 60" fill="none" stroke="#1C2A4A" stroke-width="46" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="wrap">
        <nav>
            <a class="logo" href="./" aria-label="Evenyo status"><img src="${base}assets/logo.svg" alt="Evenyo"><span>STATUS</span></a>
            <div class="right">
                <a class="back" href="https://evenyo.io">${t.back}</a>
                <div class="langs">${langLinks}</div>
            </div>
        </nav>
        <div class="summary">
            <span class="pill ${overall}"><i></i>${bannerTitle}</span>
            <h1>${bannerText}</h1>
            <p>${t.checked(time(now, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</p>
            <p class="stale" data-checked="${now.toISOString()}" data-text="${escape(t.stale)}" hidden></p>
        </div>
    </div>
</header>
<main class="wrap">
    ${active.length ? `<section class="panel alert">${active.map(incidentCard).join('')}</section>` : ''}
    ${scheduled.length ? `<section class="panel">${scheduled.map(incidentCard).join('')}</section>` : ''}

    <section class="panel"><ul class="components">${rows}</ul></section>

    <h2>${t.past}</h2>
    <section class="panel">${past.length ? past.map(incidentCard).join('') : `<p class="empty">${t.noPast}</p>`}</section>

    <footer>
        <p>${t.footer} <a href="mailto:support@evenyo.io">support@evenyo.io</a>.</p>
    </footer>
</main>
<script>
// Draaide de controle al een tijd niet, dan zeggen we dat eerlijk in plaats van een oude "Alles werkt".
(() => {
    const stale = document.querySelector('.stale');
    const minutes = Math.round((Date.now() - new Date(stale.dataset.checked)) / 60000);

    if (minutes >= 15) {
        stale.textContent = stale.dataset.text.replace('{m}', minutes);
        stale.hidden = false;
    }
})();
document.querySelectorAll('.langs a').forEach((link) => link.addEventListener('click', () => {
    try { localStorage.setItem('evenyo-status-lang', link.dataset.lang); } catch (error) {}
}));
</script>
</body>
</html>
`;
}
