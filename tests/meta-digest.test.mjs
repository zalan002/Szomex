import test from 'node:test';
import assert from 'node:assert/strict';
import {FORM_ID, START, RECIPIENTS, reportWindow, authorized, initialState, runDigest,
  readMetaLeads, sendDigestMail, airtableFields, composeDigest} from '../lib/meta-digest.mjs';

const env = {VERCEL_ENV: 'production', META_DIGEST_ENABLED: 'true', META_LEADS_ACCESS_TOKEN: 'test',
  AIRTABLE_TOKEN: 'test', AIRTABLE_BASE_ID: 'appTest', AIRTABLE_TABLE_ID: 'tblTest',
  MAILGUN_API_KEY: 'test', CRON_SECRET: 'a'.repeat(40), BLOB_STORE_ID: 'store_test'};
const now = new Date('2026-10-15T06:00:00Z');
const lead = (id, created_time = '2026-10-14T13:00:00Z') => ({id, created_time,
  field_data: [{name: 'full_name', values: ['Teszt Elek']}, {name: 'email', values: ['test@example.com']},
    {name: 'custom_question_1', values: ['16 lépcsőfok, 100 × 30 cm']}]});
function memoryStore(value = null) {
  let state = structuredClone(value), revision = value ? '1' : null;
  return {
    async read() { return {value: structuredClone(state), version: revision}; },
    async compareAndSet(version, next) {
      if (version !== revision) return null;
      state = structuredClone(next); revision = String(Number(revision || 0) + 1); return revision;
    },
  };
}
function harness({data = [lead('101')], state, ...overrides} = {}) {
  const calls = {saved: [], mails: []};
  const args = {env, now, store: memoryStore(state), fetchLeads: async () => ({leads: data, labels: {custom_question_1: 'Miben segíthetünk?'}}),
    saveLeads: async rows => calls.saved.push(rows),
    sendMail: async (message, key) => { calls.mails.push({message, key}); return '<receipt@example.com>'; }, ...overrides};
  return {args, calls};
}

test('Budapest 08:00 and local midnight remain correct across winter/summer transitions', () => {
  for (const [date, cutoff] of [
    ['2026-10-15T06:00:00Z', '2026-10-14T22:00:00.000Z'],
    ['2026-10-25T07:00:00Z', '2026-10-24T22:00:00.000Z'],
    ['2026-10-26T07:00:00Z', '2026-10-25T23:00:00.000Z'],
    ['2027-03-28T06:00:00Z', '2027-03-27T23:00:00.000Z'],
    ['2027-03-29T06:00:00Z', '2027-03-28T22:00:00.000Z'],
  ]) { const w = reportWindow(new Date(date)); assert.equal(w.hour, 8); assert.equal(w.cutoff, cutoff); }
});

test('localized Meta contact keys and option keys reach readable email and CRM contact columns', async () => {
  const questions = [
    {key: 'teljes_név', type: 'FULL_NAME', label: 'Full name'},
    {key: 'e-mail_cím', type: 'EMAIL', label: 'Email'},
    {key: 'telefonszám', type: 'PHONE', label: 'Phone number'},
    {key: 'település', type: 'CITY', label: 'City'},
    {key: 'mikor_lenne_szükséged_rá?', type: 'CUSTOM', label: 'Mikor lenne szükséged rá?', options: [{key: '1–3_hónapon_belül', value: '1–3 hónapon belül'}]},
    {key: 'méretek', type: 'CUSTOM', label: 'Méretek'},
  ];
  const original = {id: '123', created_time: '2026-10-14T10:15:29+0000', field_data: [
    {name: 'teljes_név', values: ['Teszt Elek']}, {name: 'e-mail_cím', values: ['test@example.com']},
    {name: 'telefonszám', values: ['+36301234567']}, {name: 'település', values: ['Táborfalva']},
    {name: 'mikor_lenne_szükséged_rá?', values: ['1–3_hónapon_belül']},
    {name: 'méretek', values: ['12 lépcsőlap, 100 × 30 cm']},
  ]};
  const data = await readMetaLeads(env, async url => ({ok: true, json: async () => String(url).includes('/leads?') ? {data: [original]} : {id: FORM_ID, questions}}));
  const fields = airtableFields(data.leads[0], data.labels);
  assert.equal(fields['Név'], 'Teszt Elek'); assert.equal(fields['E-mail'], 'test@example.com');
  assert.equal(fields['Telefon'], '+36301234567'); assert.equal(fields['Település'], 'Táborfalva');
  const message = composeDigest(data.leads, data.labels, reportWindow(now));
  assert.match(message.text, /Név: Teszt Elek/);
  assert.match(message.text, /Mikor lenne szükséged rá\?: 1–3 hónapon belül/);
  assert.match(message.text, /Méretek: 12 lépcsőlap, 100 × 30 cm/);
  assert(!message.text.includes('Név: nem adta meg'));
  assert.equal(original.field_data[0].name, 'teljes_név');
});

