// test/useLayoutMode.test.ts
import { beforeAll, describe, expect, it } from 'vitest'
import { getBreakpoints } from '../src/Hooks/useLayoutMode'
import tailwindCss from '../src/tailwind.css?raw'

// getBreakpoints reads the `--breakpoint-*` custom properties Tailwind emits from the @theme block in
// tailwind.css. We can't just import that stylesheet here: the Tailwind vite plugin doesn't run under
// vitest, and jsdom's getComputedStyle doesn't resolve custom properties declared inside @layer (which
// is where Tailwind puts them). So parse the real tailwind.css (imported raw) and apply the exact
// variables it declares to an unlayered :root — that keeps the test coupled to the shipped source, so
// renaming or removing a breakpoint variable there fails here (either the parse assertion or
// getBreakpoints' throw) rather than breaking silently at runtime.
const cssBreakpoints = new Map<string, string>()
for (const [, suffix, value] of tailwindCss.matchAll(/--breakpoint-([\w-]+):\s*([^;]+);/g)) {
	cssBreakpoints.set(suffix, value.trim())
}

describe('getBreakpoints CSS Integration', () => {
	beforeAll(() => {
		const decls = [...cssBreakpoints].map(([suffix, value]) => `--breakpoint-${suffix}: ${value};`).join(' ')
		const style = document.createElement('style')
		style.textContent = `:root { ${decls} }`
		document.head.appendChild(style)
	})

	it('declares the breakpoint variables getBreakpoints depends on', () => {
		// Guards the parse above and the runtime coupling: if these are renamed/removed in tailwind.css,
		// this fails here and the reads below start throwing.
		expect([...cssBreakpoints.keys()]).toEqual(expect.arrayContaining(['sm', 'md', 'lg', 'xl', '2xl']))
	})

	it('reads every breakpoint from the real CSS variables without throwing', () => {
		const breakpoints = getBreakpoints()

		// getBreakpoints maps our `xxl` onto Tailwind's `2xl`, and treats `xs` as the implicit 0 floor.
		expect(breakpoints.sm).toBe(cssBreakpoints.get('sm'))
		expect(breakpoints.md).toBe(cssBreakpoints.get('md'))
		expect(breakpoints.lg).toBe(cssBreakpoints.get('lg'))
		expect(breakpoints.xl).toBe(cssBreakpoints.get('xl'))
		expect(breakpoints.xxl).toBe(cssBreakpoints.get('2xl'))
		expect(breakpoints.xs).toBe('0px')
	})

	it('should have an XL breakpoint strictly larger than the LG breakpoint', () => {
		const { lg, xl } = getBreakpoints()

		expect(parseInt(xl, 10)).toBeGreaterThan(parseInt(lg, 10))
	})
})
