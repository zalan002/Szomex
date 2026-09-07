# Átállás WordPressről Vercelre

## Jelenlegi állapot

A forráskód és a hirdetési anyag elkészült. A domain átállítása és fizetett hirdetésindítás nem történt meg. A régi tárhelyet az éles elfogadási próba lezárásáig fenn kell tartani.

Az online ajánlatfogadás éles beállítások nélkül szándékosan nem jelent sikert. A fogadást automatikus tesztben szimulált küldőszolgáltatással ellenőrizzük; tényleges levelet még nem küldtünk.

## 1. Mentés az eredeti WordPress-adminból

- Teljes adatbázis- és `wp-content`-mentés a jelenlegi tárhelyen.
- Korábbi érdeklődők/exportok külön biztonságos mentése. Személyes adatot tartalmazó mentés ne kerüljön a nyilvános GitHub-tárba.
- Űrlap értesítési címzettek, esetleges további címzettek, automatikus válaszok és SMTP-beállítások ellenőrzése. A nyilvánosan ismert címzett `taborfalva@szomex.hu`; rejtett beállítások nem látszottak.
- A domain DNS-rekordjainak mentése. Az e-mail MX/DKIM/SPF rekordokat meg kell őrizni.

## 2. Projekt importálása Vercelbe

Importáld a `zalan002/Szomex` tárat. Framework **Other**, root a repository gyökere, install `npm ci`, build `npm run build`, output `dist`. Node 22 LTS. A `vercel.json` elvégzi a többi beállítást.

Először Preview telepítés készüljön. Az előnézet `noindex`, mérések nélkül. A saját domain Productionre váltása külön lépés.

## 3. Űrlapküldés

Vercel Environment Variables:

| Név | Beállítás |
| --- | --- |
| `SITE_URL` | `https://tolgyalapanyag.hu` |
| `RESEND_API_KEY` | Saját Resend API-kulcs |
| `LEAD_FROM` | A Resendben hitelesített céges küldő; az érdeklődő címét nem szabad ide írni |
| `LEAD_TO` | `taborfalva@szomex.hu` |
| `TURNSTILE_SITE_KEY` | Nyilvános Turnstile webhelykulcs |
| `TURNSTILE_SECRET_KEY` | A hozzá tartozó titkos kulcs |

A Turnstile widget engedélyezett domainjei között szerepeljen a pontos éles és tesztdomain. A szerver a domain és a `lead` action értékét is ellenőrzi. A saját éles címen kívüli Vercel-alias használatához a `SITE_URL` a vizsgált aliasra állítható; a konkrét Vercel deployment URL automatikusan engedélyezett.

Az e-mail titkoknak csak a szerveren van helyük. A `TURNSTILE_SITE_KEY` buildkor kerül az oldalba, ezért módosítás után új telepítés szükséges. A szerveradatok és űrlapok nem a régi WordPress-endpointra kerülnek.

## 4. Mérések

A `.env.example` tartalmazza a megtalált Google- és Clarity-azonosítókat. Productionben legyen `PUBLIC_ENABLE_TRACKING=true`; Meta Pixel azonosítót később kell megadni. A régi GTM konténert ne kapcsold be a közvetlen mérések mellé, mert duplikációt okozhat. Részletek a `meresek.md` fájlban.

A Google-fiók tulajdonosa ellenőrizze a konverziók elsődleges/másodlagos besorolását és a Google Ads–GA4 összekötést. A kód átvétele nem biztosít adminjogot vagy riporthozzáférést.

## 5. Tartalmi és működési jóváhagyás

- A főoldal eredeti tartalmát megőriztük, az ott szereplő raktárkészlet-, 24 órás válasz- és gyártásihatáridő-állítások aktuális voltát a cég ellenőrizze.
- A lépcsős oldal nem ígér fix árat vagy határidőt; az alapanyag-értékesítést világosan elválasztja a beszereléstől.
- Az új adatkezelési szöveg tervezet. Az üzemeltetőnek igazolnia kell a cégadatokat, a tényleges adatfeldolgozókat és a javasolt 90 napos lezártérdeklődő-megőrzés alkalmazhatóságát. A levelek törlési rendjét a postafiókban kell megvalósítani; a weboldal nem töröl ott automatikusan.
- A mintablog kommentjei e-mailes moderálásra mennek. Nincs WordPress-szerkesztő vagy adminmigráció. A moderált hozzászólás a forrásban tehető közzé.

## 6. Elfogadási próba és domainváltás

1. `npm run check` sikeres; mobilon és asztali eszközön a cég nézze át a tartalmat.
2. Valós céges tesztbeküldés, postafiókba érkezés, Reply-To válasz, időtúllépés utáni ismétlés ellenőrzése.
3. Sütielutasítás, csak analitika, csak marketing, visszavonás; Google/Meta tesztesemények ellenőrzése.
4. Vercelben a `tolgyalapanyag.hu` és `www.tolgyalapanyag.hu` domain hozzáadása, a Vercel által ténylegesen megadott DNS-értékek beállítása. Ne használj kitalált A/CNAME értéket, és ne módosítsd az MX-rekordokat.
5. TLS, www/nem-www főcím, főoldal, `/lepcso`, régi köszönőoldal, képek, menü, térkép és 404 ellenőrzése az éles domainen.
6. Search Console-ban az új `sitemap.xml` beküldése a megfelelő tulajdonosi fiókból.
7. Csak a próba után induljon a jóváhagyott keretű Facebook-kampány.

## Visszaállás

Hiba esetén a korábban mentett webes DNS-rekordokat állítsd vissza az eredeti tárhelyre, vagy Vercelben állj vissza az előző ellenőrzött deploymentre. A régi WordPress-adatbázist és az eredeti levelezést ne töröld az átállás részeként.

## Átvett útvonalak

`/`, `/koszonooldal`, `/sample-page`, `/2025/05/30/hello-world`, `/category/uncategorized`. Az eredeti szekcióhorgonyok: `#Megoldasaink`, `#Meretek`, `#Rolunk`, `#GYIK`, `#Kontakt`. Új: `/lepcso`, `/adatkezeles`, `/kereses`. A főoldal keresőjének régi `?s=` mintája az új keresőre irányítható. A keresés a honlap tartalmi oldalait tartalmazza; nem általános WordPress-adatbáziskereső.
