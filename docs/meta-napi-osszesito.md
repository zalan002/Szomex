# SZOMEX – online napi Meta összesítő

Állapot: az online napi küldés aktív; a helyi automatizmus PAUSED. Az első napi összesítő 2026. október 15. 08:00-kor esedékes.

A weboldal meglévő Vercel–Airtable–Mailgun hátterét használja. Nem igényel bekapcsolt számítógépet, Chrome-ot, Codexet, Make- vagy Zapier-fiókot.

## Kimenet

- Oldal: Szomex Kft, `113530167004513`.
- Kizárólagos űrlap: `1114549927619150`, SZOMEX – Tölgyfa lépcső alapanyag – 2026.10.14 v2.
- Az instant form adatvédelmi linkje: https://www.szomex.hu/adatvedelem-45 . A közös CRM api alkalmazás adatvédelmi linkje: https://traininghungary.com/adatkezeles .
- Címzettek: `info@szomex.hu`, `zalan@traininghungary.com`.
- Napi első futás: 08:00 Europe/Budapest. A nyári/téli időszámítást a kód kezeli; a további aznapi időpontok helyreállítási próbák, nem újabb összesítők.
- Az előző helyi nap végéig beérkezett, még nem továbbított kitöltések. Kezdőnap: 2026.10.14.; első teljes napi jelentés: október 15.
- Minden ténylegesen visszaadott válasz bekerül a levélbe és az Airtable Üzenet mezőjébe, az API-ból visszakapott kérdésfelirattal. A fő kapcsolati adatok külön Airtable mezőkbe is bekerülnek.
- Sikeres, teljes adatlekérés után a nulla kitöltésről is érkezik összesítő. Adatlekérési hiba soha nem jelent nulla kitöltést.

## Biztonság és megbízhatóság

A weboldali űrlap és a hirdetések változatlanok. A végpont csak legalább 32 karakteres titkos Bearer kulccsal hívható. Preview környezetből nem küld levelet, az éles funkció is külön `META_DIGEST_ENABLED=true` kapcsolót igényel.

A Meta-kulcs nem kerül URL-be vagy naplóba. Csak a rögzített űrlap végpontját kérdezi le; a lapozási linkekből csak a kurzort használja. Részleges vagy hibás válasz esetén leáll.

Airtable: meglévő `appDbk2eNI5wi7FvR` / `tbldUvXLafkythnJM`. Az `Azonosító` mező `meta:űrlap:lead` értéke alapján frissít vagy hoz létre rekordot. A már elvégzett értékesítési státuszokat nem írja felül, új Meta konverziót nem küld.

A Vercel privát Blob tárolójában csak azonosítók és küldési állapotok vannak, nevek, válaszok és elérhetőségek nincsenek. Az ETag-alapú feltételes írás védi az egyidejű futásoktól. A küldés előtt rögzíti a kísérletet; bizonytalan Mailgun-eredmény után nem küldi el automatikusan még egyszer. A Mailgun az üzenet átvételét igazolja; ez nem azonos a címzettek postaládájába történő kézbesítéssel.

Hiba esetén naponta legfeljebb egyszer kísérel meg figyelmeztető levelet küldeni. Ha maga a levelezés sem érhető el, a Vercel naplójában látható a hiba. A Meta adatszolgáltatási/megőrzési korlátján túli kiesést a kód nem tudja visszaállítani.

## Bekötés és ellenőrzés

1. Meta: külön, csak Szomexhez rendelt rendszerfelhasználó; a meglévő CRM api alkalmazás (`873370465805203`) használhatóságának és a szükséges leads_retrieval hozzáférésének ellenőrzése. A meglévő többügyfeles CRM API felhasználó széles körű kulcsát ne másoljuk a weboldalba.
2. A Meta tényleges engedélyező/hozzáférési lépése és a megjelenő feltételek elfogadása felhasználói jóváhagyást igényel. A kulcs csak Vercel Production sensitive változóként legyen tárolva, soha ne kerüljön a repóba vagy beszélgetésbe.
3. Vercel: privát Blob tároló létrehozása a Szomex projekthez, Frankfurt régióban. Kizárólag Production kapcsolat. Ha új díjat/előfizetést kell elfogadni, előbb konkrét jóváhagyás szükséges. Nincs új külső SaaS-fiók.
4. Környezeti változók: `META_LEADS_ACCESS_TOKEN`, `CRON_SECRET`, a tároló kapcsolata; `META_DIGEST_ENABLED=false`. Airtable és Mailgun meglévő kulcsainak használata, másolásuk/közzétételük nélkül.
5. Telepítés után hitelesített `/api/meta-digest?mode=check`: Meta űrlap és privát állapot olvasása, személyes adatok megjelenítése és küldés nélkül. Ez még nem bizonyítja a Mailgun kézbesítést vagy az Airtable írást.
6. Külön, egyértelműen TESZT tárgyú levél mindkét engedélyezett címzettnek, és a Mailgun két kézbesítési eseményének ellenőrzése. Tesztlead esetén annak azonosítója kerüljön a `META_TEST_LEAD_IDS` kizárási listába. Éles leadet nem szabad tesztként törölni.
7. Ha a régi helyi automatizmus már küldött, a helyi napló `sent_lead_ids` és sikeres feldolgozási határ értékeit át kell emelni az online állapotba az átfedés elkerülésére.
8. Sikeres teljes ellenőrzés után `META_DIGEST_ENABLED=true`, új Production telepítés és Cron Jobs ellenőrzése. Ezután a régi `szomex-napi-meta-rlapkit-lt-sek` Codex automatizmus szüneteltetése.

## Felhőben végzett infrastruktúra-teszt

