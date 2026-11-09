import { escape } from './incidents.mjs';
import { lastDays } from './days.mjs';

const labels = {
    operational: 'Werkt',
    degraded: 'Traag of beperkt',
    maintenance: 'Onderhoud',
    outage: 'Storing',
};

const banners = {
    operational: ['Alles werkt', 'Alle onderdelen van Evenyo werken normaal.'],
    maintenance: ['Gepland onderhoud', 'Een deel van Evenyo is tijdelijk in onderhoud.'],
    degraded: ['Werkt beperkt', 'Sommige onderdelen zijn traag of werken niet volledig.'],
    outage: ['Storing', 'Een deel van Evenyo werkt nu niet. We werken aan een oplossing.'],
};

const impactLabels = {
    outage: 'Storing',
    degraded: 'Verstoring',
    maintenance: 'Onderhoud',
    none: 'Melding',
};

export function render({ config, components, history, incidents, overall, now, timeZone }) {
    const days = lastDays(now, config.historyDays, timeZone);
    const time = (date, options) => new Intl.DateTimeFormat('nl-NL', { timeZone, ...options }).format(date);
    const dateLabel = (day) => time(new Date(`${day}T12:00:00Z`), { day: 'numeric', month: 'short' });
    const active = incidents.filter((incident) => incident.active);
    const scheduled = incidents.filter((incident) => incident.scheduled);
    const past = incidents.filter((incident) => incident.resolvedAt && now - incident.resolvedAt < 90 * 86_400_000).slice(0, 10);
    const names = Object.fromEntries(components.map((component) => [component.id, component.name]));
    const [bannerTitle, bannerText] = banners[overall];

    const uptime = (id) => {
        let checks = 0;
        let down = 0;

        for (const day of days) {
            const bucket = history.days[day]?.[id];
            checks += bucket?.n ?? 0;
            down += bucket?.down ?? 0;
        }

        return checks === 0 ? null : ((checks - down) / checks) * 100;
    };

    const percent = (value) => `${value.toLocaleString('nl-NL', { minimumFractionDigits: value === 100 ? 0 : 2, maximumFractionDigits: 2 })}%`;

    const bar = (id) => days.map((day) => {
        const bucket = history.days[day]?.[id];

        if (! bucket?.n) {
            return `<span class="day none" title="${dateLabel(day)} · geen metingen"></span>`;
        }

        const value = ((bucket.n - bucket.down) / bucket.n) * 100;
        const level = bucket.down === 0 ? (bucket.degraded > 0 ? 'degraded' : 'operational') : (value >= 98 ? 'degraded' : 'outage');

        return `<span class="day ${level}" title="${dateLabel(day)} · ${percent(value)} beschikbaar"></span>`;
    }).join('');

    const incidentCard = (incident) => `
        <article class="incident ${incident.impact}">
            <div class="incident-head">
                <span class="tag ${incident.impact}">${impactLabels[incident.impact]}</span>
                <h3>${escape(incident.title)}</h3>
            </div>
            <p class="meta">${[
                incident.startedAt ? `${incident.scheduled ? 'Gepland' : 'Begonnen'} ${time(incident.startedAt, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : null,
                incident.endsAt && ! incident.resolvedAt ? `tot ${time(incident.endsAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : null,
                incident.resolvedAt ? `opgelost ${time(incident.resolvedAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : null,
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
                    <h3>${escape(component.name)}</h3>
                    <p>${escape(component.description ?? '')}</p>
                </div>
                <span class="state ${component.state}"><i></i>${labels[component.state]}</span>
            </div>
            <div class="bars" aria-label="Beschikbaarheid per dag, laatste ${config.historyDays} dagen">${bar(component.id)}</div>
            <div class="bar-legend"><span class="long">${config.historyDays} dagen geleden</span><span class="short">30 dagen geleden</span><span>${value === null ? 'Nog geen metingen' : `${percent(value)} beschikbaar`}</span><span>Vandaag</span></div>
        </li>`;
    }).join('');

    return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="120">
<title>Evenyo status</title>
<meta name="description" content="De actuele status van Evenyo: backoffice, inschrijfsites, apps en live timing.">
<link rel="icon" href="assets/icon.svg" type="image/svg+xml">
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
nav a.back{color:#C9D3E6;font-size:15px;font-weight:700;text-decoration:none}
nav a.back:hover{color:#fff}
.summary{padding:72px 0 148px;max-width:560px}
.pill{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px;border-radius:999px;background:#fff;font-size:14px;font-weight:800}
.pill i{width:9px;height:9px;border-radius:999px}
.pill.operational{color:var(--green)}.pill.operational i{background:var(--green)}
.pill.degraded,.pill.maintenance{color:#9A6200}.pill.degraded i,.pill.maintenance i{background:var(--amber)}
.pill.outage{color:var(--red)}.pill.outage i{background:var(--red)}
.summary h1{margin:18px 0 0;font-size:40px;line-height:1.1;font-weight:900;letter-spacing:-.8px}
.summary p{margin:14px 0 0;font-size:15px;line-height:1.5;color:#C9D3E6}
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
.state.degraded,.state.maintenance{background:var(--amber-soft);color:#9A6200}
.state.outage{background:var(--red-soft);color:var(--red)}
.bars{display:flex;gap:2px;height:34px;margin-top:16px}
.day{flex:1;border-radius:3px;background:var(--grey)}
.day.operational{background:var(--green)}
.day.degraded{background:var(--amber)}
.day.outage{background:var(--red)}
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
</head>
<body>
<header class="hero ${overall}">
    <svg class="track" aria-hidden="true" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path d="M-20 150 C 420 175 760 30 1460 60" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="54" vector-effect="non-scaling-stroke"/>
        <path d="M-20 150 C 420 175 760 30 1460 60" fill="none" stroke="#1C2A4A" stroke-width="46" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="wrap">
        <nav>
            <a class="logo" href="./" aria-label="Evenyo status"><img src="assets/logo.svg" alt="Evenyo"><span>STATUS</span></a>
            <a class="back" href="https://evenyo.io">Naar evenyo.io</a>
        </nav>
        <div class="summary">
            <span class="pill ${overall}"><i></i>${bannerTitle}</span>
            <h1>${bannerText}</h1>
            <p>Laatst gecontroleerd ${time(now, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}. We controleren elke paar minuten van buitenaf.</p>
        </div>
    </div>
</header>
<main class="wrap">
    ${active.length ? `<section class="panel alert">${active.map(incidentCard).join('')}</section>` : ''}
    ${scheduled.length ? `<section class="panel">${scheduled.map(incidentCard).join('')}</section>` : ''}

    <section class="panel"><ul class="components">${rows}</ul></section>

    <h2>Eerdere meldingen</h2>
    <section class="panel">${past.length ? past.map(incidentCard).join('') : '<p class="empty">Geen meldingen in de afgelopen 90 dagen.</p>'}</section>

    <footer>
        <p>Werkt er iets niet, maar staat het hier niet? Mail ons via <a href="mailto:support@evenyo.io">support@evenyo.io</a>.</p>
    </footer>
</main>
</body>
</html>
`;
}
