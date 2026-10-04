/**
 * Colour tokens that keep one value in every theme, because what they colour doesn't follow the theme: the black
 * button canvas and its drop states, the always-dark button grid, text on a dark or coloured fill, and the scrim
 * behind overlays. The dark theme must not redefine them (themeTokens.test.ts checks).
 */
export const FIXED_TOKENS: readonly string[] = [
	'--color-button-bg',
	'--color-button-border',
	'--color-button-placeholder',
	'--color-copy-source',
	'--color-drop-border',
	'--color-drop-neutral-bg',
	'--color-drop-hover-bg',
	'--color-surface-dark',
	'--color-button-armed',
	'--color-armed-surface',
	'--color-scrollbar-thumb',
	'--color-on-dark',
	'--color-on-dark-muted',
	'--color-backdrop',
]
