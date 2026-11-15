/** What the user chose. `system` follows the operating system's light/dark setting, live */
export type ThemePreference = 'system' | 'light' | 'dark'
/** The theme actually shown */
export type ResolvedTheme = 'light' | 'dark'

/**
 * Where the choice is kept: per browser, so each station can differ, and so it can be read before the app loads.
 * The inline script in index.html reads the same key, to apply the theme before first paint.
 */
export const THEME_STORAGE_KEY = 'companion_theme'

export function parseThemePreference(raw: string | null): ThemePreference {
	return raw === 'light' || raw === 'dark' ? raw : 'system'
}

/** `forced` is set by a page that always shows one theme (the emulator and tablet views), whatever the choice */
export function resolveTheme(
	preference: ThemePreference,
	systemPrefersDark: boolean,
	forced: ResolvedTheme | null
): ResolvedTheme {
	if (forced) return forced
	if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
	return preference
}
