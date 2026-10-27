// The sign-in demo keeps its token per tab, so closing the tab signs out
// (suits a shared workstation). Storage can be blocked (private windows,
// browser settings), so every access is guarded and a failure reads as
// "no session".
const sessionKey = "vetiflow.session";

export function saveAccessToken(accessToken: string): void {
  try {
    sessionStorage.setItem(sessionKey, accessToken);
  } catch {
    // Sign-in still works for this page; the token is just not kept.
  }
}

export function readAccessToken(): string | null {
  try {
    return sessionStorage.getItem(sessionKey);
  } catch {
    return null;
  }
}

export function clearAccessToken(): void {
  try {
    sessionStorage.removeItem(sessionKey);
  } catch {
    // Nothing was stored.
  }
}
