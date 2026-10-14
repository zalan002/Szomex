import {FORM_ID, RECIPIENTS, airtableFields, saveToAirtable, sendDigestMail} from './meta-digest.mjs';

export const TEST_ID = 'szomex-online-self-test-v1';
// This is an explicitly synthetic infrastructure record, never a real Meta lead.
export const testLead = () => ({id: TEST_ID, created_time: '2026-10-14T12:00:00Z', field_data: [
  {name: 'full_name', values: ['TESZT – Szomex online automatizálás']},
  {name: 'email', values: ['zalan@traininghungary.com']},
  {name: 'project', values: ['TECHNIKAI TESZT, nem ajánlatkérés. 12 lépcsőlap és homlokfal, 6 cm-es, hossztoldás nélküli tölgy lécekből.']},
]});

export async function verifyTestRecord(env, fetchImpl = fetch) {
  const key = `meta:${FORM_ID}:${TEST_ID}`;
  const url = new URL(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_ID}`);
  url.searchParams.set('filterByFormula', `{Azonosító}='${key}'`);
  url.searchParams.set('maxRecords', '2');
  const response = await fetchImpl(url, {headers: {Authorization: `Bearer ${env.AIRTABLE_TOKEN}`},
    signal: AbortSignal.timeout(10000), redirect: 'error'});
  const data = await response.json();
  const expected = airtableFields(testLead(), {project: 'Projekt'});
  if (!response.ok || data.records?.length !== 1 || Object.entries(expected).some(([k, v]) => data.records[0].fields?.[k] !== v)) throw new Error('SELF_TEST_AIRTABLE_READBACK');
  return true;
}

export async function deliveryStatus(providerId, env, fetchImpl = fetch) {
  const base = env.MAILGUN_API_BASE || 'https://api.eu.mailgun.net/v3';
  const domain = env.MAILGUN_DOMAIN || 'mg.traininghungary.com';
  if (!['https://api.eu.mailgun.net/v3', 'https://api.mailgun.net/v3'].includes(base) || !/^[a-z0-9.-]+$/i.test(domain)) throw new Error('MAILGUN_CONFIG');
  const url = new URL(`${base}/${domain}/events`);
  url.searchParams.set('message-id', providerId.replace(/^<|>$/g, ''));
  url.searchParams.set('limit', '100');
  const response = await fetchImpl(url, {headers: {Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString('base64')}`},
    signal: AbortSignal.timeout(15000), redirect: 'error'});
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.items)) throw new Error('MAILGUN_EVENTS');
  const relevant = data.items.filter(e => String(e.message?.headers?.['message-id'] || '').replace(/^<|>$/g, '') === providerId.replace(/^<|>$/g, ''));
  return Object.fromEntries(RECIPIENTS.map(recipient => [recipient,
    relevant.some(e => e.recipient === recipient && e.event === 'delivered') ? 'delivered' :
      relevant.some(e => e.recipient === recipient && e.event === 'failed' && e.severity === 'permanent') ? 'failed' : 'pending']));
}

export async function runSelfTest({env, store, mode, fetchImpl = fetch}) {
  if (env.VERCEL_ENV !== 'production' || env.META_DIGEST_SELF_TEST !== 'true') throw new Error('SELF_TEST_DISABLED');
  for (const key of ['AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID', 'MAILGUN_API_KEY']) if (!env[key]) throw new Error('CONFIG_MISSING');
  const {value, version} = await store.read();
  if (mode === 'test-status') {
    if (!value?.providerId) return {status: value?.status || 'not_started'};
    await verifyTestRecord(env, fetchImpl);
    const deliveries = await deliveryStatus(value.providerId, env, fetchImpl);
    return {status: Object.values(deliveries).every(s => s === 'delivered') ? 'infrastructure_verified' : 'awaiting_delivery', airtableReadback: true, deliveries};
  }
  // Fixed key and separate state make repeats safe, including concurrent or timed-out requests.
  if (value && value.status !== 'failed_before_send') return {status: 'test_already_started', next: 'test-status'};
  let revision = await store.compareAndSet(version, {status: 'started', startedAt: new Date().toISOString()});
  if (!revision) return {status: 'test_already_started', next: 'test-status'};
  try {
  const saved = await store.read();
  if (saved.version !== revision || saved.value?.status !== 'started') throw new Error('SELF_TEST_STATE_READBACK');
  // A stale ETag must be rejected without overwriting the current state.
  if (await store.compareAndSet('"invalid-self-test-etag"', {status: 'invalid'})) throw new Error('SELF_TEST_CAS');
  await saveToAirtable([testLead()], {project: 'Projekt'}, env, fetchImpl);
  await verifyTestRecord(env, fetchImpl);
  } catch (error) {
    await store.compareAndSet(revision, {status: 'failed_before_send'});
    throw error;
  }
  revision = await store.compareAndSet(revision, {status: 'sending', attemptedAt: new Date().toISOString()});
  if (!revision) throw new Error('STATE_CONFLICT');
  const providerId = await sendDigestMail({subject: 'TESZT – SZOMEX online Meta összesítő',
    text: 'Ez a Szomex napi összesítő technikai tesztje, nem valódi ajánlatkérés.\n\nA felhőben futó rendszer sikeresen írt és visszaolvasott egy megjelölt tesztrekordot az Airtable-ben, és ellenőrizte a privát Vercel-tároló írásvédelmét.\n\nA Meta-adatkapcsolat külön ellenőrzésen megy át; a napi küldés csak annak sikeres tesztje után kapcsolható be.\n\nCímzettek: info@szomex.hu és zalan@traininghungary.com.\nA levél automatikusan, a tolgyalapanyag.hu hátteréből érkezik.'}, TEST_ID, env, fetchImpl);
  if (!await store.compareAndSet(revision, {status: 'accepted', providerId, acceptedAt: new Date().toISOString()})) throw new Error('STATE_CONFLICT');
  return {status: 'test_accepted', airtableReadback: true, blobCasVerified: true, next: 'test-status'};
}
