import type { ButtonGraphicsTextDrawElement } from '../Model/StyleLayersModel.js'

const DEFAULT_FONTS = [
	'Companion-sans',
	'Companion-symbols1',
	'Companion-symbols2',
	'Companion-symbols3',
	'Companion-symbols4',
	'Companion-symbols5',
	'Companion-symbols6',
	'Companion-gurmukhi',
	'Companion-simplified-chinese',
	'Companion-korean',
	'Companion-emoji',
]
const DEFAULT_FONTS_STR = DEFAULT_FONTS.join(',')

export const ALL_FONTS: ReadonlySet<string> = new Set([...DEFAULT_FONTS, 'Companion-mono'])

const FONT_STRINGS: ReadonlyMap<ButtonGraphicsTextDrawElement['font'], string> = new Map([
	['companion-sans', DEFAULT_FONTS_STR],
	['companion-mono', 'Companion-mono'],
])

export function resolveFontName(fontName: ButtonGraphicsTextDrawElement['font'] | undefined): string {
	if (!fontName) return DEFAULT_FONTS_STR

	return FONT_STRINGS.get(fontName) ?? DEFAULT_FONTS_STR
}