test('ambiguous localized contact mappings fail instead of dropping one answer', async () => {
  await assert.rejects(readMetaLeads(env, async url => ({ok: true, json: async () => String(url).includes('/leads?')
    ? {data: [{id: '123', created_time: START, field_data: [{name: 'a', values: ['First']}, {name: 'b', values: ['Second']}]}]}
    : {id: FORM_ID, questions: [{key: 'a', type: 'FULL_NAME'}, {key: 'b', type: 'FULL_NAME'}]}})), /META_FIELD_COLLISION/);
});

test('unanswered Meta fields survive import, CRM storage and one-time catch-up delivery', async () => {
  const questions = [
    {key: 'meretek', type: 'CUSTOM', label: 'Méretek'},
    {key: 'telefonszam', type: 'PHONE', label: 'Telefon'},
    {key: 'telepules', type: 'CITY', label: 'Település'},
    {key: 'nev', type: 'FULL_NAME'}, {key: 'email', type: 'EMAIL'},
  ];
  const newLead = {id: '202', created_time: '2026-10-23T18:00:00Z', field_data: [
    {name: 'meretek'}, {name: 'telefonszam', values: null}, {name: 'telepules', values: []},
    {name: 'nev', values: ['Teszt Elek']}, {name: 'email', values: ['test@example.com']},
    {name: 'megjegyzes', values: ['16 lépcsőlap és homlokfal', '100 × 30 cm']},
  ]};
  const fetchLeads = () => readMetaLeads(env, async url => ok(String(url).includes('/leads?')
    ? {data: [newLead, lead('101')]} : {id: FORM_ID, questions}));
  const data = await fetchLeads();
  assert.deepEqual(data.leads[0].field_data.slice(0, 3).map(f => f.values), [[], [], []]);
  assert.equal(Object.hasOwn(newLead.field_data[0], 'values'), false);
  const fields = airtableFields(data.leads[0], data.labels);
  assert.equal(fields['Név'], 'Teszt Elek'); assert.equal(fields['E-mail'], 'test@example.com');
  assert.equal(fields['Telefon'], undefined);
  assert.match(fields['Üzenet'], /Méretek: nem adta meg/);
  assert.match(fields['Üzenet'], /16 lépcsőlap és homlokfal, 100 × 30 cm/);
  const state = initialState(); state.sent['101'] = lead('101').created_time;
  state.lastReportDay = '2026-10-22'; state.lastCutoff = '2026-10-22T22:00:00.000Z';
  state.alerts['2026-10-24'] = {status: 'accepted', code: 'META_FIELD'};
  const {args, calls} = harness({state, now: new Date('2026-10-24T06:00:00Z'), fetchLeads});
  assert.deepEqual(await runDigest(args), {status: 'accepted', count: 1, reportDay: '2026-10-23'});
  assert.deepEqual(calls.saved[0].map(l => l.id), ['202']);
  assert.match(calls.mails[0].message.text, /Méretek: nem adta meg/);
  assert.match(calls.mails[0].message.text, /E-mail: test@example.com/);
  assert.equal((await runDigest(args)).status, 'already_sent');
  assert.equal(calls.mails.length, 1);
});

