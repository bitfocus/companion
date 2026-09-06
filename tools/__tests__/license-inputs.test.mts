import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Metafile } from 'esbuild'
import { afterEach, describe, expect, test } from 'vitest'
import { bundleInputsFromMetafile } from '../licenses/inputs.mts'
import { collectRuntimeDependencyClosure } from '../licenses/installed-tree.mts'

describe('bundleInputsFromMetafile', () => {
	const metafile = (outputs: Metafile['outputs']): Metafile => ({ inputs: {}, outputs })
	const output = (inputs: Record<string, { bytesInOutput: number }>) => ({
		imports: [],
		exports: [],
		inputs,
		bytes: 0,
	})

	test('records only inputs which contributed bytes to a javascript output', () => {
		const recorded = bundleInputsFromMetafile(
			metafile({
				'dist/main.js': output({
					'lib/main.ts': { bytesInOutput: 10 },
					'lib/unused.ts': { bytesInOutput: 0 },
				}),
				'dist/main.css': output({ 'lib/styles.css': { bytesInOutput: 10 } }),
			}),
			'/repo/companion'
		)

		expect(recorded.inputs).toEqual(['/repo/companion/lib/main.ts'])
		expect(recorded.diagnostics).toEqual([])
	})

	test('reports inputs esbuild synthesised rather than read from a file', () => {
		const recorded = bundleInputsFromMetafile(
			metafile({ 'dist/main.js': output({ '<stdin>': { bytesInOutput: 10 } }) }),
			'/repo/companion'
		)

		expect(recorded.inputs).toEqual([])
		expect(recorded.diagnostics).toEqual(['Ignoring virtual esbuild input: <stdin>'])
	})

	test('deduplicates a file which several outputs shared', () => {
		const recorded = bundleInputsFromMetafile(
			metafile({
				'dist/main.js': output({ 'lib/shared.ts': { bytesInOutput: 10 } }),
				'dist/thread.js': output({ 'lib/shared.ts': { bytesInOutput: 10 } }),
			}),
			'/repo/companion'
		)

		expect(recorded.inputs).toEqual(['/repo/companion/lib/shared.ts'])
	})
})

describe('collectRuntimeDependencyClosure', () => {
	let fixtureDir: string | undefined
	afterEach(async () => {
		if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
		fixtureDir = undefined
	})

	async function writePackage(packageRoot: string, packageJson: Record<string, unknown>): Promise<void> {
		await mkdir(packageRoot, { recursive: true })
		await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify(packageJson))
	}

	/** A workspace whose dependencies are hoisted to the repository root, as yarn installs them */
	async function createFixture(): Promise<string> {
		fixtureDir = await mkdtemp(path.join(tmpdir(), 'license-closure-'))
		await writePackage(path.join(fixtureDir, 'launcher'), {
			name: 'launcher',
			version: '1.0.0',
			dependencies: { direct: '*', '@companion-app/shared': '*' },
			devDependencies: { electron: '*' },
		})
		await writePackage(path.join(fixtureDir, 'shared-lib'), { name: '@companion-app/shared', version: '1.0.0' })
		await mkdir(path.join(fixtureDir, 'node_modules', '@companion-app'), { recursive: true })
		await symlink(
			path.join(fixtureDir, 'shared-lib'),
			path.join(fixtureDir, 'node_modules', '@companion-app', 'shared')
		)
		await writePackage(path.join(fixtureDir, 'node_modules', 'direct'), {
			name: 'direct',
			version: '2.0.0',
			license: 'MIT',
			dependencies: { transitive: '*', 'other-platform-only': '*' },
		})
		await writePackage(path.join(fixtureDir, 'node_modules', 'transitive'), {
			name: 'transitive',
			version: '3.0.0',
			license: 'ISC',
		})
		await writePackage(path.join(fixtureDir, 'node_modules', 'electron'), {
			name: 'electron',
			version: '44.0.0',
			license: 'MIT',
		})
		return fixtureDir
	}

	test('follows runtime dependencies transitively and includes the extra shipped roots', async () => {
		const rootDir = await createFixture()

		const closure = await collectRuntimeDependencyClosure(path.join(rootDir, 'launcher'), ['electron'])

		expect(closure.packages.map((pkg) => `${pkg.name}@${pkg.version}`).sort()).toEqual([
			'direct@2.0.0',
			'electron@44.0.0',
			'transitive@3.0.0',
		])
		expect(closure.packages.every((pkg) => pkg.kind === 'external')).toBe(true)
	})

	test("follows a workspace dependency without listing it, as it is the project's own code", async () => {
		const rootDir = await createFixture()

		const closure = await collectRuntimeDependencyClosure(path.join(rootDir, 'launcher'), [])

		expect(closure.packages.map((pkg) => pkg.name)).not.toContain('@companion-app/shared')
	})

	test('reports a dependency which is not installed for this platform', async () => {
		const rootDir = await createFixture()

		const closure = await collectRuntimeDependencyClosure(path.join(rootDir, 'launcher'), [])

		expect(closure.diagnostics).toEqual(['Ignoring unresolvable runtime dependency of launcher: other-platform-only'])
	})
})
