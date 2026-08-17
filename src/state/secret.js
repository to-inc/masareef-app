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
/**
 * HIS SHEET'S OWN ADDRESS (finding A7) — optional, and stored beside the
 * credentials because it is set at the same moment by the same person.
 *
 * NOT a credential: a spreadsheet URL is not secret, and anyone holding it still
 * needs Google to let them in. It lives here because SetupView is where Tarek
 * already pastes the two things only he knows, and asking for a third at that
 * moment costs nothing.
 *
 * OPTIONAL, and that word is load-bearing. The whole trust proposition of this
 * app is "your sheet is untouched and still yours". A link that opens the WRONG
 * document, or a dead one, damages exactly the thing it exists to prove — so
 * with no URL stored the app shows no link at all rather than guessing one from
 * the /exec address (which it cannot: a container-bound script's URL contains
 * the SCRIPT's id, not the spreadsheet's).
 */
const K_SHEET = 'masareef.sheetUrl';

export function getCreds() {
  try {
    const secret = localStorage.getItem(K_SECRET);
    const execUrl = localStorage.getItem(K_URL);
    return secret && execUrl ? { secret, execUrl } : null;
  } catch {
    return null;   // private mode / storage disabled — SetupView reappears
  }
}

export function setCreds(secret, execUrl, sheetUrl) {
  localStorage.setItem(K_SECRET, String(secret).trim());
  localStorage.setItem(K_URL, String(execUrl).trim());
  const sheet = String(sheetUrl || '').trim();
  if (sheet) localStorage.setItem(K_SHEET, sheet);
  else localStorage.removeItem(K_SHEET);
}

/**
 * The sheet's URL, or null.
 *
 * ONLY an https Google Sheets address is handed back. This string goes into an
 * `href` he taps, so anything else — a `javascript:` URL, a typo, a link to
 * somewhere that is not his book — is refused rather than rendered. The
 * allow-list is deliberately narrow: there is exactly one document this link is
 * ever for.
 */
export function getSheetUrl() {
  try {
    const raw = (localStorage.getItem(K_SHEET) || '').trim();
    if (!raw) return null;
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    if (u.hostname !== 'docs.google.com') return null;
    if (!u.pathname.startsWith('/spreadsheets/')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function clearCreds() {
  try {
    localStorage.removeItem(K_SECRET);
    localStorage.removeItem(K_URL);
    localStorage.removeItem(K_SHEET);
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
