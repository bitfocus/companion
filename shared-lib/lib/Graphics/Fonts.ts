import type { ButtonGraphicsTextDrawElement } from '../Model/StyleLayersModel.js'

/**
 * Covers every codepoint with a 'missing glyph' box, so that neither the browser nor skia fall back to
 * system fonts. This keeps the preview and the rendered buttons consistent on every machine.
 */
const FALLBACK_FONT = 'Companion-notdef'

const DEFAULT_FONTS = [
	'Companion-sans',
	'Companion-symbols1',
	'Companion-symbols2',
	'Companion-symbols3',
	'Companion-symbols4',
	'Companion-symbols5',
	'Companion-symbols6',
	'Companion-gurmukhi',
	'Companion-tamil',
	'Companion-simplified-chinese',
	'Companion-korean',
	'Companion-emoji',
	FALLBACK_FONT,
]
const DEFAULT_FONTS_STR = DEFAULT_FONTS.join(',')

/**
 * The fonts the web ui loads for drawing previews. Button text is rendered by the backend (see
 * RASTERISED_ELEMENT_TYPES), so only enough is needed for what the ui still draws itself, such as the top bar.
 * This avoids downloading the large symbol, CJK and emoji fonts.
 */
export const PREVIEW_UI_FONTS: ReadonlySet<string> = new Set(['Companion-sans', 'Companion-mono', FALLBACK_FONT])

const FONT_STRINGS: ReadonlyMap<ButtonGraphicsTextDrawElement['font'], string> = new Map([
	['companion-sans', DEFAULT_FONTS_STR],
	['companion-mono', `Companion-mono,${FALLBACK_FONT}`],
])

export function resolveFontName(fontName: ButtonGraphicsTextDrawElement['font'] | undefined): string {
	if (!fontName) return DEFAULT_FONTS_STR

	return FONT_STRINGS.get(fontName) ?? DEFAULT_FONTS_STR
}
