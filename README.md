# SZOMEX – Tölgy Alapanyag

A tolgyalapanyag.hu nyilvános WordPress/Divi oldalának önálló, Vercelre előkészített változata, új `/lepcso` érdeklődőszerző oldallal és Facebook-hirdetési csomaggal.

## Mi készült el?

- Az eredeti főoldal HTML-je, arculata, szövegei, képei, betűkészletei és Divi megjelenési fájljai helyben vannak. A menü, szekcióhivatkozások, GYIK, galéria, kapcsolat és térkép megmaradt.
- Új `/lepcso`: három generált lépcsőkép, mobilos ajánlatkérés, alapanyag/beszerelés egyértelmű elhatárolása, méret- és időpontkérdések.
- Köszönőoldal, adatkezelési tájékoztató tervezete, keresés és 404. A régi mintabejegyzés és kategória címei is megmaradtak.
- Saját Vercel-funkció az űrlapfogadáshoz: szerveroldali validáció, botvédelem, hitelesített e-mail-küldés és ismételt küldések védelme.
- Meglévő GA4, Google Ads konverzió és Clarity azonosítók; hozzájárulástól függő betöltés. Meta Pixel bekötési pont és Lead esemény.
- `marketing/`: két feed- és egy Story-kreatív, pontos méretű JPG exportok, szövegek, UTM-linkek, induló beállítások és eredménykövető sablon.

## Indítás helyben

Node.js 22 vagy újabb támogatott LTS-verzió szükséges.

```sh
npm ci
npm run check
npm run dev
```

Előnézet: `http://localhost:4173`, lépcsőoldal: `http://localhost:4173/lepcso`. A helyi előnézet nem küld marketingmérést. Az online űrlap valódi e-mail-küldési és botvédelmi beállítások nélkül nem jelez sikeres beküldést.

## Vercel telepítés

A `zalan002/Szomex` repository importálható Vercelbe. Framework: **Other**, gyökérkönyvtár: a repository gyökere. A build és output beállítását a `vercel.json` tartalmazza. A statikus oldal a `dist/`, a szerverfunkció az `api/lead.js` fájlból készül.

Másold át a szükséges beállításokat a `.env.example` alapján a Vercel környezeti változói közé. Kulcsot ne írj a GitHub-repositoryba. Élesítés előtt kövesd a [telepítési és átállási útmutatót](docs/atallas.md).

## Éles induláshoz szükséges külső beállítások

1. Resend hitelesített küldődomain + `RESEND_API_KEY`, `LEAD_FROM`. Fogadó: `taborfalva@szomex.hu`.
2. Cloudflare Turnstile webhelykulcs + titkos kulcs, az éles és tesztdomainekre beállítva.
3. `PUBLIC_ENABLE_TRACKING=true` az éles környezetben. A Google/Clarity azonosítók és az eredeti űrlapkonverzió címkéje már megvan.
4. Saját Meta Pixel azonosító a Meta webes mérésekhez; jelenleg nincs megadva.
5. Egy valódi kézbesítési próba, a mérési fiókokban az események ellenőrzése, majd a domain átirányítása. A fizetett kampány nincs elindítva.

A kód és az automatikus tesztek nem igazolják a külső szolgáltatók beállítását vagy a postafiókba történő tényleges kézbesítést. A domain átállítása nem történt meg.

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
| `api/lead.js`, `lib/lead.mjs` | Szerveroldali fogadás és e-mail |
| `audit/` | Nyilvános források leltára, ellenőrzési nyom |
| `tests/` | Űrlap, hozzájárulás, konverzió és tartalmi ellenőrzések |
| `marketing/` | Hirdetési csomag és generálási promptok |

Az `audit:source` újra beolvassa a régi oldalt és felülírja az importált HTML-eket; ezt csak szándékos újraimportáláshoz használd. A normál build teljesen helyi és nem függ a régi tárhelytől. A saját és átvett anyagok felhasználási jogai az eredeti jogosultaknál maradnak.
