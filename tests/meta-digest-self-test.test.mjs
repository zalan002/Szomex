import test from 'node:test';
import assert from 'node:assert/strict';
import {runSelfTest, testLead, deliveryStatus} from '../lib/meta-digest-self-test.mjs';
import {airtableFields, RECIPIENTS} from '../lib/meta-digest.mjs';
import handler from '../api/meta-digest.js';

const env = {VERCEL_ENV: 'production', META_DIGEST_SELF_TEST: 'true', AIRTABLE_TOKEN: 'test', AIRTABLE_BASE_ID: 'appTest', AIRTABLE_TABLE_ID: 'tblTest', MAILGUN_API_KEY: 'test'};
function harness() {
  let state = null, version = null, sends = 0;
  return {
    env, get sends() { return sends; },
    store: {async read() { return {value: structuredClone(state), version}; }, async compareAndSet(old, value) {
      if (old !== version) return null;
      state = structuredClone(value); version = String(Number(version || 0) + 1); return version;
    }},
    async fetchImpl(url, options) {
      const endpoint = String(url);
      if (endpoint.includes('/messages')) { sends++; return {ok: true, json: async () => ({id: '<selftest@mg.example>'})}; }
      if (endpoint.includes('/events')) return {ok: true, json: async () => ({items: RECIPIENTS.map(recipient => ({recipient, event: 'delivered', message: {headers: {'message-id': 'selftest@mg.example'}}}))})};
      return {ok: true, json: async () => ({records: [{fields: airtableFields(testLead(), {project: 'Projekt'})}]})};
    },
  };
}
test('cloud self-test checks CAS, Airtable readback and both deliveries; repeated runs send once', async () => {
  const h = harness();
  assert.equal((await runSelfTest({...h, mode: 'self-test'})).status, 'test_accepted');
  assert.equal((await runSelfTest({...h, mode: 'self-test'})).status, 'test_already_started');
  assert.equal(h.sends, 1);
  assert.equal((await runSelfTest({...h, mode: 'test-status'})).status, 'infrastructure_verified');
  assert(!JSON.stringify((await h.store.read()).value).includes('zalan@'));
});
test('partial or unrelated delivery events do not pass verification', async () => {
  const result = await deliveryStatus('<expected>', env, async () => ({ok: true, json: async () => ({items: [
    {event: 'delivered', recipient: RECIPIENTS[0], message: {headers: {'message-id': 'expected'}}},
    {event: 'delivered', recipient: RECIPIENTS[1], message: {headers: {'message-id': 'different'}}},
  ]})}));
  assert.equal(result[RECIPIENTS[0]], 'delivered'); assert.equal(result[RECIPIENTS[1]], 'pending');
});
test('failed storage check blocks sending and permits a safe retry', async () => {
  const h = harness();
  await assert.rejects(runSelfTest({...h, mode: 'self-test', fetchImpl: async () => ({ok: false, json: async () => ({})})}), /AIRTABLE_SAVE/);
  assert.equal(h.sends, 0);
  assert.equal((await runSelfTest({...h, mode: 'self-test'})).status, 'test_accepted');
});
test('uncertain email acceptance prevents all automated retries', async () => {
  const h = harness();
  await assert.rejects(runSelfTest({...h, mode: 'self-test', fetchImpl: async (url, options) => {
    if (String(url).includes('/messages')) throw new Error('TIMEOUT');
    return h.fetchImpl(url, options);
  }}), /TIMEOUT/);
  assert.equal((await runSelfTest({...h, mode: 'self-test'})).status, 'test_already_started');
  assert.equal((await runSelfTest({...h, mode: 'test-status'})).status, 'sending');
  assert.equal(h.sends, 0);
});
test('self-test requires explicit production enablement', async () => {
  for (const override of [{VERCEL_ENV: 'preview'}, {META_DIGEST_SELF_TEST: 'false'}])
    await assert.rejects(runSelfTest({...harness(), env: {...env, ...override}}), /SELF_TEST_DISABLED/);
});
test('browser test requests cannot run without a valid secret', async () => {
  const res = {setHeader() {}, status(code) { this.code = code; return this; }, json(value) { this.value = value; return this; }};
  await handler({method: 'POST', headers: {}, body: 'mode=self-test&secret=wrong'}, res);
  assert.equal(res.code, 401);
});
