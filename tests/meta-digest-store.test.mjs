import test from 'node:test';
import assert from 'node:assert/strict';
import {BlobPreconditionFailedError} from '@vercel/blob';
import {blobDigestStore} from '../lib/meta-digest-store.mjs';
import {initialState, runDigest, FORM_ID} from '../lib/meta-digest.mjs';

const env = {VERCEL_ENV: 'production', META_DIGEST_ENABLED: 'true', META_LEADS_ACCESS_TOKEN: 'test',
  AIRTABLE_TOKEN: 'test', AIRTABLE_BASE_ID: 'base', AIRTABLE_TABLE_ID: 'table',
  MAILGUN_API_KEY: 'test', CRON_SECRET: 'x'.repeat(40), BLOB_STORE_ID: 'store_test'};

function blobFixture() {
  let value = initialState(), version = '"1"', revision = 1;
  value.lastReportDay = '2026-10-19'; value.lastCutoff = '2026-10-19T22:00:00.000Z';
  value.receipts = Array.from({length: 6}, (_, i) => ({key: `${FORM_ID}:${i}`,
    providerId: '<20261015060045.41474242c2183afb@mg.traininghungary.com>',
    acceptedAt: '2026-10-20T06:00:42.346Z', count: 0}));
  const requests = [];
  return {requests, sdk: {
    async get(path, options) {
      requests.push(options);
      const text = JSON.stringify(value);
      const compressed = Buffer.byteLength(text) > 1024 && options.headers?.['Accept-Encoding'] !== 'identity';
      return {statusCode: 200, stream: new Response(text).body,
        headers: new Headers(compressed ? {'content-encoding': 'gzip'} : {}),
        blob: {etag: (compressed ? 'W/' : '') + version}};
    },
    async put(path, body, options) {
      if (options.ifMatch !== version) throw new BlobPreconditionFailedError();
      value = JSON.parse(body); version = `"${++revision}"`; return {etag: version};
    },
  }};
}

test('large compressed state recovers with a fresh strong validator and sends backlog only once', async () => {
  const fixture = blobFixture(), store = blobDigestStore(false, fixture.sdk);
  let sends = 0;
  const args = {env, store, now: new Date('2026-10-22T06:00:00Z'),
    fetchLeads: async () => ({labels: {}, leads: [{id: '42', created_time: '2026-10-21T13:00:00Z', field_data: []}]}),
    saveLeads: async () => {}, sendMail: async () => {sends++; return '<delivery@test>';}};
  assert.equal((await runDigest(args)).status, 'accepted');
  assert.equal((await runDigest(args)).status, 'already_sent');
  assert.equal(sends, 1);
  assert(fixture.requests.some(options => options.headers?.['Accept-Encoding'] === 'identity'));
  assert((await store.read()).value.sent['42']);
  assert.equal(await store.compareAndSet('"stale"', initialState()), null);
});

test('persistent weak validator is an explicit error, never weakened write protection', async () => {
  let writes = 0;
  const store = blobDigestStore(false, {
    get: async () => ({statusCode: 200, blob: {etag: 'W/"weak"'}, stream: new Response('{}').body}),
    put: async () => {writes++;},
  });
  await assert.rejects(store.read(), /STATE_WEAK_ETAG/);
  assert.equal(writes, 0);
});
