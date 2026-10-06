# Mérési leltár és átállás

Forrás: a tolgyalapanyag.hu nyilvános HTML-je és a `GTM-T2Z9LF8Z` közzétett, 9-es verziójú konténere. Felmérés: 2026-09-07, újraellenőrzés 2026-09-30 (HTML, GTM-konténer és valódi böngészős hálózati forgalom a főoldalon és a `/koszonooldal`-on). 2026-10-01: a sütibanner megszűnt, minden látogatót mérünk. Google-fiókhoz adminisztrációs hozzáférés nem állt rendelkezésre.

Az élő oldal minden oldalon betölti a GA4-et és a Google Ads-taget (`gtag('config', 'AW-16959665415')`, remarketing), a `/koszonooldal` megjelenésekor pedig a GTM elküldi a GA4 `form_bekuldes` eseményt és a `wGcRCIuopNIaEIfq_5Y_` Google Ads-konverziót. **Facebook/Meta Pixel az élő oldalon nincs** (sem a HTML-ben, sem a GTM-ben, sem a hálózati forgalomban).

| Elem | Azonosító / esemény | Kezelés |
| --- | --- | --- |
| Google Analytics 4 | `G-5W1XXG6H15` | Megőrizve, minden látogatónál |
| Google Ads | `AW-16959665415` | Megőrizve, minden látogatónál |
| Meglévő űrlapkonverzió | `wGcRCIuopNIaEIfq_5Y_` | Az eredetihez igazítva a `/koszonooldal` megjelenésekor fut, de csak friss (30 percen belüli), elfogadott beküldés után, egyszer, `transaction_id`-vel |
| Meglévő GA4 esemény | `form_bekuldes` | Ugyanaz az eseménynév, ugyanott: `/koszonooldal`, elfogadott beküldés után |
| Korábbi másik konverzió | `rKIECMahl7UaEIfq_5Y_` | `/contact/success` URL-re volt kötve. Ilyen működő útvonal az oldaltérképben nem volt; nem tüzeljük a másik konverzió mellett |
| Másik GA4 esemény | `ajanlatkeres` | A fenti `/contact/success` szabályhoz tartozott; archív mérési leltárban megőrizve |
| Google Tag Manager | `GTM-T2Z9LF8Z` | Azonosító és nyilvános konfiguráció leltározva; a tényleges tagokat közvetlenül futtatjuk |
| Microsoft Clarity | `rf8y3ss130` | Megőrizve, minden látogatónál (EGT-látogatóknál hozzájárulási jel nélkül süti nélküli módban, lásd lent) |
| Meta Pixel + Conversions API | Adatkészlet `2159272617955745` (2026-10-01 óta) | Pixel: PageView minden oldalon, ViewContent a lépcsőoldalon, **Lead minden `/koszonooldal`-megtekintéskor**. Szerver: elfogadott ajánlatkérésenként egy Lead (hash-elt e-mail/telefon/település, IP, böngésző, `_fbp`/`_fbc`) ugyanazzal az `event_id`-val, így a Meta a kettőt egynek számolja |

Az eredeti oldalon közvetlen GA4-kód és GTM-ből GA4 is szerepelt, ami ismételt oldalmegtekintéseket okozhat. Az új alapbeállítás egyetlen GA4-konfigurációt tölt. A `PUBLIC_ENABLE_LEGACY_GTM` csak külön konténeraudit és a közvetlen tagek kivezetése után használható; alapértelmezetten `false`.

Az eredeti konténerben webshopos eseménytagek is szerepelnek (`purchase`, `add_to_cart`, `remove_from_cart`, `add_shipping_info`, `select_item`, `view_item`, `view_item_list`, `begin_checkout`, `add_payment_info`, `view_cart`). A felmért oldal nem tartalmazott kosarat vagy fizetést, ezért ezekhez nem hoztunk létre mesterséges eseményeket.

## Új események

| Esemény | Mikor? | Személyes adat? |
| --- | --- | --- |
| `page_view` | Oldalbetöltéskor egyszer | Nem kerül bele űrlapadat |
| `cta_click` | A lépcsős ajánlatkérésre kattintás | Nem |
| `phone_click`, `email_click` | Kapcsolatfelvételi link | A látogató adata nem |
| `form_start` | Első űrlapkitöltés | Nem |
| `form_error` | Sikertelen küldés | Hibaüzenet/űrlapadat nem |
| `generate_lead` | `/koszonooldal`, a Mailgun által elfogadott beküldés után | Véletlen eseményazonosító, űrlaptípus, a beküldő oldal útvonala |
| `form_bekuldes` | Ugyanaz a siker, régi GA4 kompatibilitás | Ugyanaz |
| Google Ads `conversion` | Ugyanaz a siker | `wGcRCIuopNIaEIfq_5Y_`, `transaction_id` = eseményazonosító |
| Meta `ViewContent` | Lépcsős oldal betöltésekor | Termékkategória |
| Meta `Lead` (Pixel) | Minden `/koszonooldal`-megtekintéskor; beküldés után az ajánlatkérés azonosítójával (újratöltéskor is ugyanazzal, így a Meta nem duplikál), közvetlen megnyitáskor új azonosítóval | Űrlapkategória + eventID |
| Meta `Lead` (Conversions API) | Elfogadott ajánlatkérésenként egyszer, a szerverről | Hash-elt e-mail, telefon, település; IP, böngésző, `_fbp`/`_fbc`; ugyanaz az eventID |

