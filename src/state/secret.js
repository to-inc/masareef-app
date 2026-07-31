/**
 * The SECRET and the /exec URL.
 *
 * Both live ONLY in the installed app's localStorage, never in the bundle, never
 * in a query string, never in an env file that reaches the repo. The endpoint is
 * `Anyone`-accessible by design, so the secret is the entire gate.
 *
 * iOS partitions an installed PWA's storage from Safari's, so credentials pasted
 * into Safari do NOT carry into the home-screen app — which is exactly why setup
 * is a paste-once screen inside the installed app rather than a setup link.
 * Installed-app localStorage is verified exempt from Safari's 7-day eviction.
 */
const K_SECRET = 'masareef.secret';
const K_URL = 'masareef.execUrl';

export function getCreds() {
  try {
    const secret = localStorage.getItem(K_SECRET);
    const execUrl = localStorage.getItem(K_URL);
    return secret && execUrl ? { secret, execUrl } : null;
  } catch {
    return null;   // private mode / storage disabled — SetupView reappears
  }
}

export function setCreds(secret, execUrl) {
  localStorage.setItem(K_SECRET, String(secret).trim());
  localStorage.setItem(K_URL, String(execUrl).trim());
}

export function clearCreds() {
  try {
    localStorage.removeItem(K_SECRET);
    localStorage.removeItem(K_URL);
  } catch { /* nothing to do */ }
}

/**
 * Desktop/dev convenience only: `#s=<SECRET>&u=<EXEC_URL>`.
 *
 * A URL *fragment* is never transmitted to any server, so unlike a query string
 * it cannot land in access logs. It is still stripped from the address bar
 * immediately via replaceState so it does not linger in history or a screenshot.
 * This is Tarek's path, never the installation path for Dad's phone.
 */
export function consumeHashCredentials() {
  try {
    const hash = window.location.hash || '';
    if (!hash.includes('s=')) return false;
    const p = new URLSearchParams(hash.replace(/^#/, ''));
    const secret = p.get('s');
    const url = p.get('u') || getCreds()?.execUrl;
    if (!secret || !url) return false;
    setCreds(secret, url);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  } catch {
    return false;
  }
}
