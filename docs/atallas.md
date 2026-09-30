# Átállás WordPressről Vercelre

## Jelenlegi állapot

A forráskód és a hirdetési anyag elkészült. A domain átállítása és fizetett hirdetésindítás nem történt meg. A régi tárhelyet az éles elfogadási próba lezárásáig fenn kell tartani.

Az e-mail-küldés Mailgunnal működik, a Vercel-változók 2026-09-30 óta be vannak állítva (lásd 3. pont). Kulcs nélkül az online ajánlatfogadás szándékosan nem jelent sikert (503).

## 1. Mentés az eredeti WordPress-adminból

- Teljes adatbázis- és `wp-content`-mentés a jelenlegi tárhelyen.
- Korábbi érdeklődők/exportok külön biztonságos mentése. Személyes adatot tartalmazó mentés ne kerüljön a nyilvános GitHub-tárba.
- Űrlap értesítési címzettek, esetleges további címzettek, automatikus válaszok és SMTP-beállítások ellenőrzése. Az új oldal űrlapjainak címzettje `info@szomex.hu`; a honlapon továbbra is az eredeti `taborfalva@szomex.hu` elérhetőség látszik.
- A domain DNS-rekordjainak mentése. Az e-mail MX/DKIM/SPF rekordokat meg kell őrizni.

## 2. Projekt importálása Vercelbe

Importáld a `zalan002/Szomex` tárat. Framework **Other**, root a repository gyökere, install `npm ci`, build `npm run build`, output `dist`. Node 22 LTS. A `vercel.json` elvégzi a többi beállítást.

Először Preview telepítés készüljön. Az előnézet `noindex`, mérések nélkül. A saját domain Productionre váltása külön lépés.

## 3. Űrlapküldés (Mailgun)

A `/api/lead` a Mailgun HTTP API-ján küld (EU-régió, `mg.traininghungary.com` küldődomain, SPF és DKIM rendben). Az érdeklődő címe csak `Reply-To`, sosem feladó; a levél tárgyában szerepel a neve. Kattintás- és megnyitáskövetés kikapcsolva.

Vercel → `szomex` → Settings → Environment Variables (beállítva 2026-09-30):

| Név | Production | Preview, Development |
| --- | --- | --- |
| `MAILGUN_API_KEY` | Domainre korlátozott küldőkulcs („Szomex weboldal urlap”); Productionben és Preview-ban *sensitive* | ugyanaz |
| `MAILGUN_DOMAIN` | `mg.traininghungary.com` | ugyanaz |
| `MAILGUN_API_BASE` | `https://api.eu.mailgun.net/v3` | ugyanaz |
| `LEAD_TO` | `Szomex Kft. <info@szomex.hu>` | a tesztelő címe |
| `LEAD_BCC` | titkos másolat a beérkező érdeklődőkről | – |
| `LEAD_FROM` | nincs megadva: `Tölgy Alapanyag weboldal <noreply@mg.traininghungary.com>` | ugyanaz |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | nincs megadva (opcionális) | – |

Előnézetből `[TESZT]` tárgyú levél megy, és nem az ügyfélnek. A Mailgun admin kulcsát ne tedd a weboldalra: ha új kulcs kell, a Mailgunban hozz létre `sending` szerepű, `domain` típusú kulcsot erre a domainre, és cseréld a `MAILGUN_API_KEY` értékét.

**Ha nem érkezik levél:** Vercel → `szomex` → Logs, szűrés `/api/lead`-re (`[lead]` kezdetű sorok; személyes adatot nem naplózunk). A válaszkód: `400` hibás mező, `403` idegen eredet, `503` hiányzó kulcs, `502` a Mailgun nem fogadta el. A Mailgun → Logs nézetben a `szomex-ajanlatkeres` címke és a levélben szereplő azonosító (`v:lead_id`) alapján kereshető a kézbesítés. Ha egy címzett visszapattant, a Mailgun letiltólistára teheti, és a további leveleket nem kézbesíti: ilyenkor a Suppressions listából törölni kell.

