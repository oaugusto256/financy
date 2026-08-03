const KEY = 'financy.token';

/**
 * "Lembrar-me" picks the store: localStorage survives closing the browser,
 * sessionStorage dies with the tab. Reads check both, because which one holds
 * the token is not knowable at read time.
 */
export function readToken(): string | null {
  return localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
}

export function writeToken(token: string, remember: boolean): void {
  // Always clear both first. Writing to one store while the other still holds
  // an older token means the next read can resurrect a session that was
  // deliberately made temporary.
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
