const DEFAULT = 'https://pasword-checker.onrender.com';
// Pulls the plain URL out even if it was pasted as a markdown link
const BASE = ((import.meta.env.VITE_API_URL || DEFAULT).match(/https?:\/\/[^\s\]\)]+/) || [DEFAULT])[0].replace(/\/$/, '');

export async function api(path, body) {
  const res = await fetch(BASE + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
