import {authorized, runDigest, readMetaLeads, saveToAirtable, sendDigestMail} from '../lib/meta-digest.mjs';
import {blobDigestStore} from '../lib/meta-digest-store.mjs';
import {runSelfTest} from '../lib/meta-digest-self-test.mjs';

export const config = {maxDuration: 120};
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method === 'GET' && req.query?.mode === 'setup' && process.env.META_DIGEST_SELF_TEST === 'true') {
    res.setHeader('Content-Security-Policy', "default-src 'none'; form-action 'self'; frame-ancestors 'none'");
    return res.status(200).send('<!doctype html><html lang="hu"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Szomex automatizálás ellenőrzése</title><h1>Szomex automatizálás ellenőrzése</h1><form method="post" action="/api/meta-digest"><label>Hozzáférési kulcs <input type="password" name="secret" autocomplete="off" required></label><p><label>Ellenőrzés <select name="mode"><option value="check">Meta kapcsolat</option><option value="self-test">Tárolás és tesztlevél</option><option value="test-status">Kézbesítés ellenőrzése</option></select></label></p><button>Ellenőrzés indítása</button></form></html>');
  }
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ok: false}); }
  const body = req.method === 'POST' ? (typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {}) : {};
  if (!authorized(req.headers.authorization || (typeof body.secret === 'string' ? `Bearer ${body.secret}` : null), process.env.CRON_SECRET)) return res.status(401).json({ok: false});
  const mode = body.mode || req.query?.mode || 'run';
  if (!['run', 'check', 'self-test', 'test-status'].includes(mode)) return res.status(400).json({ok: false});
  if (mode.startsWith('self-') || mode === 'test-status') {
    if (req.method !== 'POST') return res.status(405).json({ok: false});
  }
  try {
    const env = process.env;
    const result = ['self-test', 'test-status'].includes(mode) ? await runSelfTest({env, mode, store: blobDigestStore(true)}) : await runDigest({env, mode, store: blobDigestStore(),
      fetchLeads: () => readMetaLeads(env), saveLeads: (leads, labels) => saveToAirtable(leads, labels, env),
      sendMail: (message, key) => sendDigestMail(message, key, env)});
    console.info('szomex_meta_digest', result);
    return res.status(200).json({ok: true, ...result});
  } catch (error) {
    const code = /^[A-Z][A-Z_0-9]+$/.test(error.message || '') ? error.message : 'PROVIDER_FAILURE';
    console.error('szomex_meta_digest', {code});
    return res.status(503).json({ok: false, code});
  }
}
