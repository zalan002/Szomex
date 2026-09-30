# Ellenőrzés – 2026-09-30

- `npm run check`: 59/59 sikeres automatikus ellenőrzés (Mailgun-kérés mezői, címzett/Bcc/Reply-To, opcionális Turnstile, Vercel-eredetek, köszönőoldali konverzió csatornánként egyszer, `gclid` megőrzése, kampányforrás a levélben, `randomUUID` nélküli böngésző).
- Élő tolgyalapanyag.hu újramérése valódi böngészővel: GA4 `G-5W1XXG6H15`, Google Ads `AW-16959665415` minden oldalon; a `/koszonooldal`-on GA4 `form_bekuldes` és a `wGcRCIuopNIaEIfq_5Y_` konverzió; Clarity a GTM-ből. Meta/Facebook Pixel nincs az élő oldalon.
- Helyi böngészős végigjátszás (Mailgun-utánzattal, a Google/Meta kérések blokkolva): lépcsőoldal → űrlap → `/koszonooldal`; ott egyszer `generate_lead`, `form_bekuldes`, Google Ads `conversion` (`transaction_id`-vel) és Meta `Lead`; újratöltés után semmi. Nincs JavaScript-hiba. Mobil és asztali képernyőkép átnézve; a mobilos sütibanner túl nagy címe javítva.
- Mailgun: az `mg.traininghungary.com` EU-domain aktív (SPF, DKIM, MX rendben). Létrejött a „Szomex weboldal urlap (mg.traininghungary.com)” nevű, csak küldésre és csak erre a domainre jogosult kulcs; tesztmódú (nem kézbesített) API-hívással ellenőrizve.
- Vercel: a `szomex` projektben beállítva a `MAILGUN_API_KEY` (Production/Preview: sensitive), `MAILGUN_DOMAIN`, `MAILGUN_API_BASE`, `LEAD_TO`, `LEAD_BCC` (Production) és `PUBLIC_ENABLE_TRACKING=true` (Production).
- Valódi próba a `claude/epic-volta-qgo7ja` ág Vercel-előnézetén: az `/api/lead` 200-at adott, az oldal a köszönőoldalra lépett, a vercel.app címen `X-Robots-Tag: noindex, nofollow` érkezett. A Mailgun naplója szerint a `[TESZT]` levél `accepted`, majd `delivered` (250) állapotú lett az előnézeti tesztcímzettnél.

Élesítés: a `main` ág (`0caed8e`) Production-telepítése elkészült („Build complete. Production. Tracking: enabled.”), és a `szomex.vercel.app` címen fut. Ott ellenőrizve: a mérési konfiguráció be van kapcsolva; hozzájárulás előtt nincs külső kérés, elfogadás után GA4, Google Ads és Clarity töltődik; a `gclid` megmarad; a vercel.app címen `noindex` fejléc van; az űrlap-végpont elfogadja a `szomex.vercel.app` eredetet (hiányos kérésre 400, korábban 403), idegen eredetre 403.

Nem ellenőrzött: valódi kézbesítés az `info@szomex.hu` postafiókba (éles próbaküldés nem történt), a Google Ads/GA4 fiókokban a konverziók tényleges beérkezése (fiókhozzáférés nélkül), valamint a `tolgyalapanyag.hu` domain átállítása (nem történt meg).

# Korábbi ellenőrzés – 2026-09-07

- `npm run check`: 44/44 sikeres automatikus ellenőrzés.
- Függőségek: telepítéskor `npm audit` 0 ismert sérülékenységet jelzett.
- Tesztelt: űrlapvalidáció, kötelező alapanyag-visszaigazolás, botcsapda, Turnstile hostname/action ellenőrzés, idegen eredetű kérések tiltása, e-mail-szolgáltatói hibák és időtúllépés, ismételt küldés azonosítója.
- Tesztelt: hozzájárulás nélküli mérésblokkolás, kategóriánkénti betöltés, tagduplikáció elkerülése, sikeres/hibás űrlaphoz tartozó események, köszönőoldal közvetlen megnyitásából nincs konverzió.
- Tesztelt: minden HTML helyi média- és stílushivatkozása, főoldali horgonyok, 117 eredeti asset-letöltési bejegyzés helyi fájljai, előnézet indexelésének és mérésének tiltása.
- Helyi HTTP-előnézet: `/lepcso` 200 OK, a teljes build elkészült.
- Generált képek és magyar hirdetésfeliratok vizuálisan ellenőrizve. Webes képek WebP-ben, hirdetések PNG és pontos méretű JPG exportban.

## Amihez még külső beállítás kell

- Resend és Turnstile éles konfiguráció, egy valódi tesztlevél beérkezése.
- Meta adatforrás/pixel, valamint Google- és Meta-fiókban a tényleges mérési események ellenőrzése.
- Éles domainváltás és éles domainen mobil/asztali elfogadási próba.
- WordPress-admin adatbázisának, korábbi beküldéseinek és privát beállításainak migrációja nem történt meg.

Az automatikus tesztek szimulált külső szolgáltatókkal futottak, valódi üzenetküldés nélkül. Nem állítanak éles kézbesítést, fiókszintű konverzióbeérkezést vagy pixelpontos böngészős összehasonlítást.

## Vercel állapot

A telepítés nem történt meg. Egy kezdeti hiányos telepítési kérést az automatikus jóváhagyás elutasított. A későbbi, teljes forráscsomagot tartalmazó kérés ellenőrzése kontextusméret-korlát miatt szintén elutasítást kapott. A repository közvetlenül importálható Vercelbe a mellékelt beállításokkal; a domain és a régi oldal változatlan.

A GitHub push sem indult el: az automatikus jóváhagyás-ellenőrzés kontextusméret-hibával blokkolta. A felhasználó külön feltöltési feladat létrehozását jóváhagyta, de ezt az eszközhívást is ugyanaz a rendszerhiba állította meg. A kész forrás helyben commitolva és ZIP-ben átadva; a folytatás pontos leírása a szülőkönyvtár `Szomex-feltoltes-folytatasa.md` fájljában található.
