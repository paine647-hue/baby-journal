// One-off: move base64 photos out of bj_logs.photos into Supabase Storage.
// Needs SUPABASE_SERVICE_KEY in supabase.env (service_role key, project dwvtyctgawlshbjqyeqq).
// Run with: node --env-file=supabase.env migrate-log-photos.js

const SUPABASE_URL = 'https://dwvtyctgawlshbjqyeqq.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'baby-journal';

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY in supabase.env');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

function mimeFromDataUrl(s) {
  const m = s.match(/^data:([^;]+);/);
  return m ? m[1] : 'application/octet-stream';
}
function extFromMime(m) {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
  return map[m] || 'bin';
}
function isBase64DataUrl(s) {
  return typeof s === 'string' && s.startsWith('data:');
}

async function uploadBase64(dataUrl, path) {
  const mime = mimeFromDataUrl(dataUrl);
  const base64 = dataUrl.split(',')[1];
  const buffer = Buffer.from(base64, 'base64');
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': mime },
    body: buffer,
  });
  if (!r.ok) throw new Error(`Upload failed ${path}: ${await r.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function migrateRecord(rec) {
  const photos = rec.photos || [];
  const toMigrate = photos.some(isBase64DataUrl);
  if (!toMigrate) return { id: rec.id, skipped: true };

  const migrated = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (!isBase64DataUrl(p)) { migrated.push(p); continue; }
    const mime = mimeFromDataUrl(p);
    const ext = extFromMime(mime);
    const path = `logs/${rec.date_key}_${i}.${ext}`;
    const url = await uploadBase64(p, path);
    migrated.push(url);
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/bj_logs?id=eq.${rec.id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ photos: migrated }),
  });
  if (!r.ok) throw new Error(`Update failed ${rec.id}: ${await r.text()}`);
  return { id: rec.id, migrated: migrated.length };
}

async function main() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bj_logs?select=id,date_key,photos&photos=not.is.null`, { headers });
  if (!r.ok) throw new Error(await r.text());
  const rows = await r.json();
  const targets = rows.filter(row => (row.photos || []).some(isBase64DataUrl));

  console.log(`${targets.length} record(s) with base64 photos to migrate.`);
  if (!targets.length) return;

  const CONCURRENCY = 3;
  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const rec = targets[idx++];
      try {
        const res = await migrateRecord(rec);
        console.log(res.skipped ? `${rec.id}: skipped` : `${rec.id}: migrated ${res.migrated} photo(s)`);
      } catch (e) {
        console.error(`${rec.id}: FAILED - ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
