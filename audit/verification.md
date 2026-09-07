# Ellenőrzés – 2026-09-07

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
