import fs from 'fs';
import path from 'path';

const COOKIE_FILE = 'bilibili_cookies.txt';
const APPDATA_DIR = path.join(process.cwd(), '.appdata');

export function saveCookie(cookie) {
  const cookiePairs = extractCookiePairs(cookie);
  if (cookiePairs.length === 0) return null;
  const cookieDir = APPDATA_DIR;
  const cookiePath = path.join(cookieDir, COOKIE_FILE);
  try {
    fs.mkdirSync(cookieDir, { recursive: true });
    const lines = [
      '# Netscape HTTP Cookie File',
      ...cookiePairs.map(({ key, value }) => `.bilibili.com\tTRUE\t/\tFALSE\t1791092502\t${key}\t${value}`),
    ];
    fs.writeFileSync(cookiePath, lines.join('\n'), 'utf-8');
    return cookiePath;
  } catch (e) {
    console.error('Failed to save cookie:', e.message);
    return null;
  }
}

export function getCookiePath() {
  const cookiePath = path.join(APPDATA_DIR, COOKIE_FILE);
  return fs.existsSync(cookiePath) ? cookiePath : null;
}

export function clearCookie() {
  const cookiePath = path.join(APPDATA_DIR, COOKIE_FILE);
  if (fs.existsSync(cookiePath)) {
    fs.unlinkSync(cookiePath);
  }
}

function extractCookiePairs(rawCookie) {
  const text = String(rawCookie || '').trim();
  if (!text) return [];

  const jsonPairs = extractCookiePairsFromJson(text);
  if (jsonPairs.length > 0) {
    return jsonPairs;
  }

  if (!text.includes('=') && !text.includes(';')) {
    return [{ key: 'SESSDATA', value: text }];
  }

  const pairs = [];
  const seen = new Set();
  const parts = text.split(';');
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.split('=');
    if (!rawKey || rawValue.length === 0) continue;
    const key = rawKey.trim();
    const value = rawValue.join('=').trim();
    if (!key || !value) continue;
    const dedupKey = key.toUpperCase();
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    pairs.push({ key, value });
  }

  return pairs;
}

function extractCookiePairsFromJson(text) {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    const pairs = [];
    const seen = new Set();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const key = String(item.name || '').trim();
      const value = String(item.value || '').trim();
      const domain = String(item.domain || '').trim().toLowerCase();
      if (!key || !value) continue;
      if (domain && !domain.includes('bilibili.com')) continue;

      const dedupKey = key.toUpperCase();
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      pairs.push({ key, value });
    }
    return pairs;
  } catch {
    return [];
  }
}
