# SZOMEX – Tölgy Alapanyag

A tolgyalapanyag.hu nyilvános WordPress/Divi oldalának önálló, Vercelre előkészített változata, új `/lepcso` érdeklődőszerző oldallal és Facebook-hirdetési csomaggal.

## Mi készült el?

- Az eredeti főoldal HTML-je, arculata, szövegei, képei, betűkészletei és Divi megjelenési fájljai helyben vannak. A menü, szekcióhivatkozások, GYIK, galéria, kapcsolat és térkép megmaradt.
- Új `/lepcso`: három generált lépcsőkép, mobilos ajánlatkérés, alapanyag/beszerelés egyértelmű elhatárolása, méret- és időpontkérdések.
- Köszönőoldal, adatkezelési tájékoztató tervezete, keresés és 404. A régi mintabejegyzés és kategória címei is megmaradtak.
- Saját Vercel-funkció az űrlapfogadáshoz: szerveroldali validáció, botvédelem (honeypot, eredetellenőrzés, opcionális Turnstile) és e-mail-küldés **Mailgunnal** (EU-régió, `mg.traininghungary.com`). Címzett: **Szomex Kft. <info@szomex.hu>**, a beérkező érdeklődőkről titkos másolat (`LEAD_BCC`) megy.
- Az eredeti oldallal azonos GA4 (`G-5W1XXG6H15`), Google Ads (`AW-16959665415`) és Clarity azonosítók. A Google Ads-konverzió (`wGcRCIuopNIaEIfq_5Y_`) és a GA4 `form_bekuldes` az eredetihez hasonlóan a `/koszonooldal` megjelenésekor fut, de csak valódi, elfogadott beküldés után. Hozzájárulástól függő betöltés. Meta Pixel bekötési pont (PageView, ViewContent, Lead) – az eredeti oldalon nincs Pixel, azonosító kell hozzá.
- `marketing/`: két feed- és egy Story-kreatív, pontos méretű JPG exportok, szövegek, UTM-linkek, induló beállítások és eredménykövető sablon.

## Indítás helyben

Node.js 22 vagy újabb támogatott LTS-verzió szükséges.

```sh
npm ci
npm run check
npm run dev
```

Előnézet: `http://localhost:4173`, lépcsőoldal: `http://localhost:4173/lepcso`. A helyi előnézet nem küld marketingmérést. Az online űrlap `MAILGUN_API_KEY` nélkül nem jelez sikeres beküldést (503).

## Vercel telepítés

A `zalan002/Szomex` repository importálható Vercelbe. Framework: **Other**, gyökérkönyvtár: a repository gyökere. A build és output beállítását a `vercel.json` tartalmazza. A statikus oldal a `dist/`, a szerverfunkció az `api/lead.js` fájlból készül.

Másold át a szükséges beállításokat a `.env.example` alapján a Vercel környezeti változói közé. Kulcsot ne írj a GitHub-repositoryba. Élesítés előtt kövesd a [telepítési és átállási útmutatót](docs/atallas.md).

## Vercel környezeti változók (beállítva: 2026-09-30, `szomex` projekt)

| Változó | Production | Preview / Development |
| --- | --- | --- |
| `MAILGUN_API_KEY` | Csak küldésre, csak az `mg.traininghungary.com` domainre jogosult Mailgun-kulcs („Szomex weboldal urlap”) | ugyanaz |
| `MAILGUN_DOMAIN`, `MAILGUN_API_BASE` | `mg.traininghungary.com`, `https://api.eu.mailgun.net/v3` | ugyanaz |
| `LEAD_TO` | `Szomex Kft. <info@szomex.hu>` | a tesztelő saját címe – előnézetből nem megy levél az ügyfélnek |
| `LEAD_BCC` | a másolatot kérő cím | – |
| `PUBLIC_ENABLE_TRACKING` | `true` | – (előnézetben a mérés mindig ki van kapcsolva) |

Előnézeti levelek tárgya `[TESZT]` előtaggal indul. Új érték csak új telepítéssel él. Részletek: [telepítési és átállási útmutató](docs/atallas.md).

## Ami még külső lépést igényel

1. Meta Pixel: az eredeti oldalon nincs, ezért a Meta Events Managerben létrehozott azonosítót `PUBLIC_META_PIXEL_ID` néven kell megadni.
2. Cloudflare Turnstile (ajánlott, nem kötelező): mindkét kulcs megadása után a szerver kötelezően ellenőriz.
3. A Production 2026-09-30 óta a `szomex.vercel.app` címen fut. Hátravan: egy éles próbaküldés az `info@szomex.hu`-ra, a mérési fiókokban az események ellenőrzése, majd a `tolgyalapanyag.hu` domain átirányítása. A fizetett kampány nincs elindítva.

## Fontos működési eltérések

Ez Vercelen futó weboldal, nem WordPress-adminisztráció. A szövegek a `src/` fájlokban szerkeszthetők. A régi WordPress-adatbázis, korábbi űrlapbeküldések, adminisztrátori fiókok és a szerkesztőfelület nem kerültek át.

A régi mintabejegyzés hozzászólásai statikusan megmaradnak. Új hozzászólás e-mailben moderálásra küldhető; a közzététel a forrás frissítésével történik. A régi WordPress-adminban történő moderálás nincs megvalósítva. A lépcsőfotók AI-val készült inspirációk, nem vállalati referenciák.

A sütikezelés új, konzervatív megoldás: mérés csak hozzájárulás után. Az eredeti köszönőoldal-megtekintéshez kötött konverziót tényleges, sikeres beküldés váltja ki, ezért a közvetlen látogatás/újratöltés nem hoz létre hamis érdeklődőt. A régi GTM konténer nincs a közvetlen tagek mellett párhuzamosan betöltve. Részletek: [mérési leltár](docs/meresek.md).

## Fájlok

| Hely | Tartalom |
| --- | --- |
| `src/index.html` | Eredeti főoldal átvett szerkezete |
| `src/lepcso.html` | Új lépcsős oldal |
| `src/partials/form.html` | Új ajánlatkérő űrlap |
| `public/assets/site.css`, `site.js` | Új oldal, űrlap, sütikezelés és mérések |
| `public/wp-content`, `public/wp-includes` | Az eredeti oldal saját példányban tárolt fájljai |
| `api/lead.js`, `lib/lead.mjs` | Szerveroldali fogadás és Mailgun e-mail |
| `audit/` | Nyilvános források leltára, ellenőrzési nyom |
| `tests/` | Űrlap, hozzájárulás, konverzió és tartalmi ellenőrzések |
| `marketing/` | Hirdetési csomag és generálási promptok |

Az `audit:source` újra beolvassa a régi oldalt és felülírja az importált HTML-eket; ezt csak szándékos újraimportáláshoz használd. A normál build teljesen helyi és nem függ a régi tárhelytől. A saját és átvett anyagok felhasználási jogai az eredeti jogosultaknál maradnak.
