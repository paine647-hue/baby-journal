// One-off: move base64 files out of bj_visits.file into Supabase Storage.
// Needs SUPABASE_SERVICE_KEY in .env (service_role key, project dwvtyctgawlshbjqyeqq).
// Run with: node --env-file=.env migrate-files.js

const SUPABASE_URL = 'https://dwvtyctgawlshbjqyeqq.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'baby-journal';

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY in .env');
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
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'application/pdf': 'pdf' };
  return map[m] || 'bin';
}
function isBase64DataUrl(s) {
  return typeof s === 'string' && s.startsWith('data:');
}
// file column is either null, a bare data: URL / storage URL (legacy single file),
// or a JSON string of [{url,name}, ...] (current multi-file format).
function parseFileField(file) {
  if (!file) return [];
  try {
    const parsed = JSON.parse(file);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  return [{ url: file, name: null }];
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
  const items = parseFileField(rec.file);
  const toMigrate = items.some(it => isBase64DataUrl(it.url));
  if (!toMigrate) return { id: rec.id, skipped: true };

  const migrated = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!isBase64DataUrl(it.url)) { migrated.push(it); continue; }
    const mime = mimeFromDataUrl(it.url);
    const ext = extFromMime(mime);
    const path = `medical/${rec.id}_${i}.${ext}`;
    const url = await uploadBase64(it.url, path);
    migrated.push({ url, name: it.name || `attachment.${ext}` });
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/bj_visits?id=eq.${rec.id}`, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ file: JSON.stringify(migrated) }),
  });
  if (!r.ok) throw new Error(`Update failed ${rec.id}: ${await r.text()}`);
  return { id: rec.id, migrated: migrated.length };
}

async function main() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bj_visits?select=id,file&file=not.is.null`, { headers });
  if (!r.ok) throw new Error(await r.text());
  const rows = await r.json();
  const targets = rows.filter(row => parseFileField(row.file).some(it => isBase64DataUrl(it.url)));

  console.log(`${targets.length} record(s) with base64 files to migrate.`);
  if (!targets.length) return;

  const CONCURRENCY = 3;
  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const rec = targets[idx++];
      try {
        const res = await migrateRecord(rec);
        console.log(res.skipped ? `${rec.id}: skipped` : `${rec.id}: migrated ${res.migrated} file(s)`);
      } catch (e) {
        console.error(`${rec.id}: FAILED - ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