Kizárólag Production környezetben, `META_DIGEST_SELF_TEST=true` mellett érhető el az ideiglenes `/api/meta-digest?mode=setup` ellenőrző oldal. A kulcsot HTTPS POST törzsben vagy Bearer fejlécben fogadja; nem kerül URL-be, naplóba vagy helyi fájlba. A felület semmilyen konfigurációt nem mutat meg hitelesítés nélkül.

A `self-test` egyszeri, rögzített azonosítójú szintetikus rekordot ír az Airtable-be, visszaolvassa, ellenőrzi a privát Blob állapotot és a hibás ETag elutasítását, majd TESZT tárgyú levelet küld a két engedélyezett címzettnek. A `test-status` a Mailgun eseményeiből mindkét címzetthez megköveteli a `delivered` állapotot. Ezek a címzett levelezőszerverének átvételét igazolják, nem a levél elolvasását vagy a spam mappa elkerülését. A tesztállapot külön Blob-fájlba kerül, személyes adatok nélkül. Bizonytalan küldésnél nincs automatikus újraküldés. A teszt nem bizonyítja a Meta elérhetőségét; ahhoz külön `check` és valódi Meta tesztlead szükséges.

A `meta-test` egy ténylegesen a Meta hivatalos teszteszközével létrehozott kitöltést továbbít. Előtte annak azonosítóját a `META_TEST_LEAD_IDS` változóba kell tenni; az elfogadási teszt pontosan egy numerikus azonosítót követel meg. Kizárólag ezt a kitöltést menti az Airtable-be, minden elmentett mezőt visszaellenőriz, majd külön TESZT tárgyú levélben továbbítja. Az összes többi kitöltést figyelmen kívül hagyja. A `meta-test-status` a Meta- és Airtable-adatokat újra összeveti, és mindkét címzettnél kézbesítési eseményt követel meg. Sikeres állapot: `meta_end_to_end_verified`. A külön `meta-acceptance-test-v1.json` állapot megakadályozza az ismételt küldést és az új tesztazonosítóval történő véletlen újraindítást. Az elfogadási teszt után `META_DIGEST_SELF_TEST=false` zárja le a tesztfelületet.

A Meta-lekérés alapverziója `v25.0`. Csak a kitöltés azonosítóját, időpontját és válaszait kéri; az `ad_id` mezőt nem, így nem igényel külön hirdetési metaadat-olvasást. A felhasználó kifejezetten jóváhagyta a `leads_retrieval`, `pages_read_engagement`, `pages_manage_ads` jogosultságokat. Ezzel a külön Szomex rendszerfelhasználóval az űrlap és a hivatalos tesztkitöltés olvasása sikeres; további scopes vagy hirdetési fiók-hozzárendelés nem szükséges. A teljes online teszt sikeres volt: Meta-olvasás, Airtable-visszaellenőrzés és mindkét címzett Mailgun delivered állapota. A napi küldés be van kapcsolva, a tesztfelület lezárva.

A Meta a közzétett űrlap adatvédelmi linkjének módosításához új példányt igényelt. A v2 űrlap 2026. október 14-én 14:13 CEST-kor lett aktív, azonos kérdésekkel, magyar nyelvvel, Higher intent és Restricted beállítással, kikapcsolt Flexible form delivery mellett. A korábbi `2358063358346039` űrlapon nem volt valódi kitöltés; az új űrlapra váltás az első napi összesítő előtt történt. A korábbi elfogadási teszt (`1421776476813840`) történeti igazolás marad, nem szabad újraindítani az új űrlap ellen. A váltás ellenőrzéséhez a küldés nélküli `check` mód használható.

A tényleges űrlap magyar mezőkulcsokat ad vissza (például `teljes_név`, `e-mail_cím`). Ezeket az API által megadott kérdéstípus alapján normalizáljuk, így a név, e-mail, telefon és település a megfelelő CRM-oszlopokba kerül. A választógombok technikai kulcsa helyett az API-ban megadott olvasható válasz jelenik meg; ismeretlen érték változatlanul megmarad. Az egyedi kérdések és válaszaik teljes egészében bekerülnek az összesítőbe.

Létrehozott tároló: `szomex-meta-digest`, `store_Q8ipNLXdhShRoYyc`, private, FRA1; kizárólag Production kapcsolat, OIDC hitelesítés. A felhasználó havi 1 USD tárolási keretet engedélyezett. Külön tárolónkénti automatikus költséglimit még nincs igazolva; a normál működés kevés műveletet végez, a két állapotfájl írását egyenként 1 MB-ra korlátozzuk. Ez nem szolgáltatói számlázási plafon.

## Bizonytalan küldés feloldása

A `pending` állapotot csak a Mailgun eseménynaplójával történő egyeztetés után szabad módosítani. A `szomex_digest_key` egyedi jelölő alapján ellenőrizendő mindkét címzett. Igazolt átvételnél a pending leadazonosítókat elküldöttként rögzítsük, a feldolgozási határt és jelentésnapot emeljük át; igazolt elutasításnál újrapróbálható. A módosítás is feltételes ETag-írással történjen. Részleges címzetti kézbesítésnél csak a hiányzó címzettnek történjen kézi pótlás.

## Ellenőrzések

`npm run check`: a weboldal teljes buildje és tesztjei, köztük az új napi összesítő tesztjei. Az új tesztek: időzóna/óraátállítás, párhuzamos futás, deduplikáció, napkihagyás, dátumhatárok, tesztkizárás, üres nap, Meta/Airtable hiba, bizonytalan küldés, zárolás, előnézeti tiltás, minden válasz megőrzése, lapozás és címzettkorlátozás.

Források: [Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [privát Vercel Blob](https://vercel.com/docs/vercel-blob/private-storage), [Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk), [Meta leadlekérés](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving/).
