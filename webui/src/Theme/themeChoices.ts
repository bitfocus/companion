import { faDesktop, faMoon, faSun, type IconDefinition } from '@fortawesome/free-solid-svg-icons'
import type { ThemePreference } from './ThemeState.js'

export interface ThemeChoice {
	id: ThemePreference
	label: string
	icon: IconDefinition
	description: string
}

/** The theme choices, in the order every theme picker offers them */
export const THEME_CHOICES: readonly ThemeChoice[] = [
	{ id: 'system', label: 'System', icon: faDesktop, description: "Follow this device's light or dark setting" },
	{ id: 'light', label: 'Light', icon: faSun, description: 'Always use the light theme' },
	{ id: 'dark', label: 'Dark', icon: faMoon, description: 'Always use the dark theme' },
]
