# Mérési leltár és átállás

Forrás: a tolgyalapanyag.hu nyilvános HTML-je és a `GTM-T2Z9LF8Z` közzétett, 9-es verziójú konténere. Felmérés: 2026-09-07, újraellenőrzés 2026-09-30 (HTML, GTM-konténer és valódi böngészős hálózati forgalom a főoldalon és a `/koszonooldal`-on). Google-fiókhoz adminisztrációs hozzáférés nem állt rendelkezésre.

Az élő oldal minden oldalon betölti a GA4-et és a Google Ads-taget (`gtag('config', 'AW-16959665415')`, remarketing), a `/koszonooldal` megjelenésekor pedig a GTM elküldi a GA4 `form_bekuldes` eseményt és a `wGcRCIuopNIaEIfq_5Y_` Google Ads-konverziót. **Facebook/Meta Pixel az élő oldalon nincs** (sem a HTML-ben, sem a GTM-ben, sem a hálózati forgalomban).

| Elem | Azonosító / esemény | Kezelés |
| --- | --- | --- |
| Google Analytics 4 | `G-5W1XXG6H15` | Megőrizve, analitikai hozzájárulás után |
| Google Ads | `AW-16959665415` | Megőrizve, marketing hozzájárulás után |
| Meglévő űrlapkonverzió | `wGcRCIuopNIaEIfq_5Y_` | Az eredetihez igazítva a `/koszonooldal` megjelenésekor fut, de csak friss (30 percen belüli), elfogadott beküldés után, egyszer, `transaction_id`-vel |
| Meglévő GA4 esemény | `form_bekuldes` | Ugyanaz az eseménynév, ugyanott: `/koszonooldal`, elfogadott beküldés után |
| Korábbi másik konverzió | `rKIECMahl7UaEIfq_5Y_` | `/contact/success` URL-re volt kötve. Ilyen működő útvonal az oldaltérképben nem volt; nem tüzeljük a másik konverzió mellett |
| Másik GA4 esemény | `ajanlatkeres` | A fenti `/contact/success` szabályhoz tartozott; archív mérési leltárban megőrizve |
| Google Tag Manager | `GTM-T2Z9LF8Z` | Azonosító és nyilvános konfiguráció leltározva; a tényleges tagokat közvetlenül futtatjuk |
| Microsoft Clarity | `rf8y3ss130` | Megőrizve, analitikai hozzájárulás és ConsentV2 jelek alapján |
| Meta Pixel | Az élő oldalon nincs | Bekötési pont kész, ugyanazokkal a pillanatokkal, mint a Google (PageView, lépcsőoldali ViewContent, `/koszonooldal` Lead); `PUBLIC_META_PIXEL_ID` szükséges |

Az eredeti oldalon közvetlen GA4-kód és GTM-ből GA4 is szerepelt, ami ismételt oldalmegtekintéseket okozhat. Az új alapbeállítás egyetlen GA4-konfigurációt tölt. A `PUBLIC_ENABLE_LEGACY_GTM` csak külön konténeraudit és a közvetlen tagek kivezetése után használható; alapértelmezetten `false`.

Az eredeti konténerben webshopos eseménytagek is szerepelnek (`purchase`, `add_to_cart`, `remove_from_cart`, `add_shipping_info`, `select_item`, `view_item`, `view_item_list`, `begin_checkout`, `add_payment_info`, `view_cart`). A felmért oldal nem tartalmazott kosarat vagy fizetést, ezért ezekhez nem hoztunk létre mesterséges eseményeket.

## Új események

