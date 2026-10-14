import {FORM_ID, readMetaLeads, answersText, saveToAirtable, sendDigestMail} from './meta-digest.mjs';
import {verifyStoredLead, deliveryStatus} from './meta-digest-self-test.mjs';

// Only an explicitly excluded Meta test lead may enter this one-time acceptance test.
export async function runMetaAcceptanceTest({env, store, mode, fetchImpl = fetch}) {
  if (env.VERCEL_ENV !== 'production' || env.META_DIGEST_SELF_TEST !== 'true') throw new Error('SELF_TEST_DISABLED');
  if (!['meta-test', 'meta-test-status'].includes(mode)) throw new Error('SELF_TEST_MODE');
  const ids = (env.META_TEST_LEAD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length !== 1 || !/^\d+$/.test(ids[0])) throw new Error('META_TEST_ID_REQUIRED');
  for (const key of ['META_LEADS_ACCESS_TOKEN', 'AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID', 'MAILGUN_API_KEY']) if (!env[key]) throw new Error('CONFIG_MISSING');
  const leadId = ids[0];
  const {value, version} = await store.read();
  if (value && value.leadId !== leadId) throw new Error('META_TEST_ID_CHANGED');
  async function getTestLead() {
    const {leads, labels} = await readMetaLeads(env, fetchImpl);
    const lead = leads.find(item => item.id === leadId);
    if (!lead) throw new Error('META_TEST_LEAD_MISSING');
    return {lead, labels};
  }
  if (mode === 'meta-test-status') {
    if (!value?.providerId) return {status: value?.status || 'not_started'};
    const {lead, labels} = await getTestLead();
    await verifyStoredLead(lead, labels, env, fetchImpl);
    const deliveries = await deliveryStatus(value.providerId, env, fetchImpl);
    return {status: Object.values(deliveries).every(s => s === 'delivered') ? 'meta_end_to_end_verified' : 'awaiting_delivery',
      metaRead: true, airtableReadback: true, testLeadExcluded: true, leadId, deliveries};
  }
  if (value && value.status !== 'failed_before_send') return {status: 'meta_test_already_started', next: 'meta-test-status'};
  let revision = await store.compareAndSet(version, {status: 'started', leadId, startedAt: new Date().toISOString()});
  if (!revision) return {status: 'meta_test_already_started', next: 'meta-test-status'};
  let lead, labels;
  try {
    ({lead, labels} = await getTestLead());
    await saveToAirtable([lead], labels, env, fetchImpl);
    await verifyStoredLead(lead, labels, env, fetchImpl);
  } catch (error) {
    await store.compareAndSet(revision, {status: 'failed_before_send', leadId});
    throw error;
  }
  revision = await store.compareAndSet(revision, {status: 'sending', leadId, attemptedAt: new Date().toISOString()});
  if (!revision) throw new Error('STATE_CONFLICT');
  const providerId = await sendDigestMail({subject: 'TESZT – SZOMEX Meta-űrlap teljes továbbítása',
    text: `TECHNIKAI TESZT – nem valódi ajánlatkérés.\n\nEz a kitöltés a Meta hivatalos teszteszközéből érkezett. Az online rendszer lekérte, elmentette és visszaellenőrizte az adatait.\n\nŰrlap: ${FORM_ID}\nTesztkitöltés: ${leadId}\n\n${answersText(lead, labels)}\n\nA tesztkitöltés a napi összesítőkből ki van zárva.\nAutomatikus teszt a tolgyalapanyag.hu rendszeréből.`},
    `meta-acceptance:${FORM_ID}:${leadId}`, env, fetchImpl);
  if (!await store.compareAndSet(revision, {status: 'accepted', leadId, providerId, acceptedAt: new Date().toISOString()})) throw new Error('STATE_CONFLICT');
  return {status: 'meta_test_accepted', metaRead: true, airtableReadback: true, testLeadExcluded: true, next: 'meta-test-status'};
}
