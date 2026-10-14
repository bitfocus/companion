import { action, autorun, computed, makeObservable, observable } from 'mobx'
import { safeGetLocalStorage, safeSetLocalStorage } from '~/Helpers/SafeStorage.js'
import {
	parseThemePreference,
	resolveTheme,
	THEME_STORAGE_KEY,
	type ResolvedTheme,
	type ThemePreference,
} from './resolveTheme.js'

export type { ResolvedTheme, ThemePreference } from './resolveTheme.js'

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

class ThemeStore {
	preference: ThemePreference
	systemPrefersDark: boolean

	constructor() {
		this.preference = parseThemePreference(safeGetLocalStorage(THEME_STORAGE_KEY))

		// Absent only outside a browser (jsdom in tests), where there is no system setting to follow
		const systemQuery = typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_DARK_QUERY) : null
		this.systemPrefersDark = systemQuery?.matches ?? false

		makeObservable(this, {
			preference: observable,
			systemPrefersDark: observable,
			resolved: computed,
			setPreference: action,
		})

		systemQuery?.addEventListener(
			'change',
			action((e: MediaQueryListEvent) => {
				this.systemPrefersDark = e.matches
			})
		)

		// Another tab changed the choice
		window.addEventListener(
			'storage',
			action((e: StorageEvent) => {
				if (e.key === THEME_STORAGE_KEY) this.preference = parseThemePreference(e.newValue)
			})
		)

		autorun(() => applyTheme(this.resolved))
	}

	get resolved(): ResolvedTheme {
		return resolveTheme(this.preference, this.systemPrefersDark)
	}

	setPreference(preference: ThemePreference): void {
		this.preference = preference
		safeSetLocalStorage(THEME_STORAGE_KEY, preference)
	}
}

/** Show a theme: the tokens follow `data-theme`, and `color-scheme` gives native controls and scrollbars the same */
function applyTheme(theme: ResolvedTheme): void {
	const root = document.documentElement
	root.dataset.theme = theme
	root.style.colorScheme = theme

	// The browser chrome (mobile address bar, PWA title bar) matches the app frame
	const frameColour = getComputedStyle(root).getPropertyValue('--color-app-frame-bg').trim()
	if (frameColour) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', frameColour)
}

export const themeStore = new ThemeStore()