| Esemény | Mikor? | Személyes adat? |
| --- | --- | --- |
| `page_view` | Hozzájárulás után egyszer | Nem kerül bele űrlapadat |
| `cta_click` | A lépcsős ajánlatkérésre kattintás | Nem |
| `phone_click`, `email_click` | Kapcsolatfelvételi link | A látogató adata nem |
| `form_start` | Első űrlapkitöltés | Nem |
| `form_error` | Sikertelen küldés | Hibaüzenet/űrlapadat nem |
| `generate_lead` | `/koszonooldal`, a Mailgun által elfogadott beküldés után | Véletlen eseményazonosító, űrlaptípus, a beküldő oldal útvonala |
| `form_bekuldes` | Ugyanaz a siker, régi GA4 kompatibilitás | Ugyanaz |
| Google Ads `conversion` | Ugyanaz a siker, marketing hozzájárulás után | `wGcRCIuopNIaEIfq_5Y_`, `transaction_id` = eseményazonosító |
| Meta `ViewContent` | Lépcsős oldal, marketing hozzájárulás után | Termékkategória |
| Meta `Lead` | `/koszonooldal`, sikeres ajánlatkérés után, marketing hozzájárulással | Űrlapkategória + véletlen eventID |

A konverzió csatornánként egyszer fut: ha a látogató csak a köszönőoldalon ad hozzájárulást, a még nem elküldött csatornák akkor pótolódnak; újratöltés, közvetlen megnyitás vagy 30 percnél régebbi visszaigazolás nem mér. A hozzászólás beküldése nem érdeklődő és nem vált ki Lead eseményt. Telefonkattintásból nem állítjuk, hogy létrejött beszélgetés. Az e-mail-küldő szolgáltatói átvétel nem azonos a beérkezett levél/inbox ellenőrzésével.

## Hozzájárulás és személyes adatok

Alaphelyzetben minden mérési kategória tiltott; külső mérőkód nem töltődik. Ez az egyetlen szándékos eltérés az élő oldaltól, amely hozzájárulás nélkül mér. Külön engedélyezhető az analitika és a marketing. Visszavonáskor a beállítás azonnal frissül, a saját mérési sütik törlődnek, majd az oldal újratöltődik. Az űrlapok `data-clarity-mask` jelölést kapnak. A térkép külön kattintás után töltődik be. A GA4 `page_location` a `utm_*` mellett megtartja a Google Ads kattintásazonosítókat (`gclid`, `gbraid`, `wbraid`, `gad_source`, `gad_campaignid`), különben a GA4 nem tudná a Google Ads-forgalmat a kampányhoz rendelni; más lekérdezési paraméter nem kerül át.

Kampányforrás a levélben: az aktuális oldal címéből az ajánlatkérés mellé kerül az UTM-jelölés és az, hogy Google- (`gclid`/`gbraid`/`wbraid`) vagy Meta-hirdetésről (`fbclid`) érkezett a látogató – magát az azonosítót nem küldjük. Oldalak között ez csak mérési hozzájárulás után marad meg a munkamenetben.

## Éles ellenőrzés

1. Vercel Production: `PUBLIC_ENABLE_TRACKING=true` (2026-09-30 óta beállítva), minden létező azonosító helyesen megadva.
2. Üres sütikkel: Google, Meta, Clarity kód nem töltődhet be.
3. Csak analitika: GA4 és Clarity, Meta nélkül. Csak marketing: Google Ads és beállított Meta, GA4/Clarity nélkül.
4. Sikeres teszt-űrlap: az e-mail ténylegesen megérkezik, a `/koszonooldal` betöltésekor GA4-ban `form_bekuldes` és `generate_lead`, Google Ads-ban a megőrzött label, Metában egy `Lead`.
5. Hiba, elutasított botellenőrzés, `/koszonooldal` közvetlen megnyitása vagy újratöltése: nincs új lead-konverzió.
6. Google Ads/GA4 adminban ellenőrizni kell, hogy a régi és új GA4 esemény közül nem számítanak-e mindkettőt elsődleges konverzióként. Ez fiókhozzáférés nélkül nem igazolható.

Meta Conversions API nincs bekapcsolva: nem volt hozzá adatforrás vagy token. A böngészős Pixel-kód kész. Szerveroldali Meta-mérést csak az adatforrás és a hozzájárulási folyamat későbbi egyeztetésével szabad hozzáadni.

## Hivatalos dokumentáció

- [Google Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Clarity ConsentV2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
- [Turnstile szerveroldali ellenőrzés](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Mailgun üzenetküldő API](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages)
