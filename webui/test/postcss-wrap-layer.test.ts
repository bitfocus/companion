// test/postcss-wrap-layer.test.ts
import postcss, { type AtRule, type Root } from 'postcss'
import { describe, expect, it } from 'vitest'
import postcssWrapLayer from '../postcss-wrap-layer.mjs'

/** Run the plugin over `css` as if it were the file at `from`, returning the emitted PostCSS AST. */
async function process(css: string, from: string): Promise<Root> {
	const result = await postcss([postcssWrapLayer()]).process(css, { from })
	return result.root
}

/** The `@layer <params>` block appended to the root, if any. */
function rootLayer(root: Root, params: string): AtRule | undefined {
	return root.nodes.find((n): n is AtRule => n.type === 'atrule' && n.name === 'layer' && n.params === params)
}

/** True if `selector` is a rule nested directly inside the `@layer <layer>` block (not merely somewhere in the file). */
function selectorInLayer(root: Root, layer: string, selector: string): boolean {
	const block = rootLayer(root, layer)
	if (!block) return false
	return (block.nodes ?? []).some((n) => n.type === 'rule' && n.selector === selector)
}

/** Names of at-rules that are direct children of the root (i.e. hoisted, not wrapped). */
function rootAtRuleNames(root: Root): string[] {
	return root.nodes.filter((n): n is AtRule => n.type === 'atrule').map((n) => n.name)
}

describe('postcss-wrap-layer: source-path → layer mapping', () => {
	it('nests src/Components/** rules inside the `components` layer', async () => {
		const root = await process('.btn { color: red }', '/repo/webui/src/Components/Button.css')
		expect(selectorInLayer(root, 'components', '.btn')).toBe(true)
	})

	it('nests the listed app-base files inside the `app-base` layer', async () => {
		const root = await process('.a { color: red }', '/repo/webui/src/common.css')
		expect(selectorInLayer(root, 'app-base', '.a')).toBe(true)
	})

	it('nests everything else under src/ inside the `features` layer', async () => {
		const root = await process('.page { display: block }', '/repo/webui/src/Surfaces/surfaces.css')
		expect(selectorInLayer(root, 'features', '.page')).toBe(true)
	})

	it('ignores the ?query suffix Vite appends to module ids', async () => {
		const root = await process('.a {}', '/repo/webui/src/common.css?used')
		expect(selectorInLayer(root, 'app-base', '.a')).toBe(true)
	})

	it('normalises Windows path separators', async () => {
		const root = await process('.btn {}', 'C:\\repo\\webui\\src\\Components\\Button.css')
		expect(selectorInLayer(root, 'components', '.btn')).toBe(true)
	})

	it('anchors on the LAST /src/ segment (checkout path may contain an earlier one)', async () => {
		const root = await process('.btn {}', '/home/me/src/checkout/webui/src/Components/Button.css')
		// indexOf would misclassify this as `features`; lastIndexOf keeps it `components`.
		expect(selectorInLayer(root, 'components', '.btn')).toBe(true)
		expect(rootLayer(root, 'features')).toBeUndefined()
	})
})

describe('postcss-wrap-layer: files left unlayered', () => {
	for (const [name, from] of [
		['tailwind.css', '/repo/webui/src/tailwind.css'],
		['base.css', '/repo/webui/src/base.css'],
		['layout-grid.css', '/repo/webui/src/layout-grid.css'],
		['breakpoints.css', '/repo/webui/src/breakpoints.css'],
		['a CSS module', '/repo/webui/src/Thing.module.css'],
		['a .scss entry', '/repo/webui/src/styles.scss'],
		['a file outside src/', '/repo/webui/build/index.css'],
	] as const) {
		it(`does not wrap ${name}`, async () => {
			const root = await process('.x { color: red }', from)
			expect(rootAtRuleNames(root)).not.toContain('layer')
			// the rule stays at the top level, untouched
			expect(root.nodes.some((n) => n.type === 'rule' && n.selector === '.x')).toBe(true)
		})
	}
})

describe('postcss-wrap-layer: node partitioning', () => {
	it('hoists top-level at-rules and wraps only the ordinary rules', async () => {
		const input = [
			'@charset "utf-8";',
			`@import 'breakpoints.css';`,
			'@custom-media --bp (min-width: 100px);',
			'@layer local { .kept { color: blue } }',
			'.moved { color: red }',
		].join('\n')
		const root = await process(input, '/repo/webui/src/Surfaces/surfaces.css')

		// Each hoisted at-rule stays a direct child of the root, not nested in the features wrapper.
		const rootNames = rootAtRuleNames(root)
		for (const name of ['charset', 'import', 'custom-media']) expect(rootNames).toContain(name)
		expect(rootLayer(root, 'local')).toBeDefined() // the existing @layer block is preserved as-is at root

		// Only the ordinary rule moves into features; `.kept` stays inside its own `local` layer.
		expect(selectorInLayer(root, 'features', '.moved')).toBe(true)
		expect(selectorInLayer(root, 'features', '.kept')).toBe(false)
		expect(selectorInLayer(root, 'local', '.kept')).toBe(true)
	})

	it('leaves a file with only hoisted at-rules untouched (nothing to wrap)', async () => {
		const root = await process(`@import 'x.css';\n@custom-media --bp (min-width: 1px);`, '/repo/webui/src/misc.css')
		expect(rootAtRuleNames(root)).not.toContain('layer')
		// Both hoisted at-rules survive.
		expect(rootAtRuleNames(root)).toEqual(expect.arrayContaining(['import', 'custom-media']))
	})
})