test('malformed Meta fields still fail safely without logging personal data', async t => {
  const logged = t.mock.method(console, 'error', () => {});
  const invalid = [null, {}, [], {name: ''}, {name: '   '}, {name: 42, values: []},
    {name: 'private-name', values: 'private-answer'}, {name: 'private-name', values: 42},
    {name: 'private-name', values: ['private-answer', {answer: 'private-answer'}]}];
  for (const field of invalid) {
    await assert.rejects(readMetaLeads(env, async url => ok(String(url).includes('/leads?')
      ? {data: [{...lead('101'), field_data: [field]}]} : {id: FORM_ID, questions: []})), /META_FIELD/);
  }
  assert.equal(logged.mock.callCount(), invalid.length);
  const diagnostic = JSON.stringify(logged.mock.calls.map(c => c.arguments));
  assert(!diagnostic.includes('private-name')); assert(!diagnostic.includes('private-answer'));
  assert(!diagnostic.includes('101'));
  assert.match(diagnostic, /valuesType/);
});
test('authorization requires a strong exact bearer token', () => {
  assert(authorized(`Bearer ${env.CRON_SECRET}`, env.CRON_SECRET));
  for (const header of [undefined, '', 'Bearer short', `Bearer ${env.CRON_SECRET}x`]) assert(!authorized(header, env.CRON_SECRET));
  assert(!authorized('Bearer short', 'short'));
});
test('success records accepted delivery and prevents repeated delivery, keeping PII out of state', async () => {
  const {args, calls} = harness();
  assert.equal((await runDigest(args)).status, 'accepted');
  assert.equal((await runDigest(args)).status, 'already_sent');
  assert.equal(calls.mails.length, 1);
  assert.equal(calls.saved[0].length, 1);
  const state = (await args.store.read()).value;
  assert(state.sent['101']); assert.equal(state.pending, null);
  assert(!JSON.stringify(state).includes('test@example.com'));
  assert(!JSON.stringify(state).includes('Teszt Elek'));
});
test('overlapping cron invocations only submit one message', async () => {
  const {args, calls} = harness();
  const results = await Promise.all([runDigest(args), runDigest(args), runDigest(args)]);
  assert.equal(results.filter(r => r.status === 'accepted').length, 1);
  assert.equal(calls.mails.length, 1);
});
test('start boundary, exclusive cutoff, explicit test exclusion and deduplication work together', async () => {
  const state = initialState(); state.sent['101'] = lead('101').created_time;
  const {args, calls} = harness({state, env: {...env, META_TEST_LEAD_IDS: '105'}, data: [
    lead('101'), lead('102', START), lead('103', '2026-10-13T21:59:59Z'),
    lead('104', '2026-10-14T22:00:00Z'), lead('105'), {...lead('106'), is_test: true},
  ]});
  await runDigest(args);
  assert.deepEqual(calls.saved[0].map(l => l.id), ['102']);
});
test('later runs catch missed days and late records without resending previous leads', async () => {
  const {args, calls} = harness(); await runDigest(args);
  args.now = new Date('2026-10-18T06:00:00Z');
  args.fetchLeads = async () => ({labels: {}, leads: [lead('101'), lead('102', '2026-10-15T12:00:00Z'), lead('103')]});
  await runDigest(args);
  assert.deepEqual(calls.saved[1].map(l => l.id), ['103', '102']);
});
test('verified empty result produces a zero-lead report', async () => {
  const {args, calls} = harness({data: []});
  assert.equal((await runDigest(args)).count, 0);
  assert.match(calls.mails[0].message.text, /kitöltések: 0/);
});
test('Meta error never becomes a zero report and retries can recover', async () => {
  const {args, calls} = harness({fetchLeads: async () => { throw new Error('META_HTTP_400'); }});
  await assert.rejects(runDigest(args), /META_HTTP_400/);
  assert.equal(calls.saved.length, 0); assert.equal(calls.mails.length, 1);
  assert.match(calls.mails[0].message.subject, /ellenőrzést igényel/);
  assert.equal((await args.store.read()).value.lastCutoff, START);
  args.fetchLeads = async () => ({leads: [lead('101')], labels: {}});
  assert.equal((await runDigest(args)).status, 'accepted');
});
test('uncertain Mailgun send stays blocked, including on later days, without blind resend', async () => {
  let digestAttempts = 0;
  const {args} = harness({sendMail: async (message, key) => {
    if (key.startsWith('alert:')) return 'alert-receipt';
    digestAttempts++; throw new Error('MAILGUN_UNCONFIRMED');
  }});
  await assert.rejects(runDigest(args), /MAILGUN_UNCONFIRMED/);
  await assert.rejects(runDigest(args), /DELIVERY_REQUIRES_REVIEW/);
  args.now = new Date('2026-10-16T06:00:00Z');
  await assert.rejects(runDigest(args), /DELIVERY_REQUIRES_REVIEW/);
  assert.equal(digestAttempts, 1);
  assert.equal((await args.store.read()).value.pending.leadIds[0], '101');
});
test('Airtable failure blocks digest until records have been saved', async () => {
  const {args, calls} = harness({saveLeads: async () => { throw new Error('AIRTABLE_SAVE'); }});
  await assert.rejects(runDigest(args), /AIRTABLE_SAVE/);
  assert(calls.mails.every(call => call.key.startsWith('alert:')));
});
test('expired processing lease can be recovered; active lease cannot', async () => {
  const state = initialState(); state.lease = {owner: 'crashed', until: '2026-10-15T05:00:00Z'};
  assert.equal((await runDigest(harness({state}).args)).status, 'accepted');
  state.lease.until = '2026-10-15T07:00:00Z';
  assert.equal((await runDigest(harness({state}).args)).status, 'busy');
});
test('preview, disabled automation, early hours and first partial day cannot send', async () => {
  for (const overrides of [{env: {...env, VERCEL_ENV: 'preview'}}, {env: {...env, META_DIGEST_ENABLED: 'false'}},
    {now: new Date('2026-10-15T05:00:00Z')}, {now: new Date('2026-10-14T10:00:00Z')}]) {
    const {args, calls} = harness(overrides); await runDigest(args); assert.equal(calls.mails.length, 0);
  }
});
test('connection check never writes state, Airtable or sends email', async () => {
  const {args, calls} = harness({mode: 'check', env: {...env, META_DIGEST_ENABLED: 'false'}});
  assert.equal((await runDigest(args)).status, 'meta_and_state_checked');
  assert.equal((await args.store.read()).value, null); assert.equal(calls.mails.length, 0); assert.equal(calls.saved.length, 0);
});
test('all custom answers appear in both Airtable and email, without interpreting them', () => {
  const item = lead('101'); item.field_data.push({name: 'riser', values: ['Homlokfal is kell.']});
  const labels = {custom_question_1: 'Miben segíthetünk?', riser: 'Kiegészítés'};
  const fields = airtableFields(item, labels), message = composeDigest([item], labels, reportWindow(now));
  for (const text of [fields['Üzenet'], message.text]) {
    assert.match(text, /Miben segíthetünk\?: 16 lépcsőfok/); assert.match(text, /Kiegészítés: Homlokfal is kell/);
    assert.match(text, /Telefonszám: nem adta meg/);
  }
  assert.equal(fields['Azonosító'], `meta:${FORM_ID}:101`);
  assert.equal(fields['Státusz'], undefined); // Do not reset sales follow-up status on an upsert.
});
const ok = data => ({ok: true, status: 200, json: async () => data});
test('Meta pagination uses the fixed form endpoint, not arbitrary next URLs', async () => {
  const urls = [];
  const rows = [ok({id: FORM_ID, questions: []}), ok({data: [lead('101')], paging: {next: 'https://evil.example/token', cursors: {after: 'next'}}}), ok({data: [lead('102')]})];
  const result = await readMetaLeads(env, async (url, options) => { urls.push(url); assert.equal(options.redirect, 'error'); return rows.shift(); });
  assert.equal(result.leads.length, 2); assert(urls.every(u => u.startsWith('https://graph.facebook.com/')));
  assert(urls[2].includes('after=next')); assert(urls.every(u => !u.includes(env.META_LEADS_ACCESS_TOKEN + '&')));
});
test('missing cursor and partial Meta failures stop the entire import', async () => {
  let count = 0;
  await assert.rejects(readMetaLeads(env, async () => ++count === 1 ? ok({id: FORM_ID, questions: []}) : ok({data: [lead('101')], paging: {next: 'next'}})), /META_PAGINATION/);
  count = 0;
  await assert.rejects(readMetaLeads(env, async () => ++count === 1 ? ok({id: FORM_ID, questions: []}) : ({ok: false, status: 403, json: async () => ({error: {message: 'private data'}})})), /META_HTTP_403/);
});
test('Mailgun submission is restricted to the two authorized recipients with tracking disabled', async () => {
  const id = await sendDigestMail({subject: 'Test', text: 'Synthetic'}, 'test-key', env, async (url, options) => {
    assert.equal(url, 'https://api.eu.mailgun.net/v3/mg.traininghungary.com/messages');
    assert.deepEqual(options.body.getAll('to'), RECIPIENTS); assert.equal(options.body.get('o:tracking'), 'no');
    assert.equal(options.body.get('v:szomex_digest_key'), 'test-key'); return ok({id: 'provider-accepted'});
  });
  assert.equal(id, 'provider-accepted');
});