A Turnstile opcionális. Ha mindkét kulcsot megadod, a szerver kötelezően ellenőrzi a domaint és a `lead` action értékét; a widget engedélyezett domainjei között szerepeljen az éles és a tesztdomain. A `TURNSTILE_SITE_KEY` buildkor kerül az oldalba, ezért módosítás után új telepítés szükséges.

Engedélyezett küldési eredet: `tolgyalapanyag.hu`, `www.tolgyalapanyag.hu`, a `SITE_URL`, valamint a Vercel által adott saját deployment-, ág- és éles cím (`VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`). A `*.vercel.app` címek `noindex` fejlécet kapnak.

## 4. Mérések

A `.env.example` tartalmazza az eredeti oldal Google- és Clarity-azonosítóit. Productionben a `PUBLIC_ENABLE_TRACKING=true` 2026-09-30 óta be van állítva; a Meta Pixel azonosítót később kell megadni (az eredeti oldalon nincs Pixel). A régi GTM konténert ne kapcsold be a közvetlen mérések mellé, mert duplikációt okozna. Részletek a `meresek.md` fájlban.

A Google-fiók tulajdonosa ellenőrizze a konverziók elsődleges/másodlagos besorolását és a Google Ads–GA4 összekötést. A kód átvétele nem biztosít adminjogot vagy riporthozzáférést.

## 5. Tartalmi és működési jóváhagyás

- A főoldal eredeti tartalmát megőriztük, az ott szereplő raktárkészlet-, 24 órás válasz- és gyártásihatáridő-állítások aktuális voltát a cég ellenőrizze.
- A lépcsős oldal nem ígér fix árat vagy határidőt; az alapanyag-értékesítést világosan elválasztja a beszereléstől.
- Az új adatkezelési szöveg tervezet. Az üzemeltetőnek igazolnia kell a cégadatokat, a tényleges adatfeldolgozókat és a javasolt 90 napos lezártérdeklődő-megőrzés alkalmazhatóságát. A levelek törlési rendjét a postafiókban kell megvalósítani; a weboldal nem töröl ott automatikusan.
- A mintablog kommentjei e-mailes moderálásra mennek. Nincs WordPress-szerkesztő vagy adminmigráció. A moderált hozzászólás a forrásban tehető közzé.

## 6. Elfogadási próba és domainváltás

1. `npm run check` sikeres; mobilon és asztali eszközön a cég nézze át a tartalmat.
2. Valós céges tesztbeküldés Productionből: érkezés az `info@szomex.hu` fiókba és a titkos másolat, Reply-To válasz, időtúllépés utáni ismétlés ellenőrzése.
3. Sütielutasítás, csak analitika, csak marketing, visszavonás; Google/Meta tesztesemények ellenőrzése.
4. Vercelben a `tolgyalapanyag.hu` és `www.tolgyalapanyag.hu` domain hozzáadása, a Vercel által ténylegesen megadott DNS-értékek beállítása. Ne használj kitalált A/CNAME értéket, és ne módosítsd az MX-rekordokat.
5. TLS, www/nem-www főcím, főoldal, `/lepcso`, régi köszönőoldal, képek, menü, térkép és 404 ellenőrzése az éles domainen.
6. Search Console-ban az új `sitemap.xml` beküldése a megfelelő tulajdonosi fiókból.
7. Csak a próba után induljon a jóváhagyott keretű Facebook-kampány.

## Visszaállás

Hiba esetén a korábban mentett webes DNS-rekordokat állítsd vissza az eredeti tárhelyre, vagy Vercelben állj vissza az előző ellenőrzött deploymentre. A régi WordPress-adatbázist és az eredeti levelezést ne töröld az átállás részeként.

## Átvett útvonalak

`/`, `/koszonooldal`, `/sample-page`, `/2025/05/30/hello-world`, `/category/uncategorized`. Az eredeti szekcióhorgonyok: `#Megoldasaink`, `#Meretek`, `#Rolunk`, `#GYIK`, `#Kontakt`. Új: `/lepcso`, `/adatkezeles`, `/kereses`. A főoldal keresőjének régi `?s=` mintája az új keresőre irányítható. A keresés a honlap tartalmi oldalait tartalmazza; nem általános WordPress-adatbáziskereső.
