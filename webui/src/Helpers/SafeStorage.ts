/**
 * Wrappers around `localStorage`/`sessionStorage` that never throw.
 *
 * Writing to web storage can throw (most commonly `QuotaExceededError` when the
 * storage is full, but also in private-browsing modes or when storage is
 * disabled entirely). None of our usages are critical enough to crash the UI
 * over, so we swallow the error and log it instead. The worst case is that a
 * value simply isn't persisted, which is far better than the component throwing.
 */

export function safeSetLocalStorage(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value)
	} catch (e) {
		console.warn(`Failed to write "${key}" to localStorage:`, e)
	}
}

export function safeSetSessionStorage(key: string, value: string): void {
	try {
		window.sessionStorage.setItem(key, value)
	} catch (e) {
		console.warn(`Failed to write "${key}" to sessionStorage:`, e)
	}
}