A Google-konverzió (GA4, Ads) egyszer fut; újratöltés, közvetlen megnyitás vagy 30 percnél régebbi visszaigazolás nem mér. A hozzászólás beküldése nem érdeklődő és nem vált ki Lead eseményt. Telefonkattintásból nem állítjuk, hogy létrejött beszélgetés. Az e-mail-küldő szolgáltatói átvétel nem azonos a beérkezett levél/inbox ellenőrzésével.

## Mérés és személyes adatok

Sütibanner nincs: az élő oldalhoz hasonlóan minden látogatót mérünk, a Productionben minden beállított mérőkód az oldal betöltésekor elindul (a megbízó 2026-10-01-i döntése). Hozzájárulási jelet (Google Consent Mode, Clarity ConsentV2, Meta `consent`) nem küldünk, mert hozzájárulást nem kérünk; a Clarity ezért az EGT-ből érkezőknél süti nélküli módban mér, oldalmegtekintésenként új azonosítóval. Előnézetben és helyi futtatáskor nincs mérés. Az adatkezelési tájékoztató a mérést jogos érdekre alapozza és leírja a tiltakozás módját; ezt adatvédelmi szakembernek kell jóváhagynia. Az űrlapok `data-clarity-mask` jelölést kapnak. A térkép külön kattintás után töltődik be. A GA4 `page_location` a `utm_*` mellett megtartja a Google Ads kattintásazonosítókat (`gclid`, `gbraid`, `wbraid`, `gad_source`, `gad_campaignid`), különben a GA4 nem tudná a Google Ads-forgalmat a kampányhoz rendelni; más lekérdezési paraméter nem kerül át.

Kampányforrás a levélben: az aktuális oldal címéből az ajánlatkérés mellé kerül az UTM-jelölés és az, hogy Google- (`gclid`/`gbraid`/`wbraid`) vagy Meta-hirdetésről (`fbclid`) érkezett a látogató – magát az azonosítót nem küldjük. Oldalak között ez a böngésző munkamenete alatt megmarad. A levél tárgya és első sora egyértelműen jelzi a forrást: `[Google hirdetés]` (Google-kattintásazonosító vagy `utm_source=google` fizetett `utm_medium`-mal), `[Facebook hirdetés]` (`utm_source=facebook`/`instagram` fizetett `utm_medium`-mal, pl. `paid_social`), illetve `[Facebook]`, ha csak `fbclid` vagy nem fizetett Facebook-UTM érkezett – ez bejegyzésből vagy megosztott linkből is jöhet, ezért a Facebook-hirdetések céloldalán mindig legyen `utm_medium=paid_social`. A Mailgunban a `lead_source` változó ugyanezt rögzíti.

## Éles ellenőrzés

1. Vercel Production: `PUBLIC_ENABLE_TRACKING=true` (2026-09-30 óta beállítva), minden létező azonosító helyesen megadva.
2. Üres sütikkel, első betöltéskor: sütibanner nem jelenik meg; GA4, Google Ads, Clarity és a beállított Meta Pixel azonnal betöltődik.
3. Sikeres teszt-űrlap: az e-mail ténylegesen megérkezik, a `/koszonooldal` betöltésekor GA4-ban `form_bekuldes` és `generate_lead`, Google Ads-ban a megőrzött label, Metában egy `Lead`.
4. Hiba, elutasított botellenőrzés, `/koszonooldal` közvetlen megnyitása vagy újratöltése: nincs új lead-konverzió.
5. Google Ads/GA4 adminban ellenőrizni kell, hogy a régi és új GA4 esemény közül nem számítanak-e mindkettőt elsődleges konverzióként. Ez fiókhozzáférés nélkül nem igazolható.

Meta Conversions API: `META_DATASET_ID` + `FB_CAPI_TOKEN` (Vercel, Production, a token sensitive). Teszteléshez a `META_TEST_EVENT_CODE` az Events Manager „Test events” fülére irányítja a szerveres eseményeket. Meta-hiba sosem akadályozza az ajánlatkérést.

## Hivatalos dokumentáció

- [Clarity ConsentV2 és hozzájárulás nélküli mód](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
- [Turnstile szerveroldali ellenőrzés](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Mailgun üzenetküldő API](https://documentation.mailgun.com/docs/mailgun/api-reference/send/mailgun/messages)
