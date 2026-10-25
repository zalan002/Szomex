import {randomUUID, timingSafeEqual} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {LEAD_FIELDS as F} from './airtable.mjs';

export const FORM_ID = '1114549927619150';
export const PAGE_ID = '113530167004513';
export const RECIPIENTS = ['info@szomex.hu', 'zalan@traininghungary.com'];
export const START = '2026-10-13T22:00:00.000Z'; // 2026-10-14 midnight in Budapest
const ZONE = 'Europe/Budapest';
const parts = value => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
}).formatToParts(value).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));

export function reportWindow(now = new Date()) {
  const p = parts(now);
  const day = `${p.year}-${p.month}-${p.day}`;
  let midnight = Date.parse(`${day}T00:00:00Z`);
  // Convert the local midnight, including days on either side of a DST change.
  for (let i = 0; i < 3; i++) {
    const q = parts(new Date(midnight));
    const localAsUTC = Date.parse(`${q.year}-${q.month}-${q.day}T${q.hour}:${q.minute}:${q.second}Z`);
    midnight += Date.parse(`${day}T00:00:00Z`) - localAsUTC;
  }
  const previous = new Date(Date.parse(`${day}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return {day, reportDay: previous, cutoff: new Date(midnight).toISOString(), hour: Number(p.hour)};
}

export function authorized(header, secret) {
  if (!secret || secret.length < 32 || typeof header !== 'string') return false;
  const supplied = Buffer.from(header), expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function missingConfig(env) {
  return ['META_LEADS_ACCESS_TOKEN', 'AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID',
    'MAILGUN_API_KEY', 'CRON_SECRET'].filter(key => !env[key])
    .concat(env.BLOB_STORE_ID || env.BLOB_READ_WRITE_TOKEN ? [] : ['BLOB_STORE_ID']);
}

export async function readMetaLeads(env, fetchImpl = fetch) {
  const deadline = Date.now() + 65000;
  const version = env.META_LEADS_API_VERSION || 'v25.0';
  if (!/^v\d+\.0$/.test(version)) throw new Error('META_VERSION');
  const root = `https://graph.facebook.com/${version}/${FORM_ID}`;
  async function request(url) {
    if (Date.now() >= deadline) throw new Error('META_TIME_LIMIT');
    const response = await fetchImpl(url, {headers: {Authorization: `Bearer ${env.META_LEADS_ACCESS_TOKEN}`},
      signal: AbortSignal.timeout(Math.min(15000, deadline - Date.now())), redirect: 'error'});
    let result;
    try { result = await response.json(); } catch { throw new Error('META_RESPONSE'); }
    // Provider error messages may contain personal data; use only safe error codes.
    if (!response.ok || result.error) throw new Error(`META_HTTP_${response.status}`);
    return result;
  }
  const form = await request(`${root}?fields=id,name,questions`);
  if (form.id !== FORM_ID || !Array.isArray(form.questions)) throw new Error('META_FORM');
  // Meta localizes contact field keys. Use declared question types, never answer text,
  // to map them into the same contact fields as the website enquiries.
  const contactKeys = {FULL_NAME: 'full_name', EMAIL: 'email', PHONE: 'phone_number', PHONE_NUMBER: 'phone_number', CITY: 'city'};
  const questions = new Map(form.questions.filter(q => typeof q.key === 'string' && q.key).map(q => [q.key, q]));
  const fieldKey = key => contactKeys[questions.get(key)?.type] || key;
  const labels = Object.fromEntries([...questions].map(([key, q]) => [fieldKey(key), q.label || key]));
  const leads = new Map(), cursors = new Set();
  let after;
  for (let page = 0; page < 200; page++) {
    const url = new URL(`${root}/leads`);
    // Ad metadata needs additional advertising permissions; the digest only needs answers.
    url.searchParams.set('fields', 'id,created_time,field_data');
    url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);
    const result = await request(url.toString());
    if (!Array.isArray(result.data)) throw new Error('META_DATA');
    for (const lead of result.data) {
      if (!/^\d+$/.test(lead.id) || !Number.isFinite(Date.parse(lead.created_time)) ||
          !Array.isArray(lead.field_data)) throw new Error('META_LEAD');
      for (const [fieldIndex, field] of lead.field_data.entries()) {
        // Meta can omit values for an unanswered question. Keep the named field
        // with no answers, so the email explicitly says "nem adta meg".
        const values = field?.values ?? [];
        if (!field || Array.isArray(field) || typeof field.name !== 'string' || !field.name.trim() ||
            !Array.isArray(values) || values.some(v => typeof v !== 'string')) {
          // Log schema only: never names, lead identifiers or submitted answers.
          const kind = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
          console.error('szomex_meta_field', {fieldIndex, nameType: kind(field?.name),
            valuesType: kind(field?.values),
            itemTypes: Array.isArray(field?.values) ? [...new Set(field.values.map(kind))] : []});
          throw new Error('META_FIELD');
        }
      }
      const normalized = lead.field_data.map(field => {
        const options = new Map((questions.get(field.name)?.options || []).map(option => [option.key, option.value]));
        return {name: fieldKey(field.name), values: (field.values ?? []).map(value => typeof options.get(value) === 'string' ? options.get(value) : value)};
      });
      if (new Set(normalized.map(field => field.name)).size !== normalized.length) throw new Error('META_FIELD_COLLISION');
      leads.set(lead.id, {...lead, field_data: normalized});
    }
    if (!result.paging?.next) return {leads: [...leads.values()], labels};
    // Never follow provider next URLs with embedded tokens; rebuild the fixed endpoint.
    after = result.paging?.cursors?.after;
    if (typeof after !== 'string' || !after || cursors.has(after)) throw new Error('META_PAGINATION');
    cursors.add(after);
  }
  throw new Error('META_PAGE_LIMIT');
}

const fieldMap = lead => Object.fromEntries(lead.field_data.map(f => [f.name, f.values.join(', ')]));
const defaults = {full_name: 'Név', email: 'E-mail', phone_number: 'Telefonszám', city: 'Település'};
export function answersText(lead, labels = {}) {
  const fields = fieldMap(lead);
  const ordered = [...new Set([...Object.keys(defaults), ...Object.keys(labels), ...Object.keys(fields)])];
  return ordered.map(key => `${defaults[key] || labels[key] || key}: ${fields[key] || 'nem adta meg'}`).join('\n');
}

export function airtableFields(lead, labels) {
  const fields = fieldMap(lead);
  return {
    [F.key]: `meta:${FORM_ID}:${lead.id}`, [F.name]: fields.full_name || 'Nincs megadva',
    ...(fields.email && {[F.email]: fields.email}), ...(fields.phone_number && {[F.phone]: fields.phone_number}),
    ...(fields.city && {[F.city]: fields.city}), [F.message]: answersText(lead, labels),
    [F.type]: 'Lépcső alapanyag', [F.page]: `Meta instant form: ${FORM_ID}`,
    [F.received]: new Date(lead.created_time).toISOString(), [F.click]: 'Facebook / Instagram',
    [F.utm_source]: 'facebook', [F.utm_medium]: 'lead_ad', ...(lead.ad_id && {[F.utm_content]: lead.ad_id}),
  };
}

export async function saveToAirtable(leads, labels, env, fetchImpl = fetch) {
  const url = `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_TABLE_ID)}`;
  for (let offset = 0; offset < leads.length; offset += 10) {
    if (offset) await delay(250); // Respect Airtable's five requests/second/base limit.
    const batch = leads.slice(offset, offset + 10);
    const response = await fetchImpl(url, {method: 'PATCH',
      headers: {Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({performUpsert: {fieldsToMergeOn: [F.key]}, typecast: true,
        records: batch.map(lead => ({fields: airtableFields(lead, labels)}))}),
      signal: AbortSignal.timeout(10000), redirect: 'error'});
    const result = await response.json();
    if (!response.ok || result.records?.length !== batch.length) throw new Error('AIRTABLE_SAVE');
  }
}

export const REPLY_SUBJECT = 'Tölgyfa lépcső alapanyag – ajánlatkérés';
// Only plain addresses get a link, so an answer can never add recipients, headers or other URL parts.
const SAFE_EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
export function replyLink(lead) {
  const {email = '', full_name: name = ''} = fieldMap(lead);
  if (!SAFE_EMAIL.test(email.trim())) return null;
  const query = new URLSearchParams({subject: REPLY_SUBJECT, body: name ? `Kedves ${name}!\n\n` : ''});
  // mailto needs %20 for spaces; URLSearchParams would write '+', which mail clients show literally.
  return `mailto:${email.trim()}?${query.toString().replaceAll('+', '%20')}`;
}
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

export function composeDigest(leads, labels, window, since = START) {
  const format = value => new Intl.DateTimeFormat('hu-HU', {timeZone: ZONE, dateStyle: 'short', timeStyle: 'short'}).format(new Date(value));
  const replyLine = lead => replyLink(lead) ? `Válasz levélben: ${replyLink(lead)}` : 'Válasz levélben: nincs használható e-mail cím, a fenti elérhetőségeket érdemes nézni.';
  const text = [
    'SZOMEX – napi Meta ajánlatkérések', `Összesített nap: ${window.reportDay}`,
    `Új, eddig nem továbbított kitöltések: ${leads.length}`,
    `Feldolgozási időszak: ${format(since)} – ${format(window.cutoff)} (a záró időpont nélkül).`,
    'A késve elérhető és a kimaradt napokból pótolt érdeklődők is szerepelnek a listában.', '',
    ...leads.map((lead, i) => `${i + 1}. ajánlatkérés\nBeküldve: ${format(lead.created_time)}\nMeta azonosító: ${lead.id}\n${answersText(lead, labels)}\n${replyLine(lead)}\n`),
    ...(leads.length ? [] : ['Az ellenőrzés sikeres volt; nincs új, még nem továbbított kitöltés.']),
    '', `Űrlap: SZOMEX – Tölgyfa lépcső alapanyag – 2026.10.14 (${FORM_ID})`,
    'Automatikus összesítő a tolgyalapanyag.hu rendszeréből.',
  ].join('\n');
  // The HTML part repeats the text and puts a reply button under each enquiry.
  const block = value => `<p style="margin:0 0 12px;white-space:pre-wrap">${escapeHtml(value)}</p>`;
  const button = lead => replyLink(lead)
    ? `<p style="margin:0 0 24px"><a href="${escapeHtml(replyLink(lead))}" style="display:inline-block;padding:8px 16px;background:#7a4b1e;color:#ffffff;text-decoration:none;border-radius:4px">Válasz: ${escapeHtml(fieldMap(lead).email.trim())}</a></p>`
    : '<p style="margin:0 0 24px;color:#666666">Válasz levélben: nincs használható e-mail cím, a fenti elérhetőségeket érdemes nézni.</p>';
  const lines = text.split('\n');
  const html = ['<!doctype html><html lang="hu"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;font-size:14px;color:#222222">',
    block(lines.slice(0, 5).join('\n')),
    ...leads.map((lead, i) => block(`${i + 1}. ajánlatkérés\nBeküldve: ${format(lead.created_time)}\nMeta azonosító: ${lead.id}\n${answersText(lead, labels)}`) + button(lead)),
    ...(leads.length ? [] : [block('Az ellenőrzés sikeres volt; nincs új, még nem továbbított kitöltés.')]),
    block(`Űrlap: SZOMEX – Tölgyfa lépcső alapanyag – 2026.10.14 (${FORM_ID})\nAutomatikus összesítő a tolgyalapanyag.hu rendszeréből.`),
    '</body></html>'].join('');
  if (Buffer.byteLength(text) + Buffer.byteLength(html) > 1000000) throw new Error('DIGEST_SIZE');
  return {subject: `SZOMEX – Meta ajánlatkérések – ${window.reportDay.replaceAll('-', '.')}.`, text, html};
}

export async function sendDigestMail(message, key, env, fetchImpl = fetch) {
  const domain = env.MAILGUN_DOMAIN || 'mg.traininghungary.com';
  const base = env.MAILGUN_API_BASE || 'https://api.eu.mailgun.net/v3';
  if (!['https://api.eu.mailgun.net/v3', 'https://api.mailgun.net/v3'].includes(base) || !/^[a-z0-9.-]+$/i.test(domain)) throw new Error('MAILGUN_CONFIG');
  const body = new URLSearchParams({
    from: `SZOMEX ajánlatkérések <noreply@${domain}>`, subject: message.subject, text: message.text,
    'o:tracking': 'no', 'o:tracking-clicks': 'no', 'o:tracking-opens': 'no',
    'v:szomex_digest_key': key,
  });
  if (message.html) body.set('html', message.html);
  for (const recipient of RECIPIENTS) body.append('to', recipient);
  const response = await fetchImpl(`${base}/${domain}/messages`, {method: 'POST',
    headers: {Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString('base64')}`},
    body, signal: AbortSignal.timeout(15000), redirect: 'error'});
  const result = await response.json();
  if (!response.ok || typeof result.id !== 'string' || !result.id) throw new Error('MAILGUN_UNCONFIRMED');
  return result.id; // Accepted by Mailgun, not proof of inbox delivery.
}

export const initialState = () => ({schema: 1, formId: FORM_ID, sent: {}, lastCutoff: START,
  lastReportDay: null, pending: null, lease: null, alerts: {}, receipts: []});

export async function runDigest({env, store, now = new Date(), fetchLeads, saveLeads, sendMail, mode = 'run'}) {
  const window = reportWindow(now);
  if (env.VERCEL_ENV !== 'production') return {status: 'disabled_environment'};
  if (mode === 'run' && env.META_DIGEST_ENABLED !== 'true') return {status: 'disabled'};
  if (missingConfig(env).length || env.CRON_SECRET.length < 32) throw new Error('CONFIG_MISSING');
  if (mode === 'run' && window.hour < 8) return {status: 'before_schedule'};
  if (mode === 'run' && Date.parse(window.cutoff) <= Date.parse(START)) return {status: 'before_first_day'};
  let {value: state, version} = await store.read();
  state ||= initialState();
  if (state.schema !== 1 || state.formId !== FORM_ID || !state.sent || !state.alerts || !Array.isArray(state.receipts)) throw new Error('STATE_SCHEMA');
  if (mode === 'check') {
    const data = await fetchLeads();
    return {status: 'meta_and_state_checked', formId: FORM_ID, leadsAvailable: data.leads.length,
      pendingReview: Boolean(state.pending), enabled: env.META_DIGEST_ENABLED === 'true'};
  }
  if (state.lastReportDay === window.reportDay) return {status: 'already_sent'};
  if (state.lease && Date.parse(state.lease.until) > now.getTime()) return {status: 'busy'};
  state.lease = {owner: randomUUID(), until: new Date(now.getTime() + 10 * 60000).toISOString()};
  let next = await store.compareAndSet(version, state);
  if (!next) return {status: 'busy'};
  version = next;
  async function persist() {
    const saved = await store.compareAndSet(version, state);
    if (!saved) throw new Error('STATE_CONFLICT');
    version = saved;
  }
  try {
    if (state.pending) throw new Error('DELIVERY_REQUIRES_REVIEW');
    const {leads, labels} = await fetchLeads();
    const excluded = new Set((env.META_TEST_LEAD_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
    const eligible = leads.filter(lead => {
      const created = Date.parse(lead.created_time);
      return created >= Date.parse(START) && created < Date.parse(window.cutoff) && !state.sent[lead.id] && !excluded.has(lead.id) && lead.is_test !== true;
    }).sort((a, b) => Date.parse(a.created_time) - Date.parse(b.created_time));
    if (eligible.length > 500) throw new Error('DIGEST_BATCH_LIMIT');
    const message = composeDigest(eligible, labels, window, state.lastCutoff);
    await saveLeads(eligible, labels);
    const key = `${FORM_ID}:${window.reportDay}`;
    // Persist BEFORE sending: a timeout/crash must never cause a blind second send.
    state.pending = {key, leadIds: eligible.map(l => l.id), reportDay: window.reportDay, cutoff: window.cutoff,
      attemptedAt: now.toISOString(), status: 'sending'};
    await persist();
    const receipt = await sendMail(message, key);
    for (const lead of eligible) state.sent[lead.id] = lead.created_time;
    state.receipts.push({key, providerId: receipt, acceptedAt: now.toISOString(), count: eligible.length});
    state.receipts = state.receipts.slice(-120);
    state.lastReportDay = window.reportDay;
    state.lastCutoff = window.cutoff;
    state.pending = null;
    state.lease = null;
    await persist();
    return {status: 'accepted', count: eligible.length, reportDay: window.reportDay};
  } catch (error) {
    // Do not include arbitrary exception messages in emails or HTTP responses.
    const code = /^[A-Z][A-Z_0-9]+$/.test(error.message || '') ? error.message : 'PROVIDER_FAILURE';
    const fresh = await store.read();
    if (fresh.version !== version) throw new Error('STATE_CONFLICT');
    state = fresh.value;
    if (!state.alerts[window.day]) {
      state.alerts[window.day] = {status: 'attempting', code};
      await persist();
      try {
        const receipt = await sendMail({subject: 'SZOMEX – a Meta összesítő ellenőrzést igényel',
          text: `A napi összesítő nem fejeződött be igazoltan. Hibakód: ${code}.\nEz nem azt jelenti, hogy nem érkezett érdeklődő.\n${state.pending ? 'A küldés eredménye bizonytalan; a duplikáció elkerülése érdekében kézi ellenőrzés szükséges a Mailgun naplójában.' : 'A következő online futás újra megpróbálja a feldolgozást.'}\nŰrlap: ${FORM_ID}`}, `alert:${FORM_ID}:${window.day}`);
        state.alerts[window.day] = {status: 'accepted', providerId: receipt, code};
      } catch { state.alerts[window.day] = {status: 'unconfirmed', code}; }
    }
    state.lease = null;
    await persist();
    throw new Error(code);
  }
}
