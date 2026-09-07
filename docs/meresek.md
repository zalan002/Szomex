# Mérési leltár és átállás

Forrás: a tolgyalapanyag.hu nyilvános HTML-je és a `GTM-T2Z9LF8Z` közzétett, 9-es verziójú konténere. Felmérés: 2026-09-07. Google-fiókhoz adminisztrációs hozzáférés nem állt rendelkezésre; a felhasználó szerint korábbi Meta-mérés nincs.

| Elem | Azonosító / esemény | Kezelés |
| --- | --- | --- |
| Google Analytics 4 | `G-5W1XXG6H15` | Megőrizve, analitikai hozzájárulás után |
| Google Ads | `AW-16959665415` | Megőrizve, marketing hozzájárulás után |
| Meglévő űrlapkonverzió | `wGcRCIuopNIaEIfq_5Y_` | Eredetileg `/koszonooldal` URL; most csak sikeres szerveroldali fogadás |
| Meglévő GA4 esemény | `form_bekuldes` | Ugyanaz az eseménynév megőrizve sikeres fogadáskor |
| Korábbi másik konverzió | `rKIECMahl7UaEIfq_5Y_` | `/contact/success` URL-re volt kötve. Ilyen működő útvonal az oldaltérképben nem volt; nem tüzeljük a másik konverzió mellett |
| Másik GA4 esemény | `ajanlatkeres` | A fenti `/contact/success` szabályhoz tartozott; archív mérési leltárban megőrizve |
| Google Tag Manager | `GTM-T2Z9LF8Z` | Azonosító és nyilvános konfiguráció leltározva; a tényleges tagokat közvetlenül futtatjuk |
| Microsoft Clarity | `rf8y3ss130` | Megőrizve, analitikai hozzájárulás és ConsentV2 jelek alapján |
| Meta Pixel | Még nincs azonosító | Bekötési pont kész, `PUBLIC_META_PIXEL_ID` szükséges |

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
| `generate_lead` | Sikeres e-mail-szolgáltatói átvétel | Véletlen eseményazonosító, űrlaptípus |
| `form_bekuldes` | Ugyanaz a siker, régi GA4 kompatibilitás | Ugyanaz |
| Meta `ViewContent` | Lépcsős oldal, marketing hozzájárulás után | Termékkategória |
| Meta `Lead` | Sikeres ajánlatkérés, marketing hozzájárulás után | Űrlapkategória + véletlen eventID |

A hozzászólás beküldése nem érdeklődő és nem vált ki Lead eseményt. Telefonkattintásból nem állítjuk, hogy létrejött beszélgetés. Az e-mail-küldő szolgáltatói átvétel nem azonos a beérkezett levél/inbox ellenőrzésével.

## Hozzájárulás és személyes adatok

Alaphelyzetben minden mérési kategória tiltott; külső mérőkód nem töltődik. Külön engedélyezhető az analitika és a marketing. Visszavonáskor a beállítás azonnal frissül, a saját mérési sütik törlődnek, majd az oldal újratöltődik. Az űrlapok `data-clarity-mask` jelölést kapnak. A térkép külön kattintás után töltődik be. Az UTM-forrás csak mérési hozzájárulás után marad meg a munkamenetben.

## Éles ellenőrzés

1. Vercel Production: `PUBLIC_ENABLE_TRACKING=true`, minden létező azonosító helyesen megadva.
2. Üres sütikkel: Google, Meta, Clarity kód nem töltődhet be.
3. Csak analitika: GA4 és Clarity, Meta nélkül. Csak marketing: Google Ads és beállított Meta, GA4/Clarity nélkül.
4. Sikeres teszt-űrlap: az e-mail ténylegesen megérkezik, GA4-ban `form_bekuldes` és `generate_lead`, Google Ads-ban a megőrzött label, Metában egy `Lead`.
5. Hiba, elutasított botellenőrzés, `/koszonooldal` közvetlen megnyitása vagy újratöltése: nincs új lead-konverzió.
6. Google Ads/GA4 adminban ellenőrizni kell, hogy a régi és új GA4 esemény közül nem számítanak-e mindkettőt elsődleges konverzióként. Ez fiókhozzáférés nélkül nem igazolható.

Meta Conversions API nincs bekapcsolva: nem volt hozzá adatforrás vagy token. A böngészős Pixel-kód kész. Szerveroldali Meta-mérést csak az adatforrás és a hozzájárulási folyamat későbbi egyeztetésével szabad hozzáadni.

## Hivatalos dokumentáció

- [Google Consent Mode](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- [Clarity ConsentV2](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2)
- [Turnstile szerveroldali ellenőrzés](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Resend e-mail API](https://resend.com/docs/api-reference/emails/send-email)
