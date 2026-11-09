# Evenyo status

De openbare statuspagina van Evenyo op **https://status.evenyo.io**.

Deze pagina draait los van de Evenyo-server. Ligt de server plat, dan blijft de statuspagina dus gewoon bereikbaar.

## Hoe het werkt

- Een GitHub Action (`.github/workflows/status.yml`) draait elke 5 minuten `node scripts/check.mjs`. GitHub kan zo'n geplande run een paar minuten later starten.
- Het script controleert Evenyo van buitenaf:
  - **Backoffice:** `https://app.evenyo.io/up`, plus database en cache.
  - **Inschrijfsites:** `https://status-check.evenyo.io/up`, een sitedomein dat niet van één klant afhangt.
  - **Apps:** `https://app.evenyo.io/api/v1/ping`.
  - **Live timing:** ook een echte websocketverbinding van buitenaf, met het adres uit `status.json`.
  - **Overige onderdelen:** live timing, achtergrondtaken en bestanden leest het uit `https://app.evenyo.io/status.json`. Dat is het openbare statusadres in evenyo-v3; het geeft per onderdeel alleen `operational` of `outage` terug, zonder technische details.
- Mislukt een meting, dan probeert het script het na 5 seconden nog één keer. Pas daarna telt het als storing. Een antwoord dat langer dan 4 seconden duurt, telt als "traag".
- De geschiedenis van 90 dagen staat in `history.json` op de gepubliceerde site. Elke run haalt dat bestand op, voegt de meting toe en publiceert alles opnieuw naar GitHub Pages.
  - Is de vorige geschiedenis niet op te halen, dan stopt de run en overschrijft hij niets.
  - Begin je opnieuw (bijvoorbeeld na een verhuizing), start de workflow dan handmatig met **fresh** aangevinkt.
- Tijdens lopend onderhoud telt uitval van de betrokken onderdelen niet mee in het percentage; de dag wordt blauw.
- De laatst bekende meldingen uit Evenyo worden bewaard, zodat ze zichtbaar blijven als Evenyo zelf plat ligt.
- De pagina is er in het Nederlands (`/`), Engels (`/en/`) en Duits (`/de/`). Bij het eerste bezoek kiest hij de taal van de browser.
- Onderdelen staan in `checks.config.json`, met namen per taal. Meldingen verschijnen in de taal waarin je ze schrijft.

## Een storing of onderhoud melden

**Normaal:** in Evenyo onder **Super admin → Statuspagina**. Daar zet je een storing, verstoring, mededeling of gepland onderhoud, met onderdelen (of leeg voor heel Evenyo) en updates. Die staan binnen 5 minuten op de statuspagina; onderhoud met een eindtijd staat daarna vanzelf op afgerond.

**Als Evenyo zelf plat ligt:** dan kun je daar niet bij. Maak dan een bestand aan in `incidents/`, bijvoorbeeld `incidents/2026-11-09-live-timing.md`. Gebruik `incidents/_voorbeeld.md` als basis; bestanden die met `_` beginnen worden overgeslagen.

```md
---
title: Live timing valt af en toe weg
impact: degraded          # outage, degraded, maintenance of none
components: realtime      # ids uit checks.config.json, met komma's
started: 2026-11-09 14:20 # Nederlandse tijd
ends:                     # optioneel, bij onderhoud: daarna vanzelf afgerond
resolved:                 # leeg zolang de storing loopt
---
### 14:20 · Onderzoek
Wat er speelt, in gewone taal.
```

Push het bestand, dan staat de melding binnen een minuut online:

- **Lopende storing:** zolang `resolved` leeg is, staat de melding bovenaan. De genoemde onderdelen krijgen dan minstens de status uit `impact`.
- **Opgelost:** vul `resolved` in en voeg een update toe.
- **Gepland onderhoud:** gebruik `impact: maintenance` met een `started` in de toekomst.

## Lokaal testen

```bash
HISTORY_FILE=/tmp/history.json node scripts/check.mjs
open dist/index.html
```

Met `PLATFORM_STATUS_URL` en `SITE_URL` stuur je de metingen naar een ander adres.

## Eenmalig instellen

1. **Repo openbaar maken.** GitHub Pages werkt in het gratis organisatieplan alleen voor openbare repo's. Een privérepo zou ook ongeveer 8.600 Actions-minuten per maand kosten, terwijl er 2.000 gratis zijn. Er staan geen geheimen in deze repo.
2. **GitHub Pages aanzetten.** Ga naar **Settings → Pages → Source** en kies **GitHub Actions**.
3. **DNS instellen in Cloudflare.** Maak een `CNAME`-record `status` → `totalwebcreations.github.io` aan, met de proxy **uit** (grijze wolk).
4. **Eigen domein koppelen.** Vul onder **Settings → Pages → Custom domain** `status.evenyo.io` in en zet **Enforce HTTPS** aan.
5. **Eerste run starten.** Ga naar **Actions → Status → Run workflow** en vink **fresh** aan.
