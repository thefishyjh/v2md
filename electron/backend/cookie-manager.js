import fs from 'fs';
import path from 'path';
import os from 'os';

const COOKIE_FILE = 'bilibili_cookies.txt';

export function saveCookie(cookie) {
  if (!cookie) return null;
  const cookieDir = path.join(os.homedir(), '.v2md');
  const cookiePath = path.join(cookieDir, COOKIE_FILE);
  try {
    fs.mkdirSync(cookieDir, { recursive: true });
    // Convert SESSDATA to Netscape format
    const lines = [
      '# Netscape HTTP Cookie File',
      `.bilibili.com\tTRUE\t/\tFALSE\t1791092502\tSESSDATA\t${cookie}`
    ];
    fs.writeFileSync(cookiePath, lines.join('\n'), 'utf-8');
    return cookiePath;
  } catch (e) {
    console.error('Failed to save cookie:', e.message);
    return null;
  }
}

export function getCookiePath() {
  const cookiePath = path.join(os.homedir(), '.v2md', COOKIE_FILE);
  return fs.existsSync(cookiePath) ? cookiePath : null;
}

export function clearCookie() {
  const cookiePath = path.join(os.homedir(), '.v2md', COOKIE_FILE);
  if (fs.existsSync(cookiePath)) {
    fs.unlinkSync(cookiePath);
  }
}
