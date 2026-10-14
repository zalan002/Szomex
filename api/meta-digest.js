import {authorized, runDigest, readMetaLeads, saveToAirtable, sendDigestMail} from '../lib/meta-digest.mjs';
import {blobDigestStore} from '../lib/meta-digest-store.mjs';

export const config = {maxDuration: 120};
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ok: false}); }
  if (!authorized(req.headers.authorization, process.env.CRON_SECRET)) return res.status(401).json({ok: false});
  const mode = req.query?.mode || 'run';
  if (!['run', 'check'].includes(mode)) return res.status(400).json({ok: false});
  try {
    const env = process.env;
    const result = await runDigest({env, mode, store: blobDigestStore(),
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
