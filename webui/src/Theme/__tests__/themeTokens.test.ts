import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { FIXED_TOKENS } from '../themeTokens.js'

const srcDir = path.resolve(import.meta.dirname, '../..')
const css = fs.readFileSync(path.join(srcDir, 'tailwind.css'), 'utf8')

/** The `--color-*` declarations inside the first block that opens with `opener` */
function colourTokensIn(opener: string): Map<string, string> {
	const start = css.indexOf(opener)
	if (start < 0) throw new Error(`No block opening with ${opener}`)

	let depth = 0
	let end = start
	for (let i = css.indexOf('{', start); i < css.length; i++) {
		if (css[i] === '{') depth++
		else if (css[i] === '}' && --depth === 0) {
			end = i
			break
		}
	}

	const tokens = new Map<string, string>()
	for (const match of css.slice(start, end).matchAll(/(--color-[\w-]+)\s*:\s*([^;]+);/g)) {
		tokens.set(match[1], match[2].trim())
	}
	return tokens
}

const lightTokens = colourTokensIn('@theme static {')
const darkTokens = colourTokensIn(":root[data-theme='dark'] {")

describe('dark theme tokens', () => {
	test('every themed token has a dark value', () => {
		// Built from other tokens, so they recompute from the dark values on their own
		const isDerived = (value: string) => value.includes('var(')

		const missing = [...lightTokens]
			.filter(([name, value]) => !isDerived(value) && !FIXED_TOKENS.includes(name) && !darkTokens.has(name))
			.map(([name]) => name)

		expect(missing).toEqual([])
	})

	test('the dark theme leaves the fixed tokens alone', () => {
		expect(FIXED_TOKENS.filter((name) => darkTokens.has(name))).toEqual([])
	})

	test('the dark theme only defines tokens that exist', () => {
		expect([...darkTokens.keys()].filter((name) => !lightTokens.has(name))).toEqual([])
	})

	test('every fixed token exists', () => {
		expect(FIXED_TOKENS.filter((name) => !lightTokens.has(name))).toEqual([])
	})
})

/** WCAG relative luminance of an opaque `#rgb`/`#rrggbb` colour */
function luminance(hex: string): number {
	const full =
		hex.length === 4
			? hex
					.slice(1)
					.split('')
					.map((c) => c + c)
					.join('')
			: hex.slice(1)
	const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
	const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
	return (hi + 0.05) / (lo + 0.05)
}

describe('dark theme contrast', () => {
	const token = (name: string) => {
		const value = darkTokens.get(name)
		if (!value?.startsWith('#')) throw new Error(`${name} is not a plain hex colour in the dark theme`)
		return value
	}

	// Body text needs 4.5:1 (WCAG AA) on every surface it sits on
	test.each([
		['--color-text', '--color-surface'],
		['--color-text', '--color-app-bg'],
		['--color-text', '--color-surface-muted'],
		['--color-muted', '--color-surface'],
		['--color-muted', '--color-surface-muted'],
		['--color-action-text', '--color-action-bg'],
		['--color-tone-good-text', '--color-surface'],
		['--color-tone-warning-text', '--color-surface'],
		['--color-tone-error-text', '--color-surface'],
		['--color-tone-info-text', '--color-surface'],
		['--color-tone-neutral-text', '--color-surface'],
		['--color-warning-text-emphasis', '--color-warning-bg-subtle'],
		['--color-danger-text-emphasis', '--color-danger-bg-subtle'],
		['--color-info-text-emphasis', '--color-info-bg-subtle'],
		['--color-success-text-emphasis', '--color-success-bg-subtle'],
		['--color-brand', '--color-surface'],
		['--color-variable-text', '--color-surface'],
		['--color-text', '--color-tab-active-bg'],
		['--color-primary-text', '--color-tab-active-bg'],
	])('%s on %s', (fg, bg) => {
		expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5)
	})

	test('white text on the primary fill', () => {
		expect(contrast('#ffffff', token('--color-action-primary'))).toBeGreaterThanOrEqual(4.5)
	})
})

describe('components use theme tokens', () => {
	// A raw palette colour has one value in every theme; a tone token (`text-tone-warning-text`, …) follows it
	test('no raw Tailwind palette colours in components', () => {
		const offenders: string[] = []
		const walk = (dir: string) => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name)
				if (entry.isDirectory()) {
					if (entry.name !== '__tests__') walk(full)
				} else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.stories.')) {
					const source = fs.readFileSync(full, 'utf8')
					const matches = source.match(
						/\b(?:bg|text|border|border-[lrtbxy])-(?:amber|emerald|rose|red|sky|blue|zinc|gray|slate|green|yellow|white|black)(?:-\d{2,3})?\b/g
					)
					if (matches) offenders.push(`${path.relative(srcDir, full)}: ${[...new Set(matches)].join(', ')}`)
				}
			}
		}
		walk(srcDir)

		expect(offenders).toEqual([])
	})
})
