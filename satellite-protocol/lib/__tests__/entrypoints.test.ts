import fs from 'node:fs'
import { describe, expect, test } from 'vitest'

interface PackageJson {
	sideEffects: unknown
	exports: Record<string, string | Record<string, string>>
}

const packageUrl = new URL('../../package.json', import.meta.url)
const pkg: PackageJson = JSON.parse(fs.readFileSync(packageUrl, 'utf8'))

const codeEntrypoints = Object.entries(pkg.exports).filter(
	(entry): entry is [string, Record<string, string>] => typeof entry[1] === 'object'
)

describe('package entry points', () => {
	test('the package is side-effect free, so unused parts (eg zod) can be dropped by bundlers', () => {
		expect(pkg.sideEffects).toBe(false)
	})

	test.each(codeEntrypoints)('%s points at existing sources, with matching dist files', (_name, conditions) => {
		const source = conditions['companion:source']
		expect(fs.existsSync(new URL(source, packageUrl))).toBe(true)

		const base = source.replace(/^\.\/lib\//, './dist/').replace(/\.ts$/, '')
		expect(conditions.types).toBe(`${base}.d.ts`)
		expect(conditions.default).toBe(`${base}.js`)
	})

	test('the root entry point exports everything from the others', async () => {
		const rootConditions = Object.fromEntries(codeEntrypoints)['.']
		const root = await import(new URL(rootConditions['companion:source'], packageUrl).href)
		const others = codeEntrypoints.filter(([name]) => name !== '.')
		expect(others.map(([name]) => name).sort()).toEqual(['./codec', './constants', './schemas', './versions'])

		for (const [name, conditions] of others) {
			const mod = await import(new URL(conditions['companion:source'], packageUrl).href)
			for (const key of Object.keys(mod)) {
				expect(root, `${name} export ${key}`).toHaveProperty(key, mod[key])
			}
		}
	})

	test('only the schemas entry point depends on zod', () => {
		for (const [name, conditions] of codeEntrypoints) {
			if (name === '.' || name === './schemas') continue
			const source = fs.readFileSync(new URL(conditions['companion:source'], packageUrl), 'utf8')
			expect(source, name).not.toMatch(/from 'zod'/)
		}
	})
})
