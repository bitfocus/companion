// test/postcss-wrap-layer.test.ts
import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import postcssWrapLayer from '../postcss-wrap-layer.mjs'

/** Run the plugin over `css` as if it were the file at `from`, returning the emitted CSS. */
async function wrap(css: string, from: string): Promise<string> {
	const result = await postcss([postcssWrapLayer()]).process(css, { from })
	return result.css
}

describe('postcss-wrap-layer: source-path → layer mapping', () => {
	it('assigns src/Components/** to the `components` layer', async () => {
		const out = await wrap('.btn { color: red }', '/repo/webui/src/Components/Button.css')
		expect(out).toMatch(/@layer components\s*\{[\s\S]*\.btn[\s\S]*\}/)
	})

	it('assigns the listed app-base files to the `app-base` layer', async () => {
		const out = await wrap('.a { color: red }', '/repo/webui/src/common.css')
		expect(out).toMatch(/@layer app-base\s*\{[\s\S]*\.a[\s\S]*\}/)
	})

	it('assigns everything else under src/ to the `features` layer', async () => {
		const out = await wrap('.page { display: block }', '/repo/webui/src/Surfaces/surfaces.css')
		expect(out).toMatch(/@layer features\s*\{[\s\S]*\.page[\s\S]*\}/)
	})

	it('ignores the ?query suffix Vite appends to module ids', async () => {
		const out = await wrap('.a {}', '/repo/webui/src/common.css?used')
		expect(out).toContain('@layer app-base')
	})

	it('normalises Windows path separators', async () => {
		const out = await wrap('.btn {}', 'C:\\repo\\webui\\src\\Components\\Button.css')
		expect(out).toContain('@layer components')
	})

	it('anchors on the LAST /src/ segment (checkout path may contain an earlier one)', async () => {
		const out = await wrap('.btn {}', '/home/me/src/checkout/webui/src/Components/Button.css')
		// indexOf would misclassify this as `features`; lastIndexOf keeps it `components`.
		expect(out).toContain('@layer components')
		expect(out).not.toContain('@layer features')
	})
})

describe('postcss-wrap-layer: files left unlayered', () => {
	for (const [name, from] of [
		['tailwind.css', '/repo/webui/src/tailwind.css'],
		['reboot.css', '/repo/webui/src/reboot.css'],
		['coreui-layout.css', '/repo/webui/src/coreui-layout.css'],
		['breakpoints.css', '/repo/webui/src/breakpoints.css'],
		['a CSS module', '/repo/webui/src/Thing.module.css'],
		['a .scss entry', '/repo/webui/src/App.scss'],
		['a file outside src/', '/repo/webui/build/index.css'],
	] as const) {
		it(`does not wrap ${name}`, async () => {
			const out = await wrap('.x { color: red }', from)
			expect(out).not.toContain('@layer')
		})
	}
})

describe('postcss-wrap-layer: node partitioning', () => {
	it('hoists top-level at-rules (charset/import/custom-media/existing layer) and wraps only the rules', async () => {
		const input = [
			'@charset "utf-8";',
			`@import 'breakpoints.css';`,
			'@custom-media --bp (min-width: 100px);',
			'@layer local { .kept { color: blue } }',
			'.moved { color: red }',
		].join('\n')
		const out = await wrap(input, '/repo/webui/src/Surfaces/surfaces.css')

		// The hoisted at-rules stay at the top level, before the appended wrapper.
		const wrapperIdx = out.indexOf('@layer features')
		expect(wrapperIdx).toBeGreaterThan(-1)
		for (const marker of ['@charset', '@import', '@custom-media', '@layer local']) {
			const idx = out.indexOf(marker)
			expect(idx, `${marker} should be hoisted above the wrapper`).toBeGreaterThan(-1)
			expect(idx, `${marker} should be hoisted above the wrapper`).toBeLessThan(wrapperIdx)
		}
		// Only the ordinary rule is moved into the features layer.
		expect(out).toMatch(/@layer features\s*\{[\s\S]*\.moved[\s\S]*\}/)
		expect(out).not.toMatch(/@layer features\s*\{[\s\S]*\.kept/)
	})

	it('leaves a file with only hoisted at-rules untouched (nothing to wrap)', async () => {
		const out = await wrap(`@import 'x.css';\n@custom-media --bp (min-width: 1px);`, '/repo/webui/src/breakpoints2.css')
		expect(out).not.toContain('@layer')
		expect(out).toContain('@import')
	})
})
