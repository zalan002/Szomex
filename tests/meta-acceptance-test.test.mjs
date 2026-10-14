import test from 'node:test';
import assert from 'node:assert/strict';
import {runMetaAcceptanceTest} from '../lib/meta-acceptance-test.mjs';
import {FORM_ID, RECIPIENTS, airtableFields} from '../lib/meta-digest.mjs';

const lead = {id: '123456789', created_time: '2026-10-14T12:00:00Z', field_data: [
  {name: 'full_name', values: ['Meta test name']}, {name: 'email', values: ['test@example.invalid']},
  {name: 'project', values: ['Test project answer']},
]};
function harness() {
  let value = null, version = null, sends = 0, saved = [];
  const h = {
    env: {VERCEL_ENV: 'production', META_DIGEST_SELF_TEST: 'true', META_TEST_LEAD_IDS: lead.id,
      META_LEADS_ACCESS_TOKEN: 'test', AIRTABLE_TOKEN: 'test', AIRTABLE_BASE_ID: 'appTest', AIRTABLE_TABLE_ID: 'tblTest', MAILGUN_API_KEY: 'test'},
    get sends() { return sends; }, get saved() { return saved; },
    store: {async read() { return {value: structuredClone(value), version}; }, async compareAndSet(old, next) {
      if (old !== version) return null;
      value = structuredClone(next); version = String(Number(version || 0) + 1); return version;
    }},
    async fetchImpl(url, options) {
      const endpoint = String(url);
      const ok = data => ({ok: true, json: async () => data});
      if (endpoint.includes('graph.facebook.com')) {
        if (endpoint.includes('/leads?')) {
          assert.equal(new URL(endpoint).searchParams.get('fields'), 'id,created_time,field_data');
          return ok({data: [{...lead, id: '999999999', field_data: [{name: 'full_name', values: ['Unrelated real lead']}]}, lead]});
        }
        return ok({id: FORM_ID, questions: [{key: 'project', label: 'Projekt'}]});
      }
      if (endpoint.includes('/messages')) {
        assert.deepEqual(options.body.getAll('to'), RECIPIENTS);
        assert.match(options.body.get('subject'), /^TESZT/);
        assert.match(options.body.get('text'), /Projekt: Test project answer/);
        assert(!options.body.get('text').includes('Unrelated real lead'));
        sends++; return ok({id: '<meta-test@example>'});
      }
      if (endpoint.includes('/events')) return ok({items: RECIPIENTS.map(recipient => ({recipient, event: 'delivered', message: {headers: {'message-id': 'meta-test@example'}}}))});
      if (options.method === 'PATCH') saved.push(...JSON.parse(options.body).records);
      return ok({records: [{fields: airtableFields(lead, {project: 'Projekt'})}]});
    },
  };
  return h;
}

test('only the excluded Meta test lead is saved and delivered once; state contains no answers', async () => {
  const h = harness();
  assert.equal((await runMetaAcceptanceTest({...h, mode: 'meta-test'})).status, 'meta_test_accepted');
  assert.equal((await runMetaAcceptanceTest({...h, mode: 'meta-test'})).status, 'meta_test_already_started');
  assert.equal(h.sends, 1); assert.equal(h.saved.length, 1);
  assert.equal(h.saved[0].fields.Azonosító, `meta:${FORM_ID}:${lead.id}`);
  const result = await runMetaAcceptanceTest({...h, mode: 'meta-test-status'});
  assert.equal(result.status, 'meta_end_to_end_verified');
  assert.equal(result.testLeadExcluded, true);
  const state = JSON.stringify((await h.store.read()).value);
  assert(!state.includes('test@example.invalid')); assert(!state.includes('Test project answer'));
});

test('explicit single test ID and production gating are required', async () => {
  for (const override of [{META_TEST_LEAD_IDS: ''}, {META_TEST_LEAD_IDS: '123,456'}, {META_TEST_LEAD_IDS: 'not-numeric'},
    {VERCEL_ENV: 'preview'}, {META_DIGEST_SELF_TEST: 'false'}]) {
    const h = harness();
    await assert.rejects(runMetaAcceptanceTest({...h, env: {...h.env, ...override}, mode: 'meta-test'}));
    assert.equal(h.sends, 0); assert.equal(h.saved.length, 0);
  }
});

test('missing Meta test lead cannot fall back to another lead', async () => {
  const h = harness();
  await assert.rejects(runMetaAcceptanceTest({...h, env: {...h.env, META_TEST_LEAD_IDS: '777'}, mode: 'meta-test'}), /META_TEST_LEAD_MISSING/);
  assert.equal(h.sends, 0); assert.equal(h.saved.length, 0);
});

test('mismatched Airtable readback blocks email and permits safe retry', async () => {
  const h = harness();
  await assert.rejects(runMetaAcceptanceTest({...h, mode: 'meta-test', fetchImpl: async (url, options) => {
    if (String(url).includes('api.airtable.com') && !options.method) return {ok: true, json: async () => ({records: [{fields: {}}]})};
    return h.fetchImpl(url, options);
  }}), /SELF_TEST_AIRTABLE_READBACK/);
  assert.equal(h.sends, 0);
  assert.equal((await runMetaAcceptanceTest({...h, mode: 'meta-test'})).status, 'meta_test_accepted');
});

test('uncertain send remains blocked and changing test ID cannot trigger another send', async () => {
  const h = harness();
  await assert.rejects(runMetaAcceptanceTest({...h, mode: 'meta-test', fetchImpl: async (url, options) => {
    if (String(url).includes('/messages')) throw new Error('TIMEOUT');
    return h.fetchImpl(url, options);
  }}), /TIMEOUT/);
  assert.equal((await runMetaAcceptanceTest({...h, mode: 'meta-test'})).status, 'meta_test_already_started');
  assert.equal((await runMetaAcceptanceTest({...h, mode: 'meta-test-status'})).status, 'sending');
  await assert.rejects(runMetaAcceptanceTest({...h, env: {...h.env, META_TEST_LEAD_IDS: '555'}, mode: 'meta-test'}), /META_TEST_ID_CHANGED/);
  assert.equal(h.sends, 0);
});

test('concurrent acceptance tests acquire a single sending lease', async () => {
  const h = harness();
  const results = await Promise.all([runMetaAcceptanceTest({...h, mode: 'meta-test'}), runMetaAcceptanceTest({...h, mode: 'meta-test'})]);
  assert.equal(results.filter(r => r.status === 'meta_test_accepted').length, 1);
  assert.equal(h.sends, 1);
});
