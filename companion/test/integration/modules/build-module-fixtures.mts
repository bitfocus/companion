/*
 * Regenerates the test connection-module fixtures under fixtures/, one per module-api version
 * listed in fixture-versions.json. Each fixture bundles the real @companion-module/base at that
 * version into a single file, so the committed fixtures need no install or network at test time.
 *
 * Run manually when adding a version or changing the module sources:
 *   yarn tsx companion/test/integration/modules/build-module-fixtures.mts
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as esbuild from 'esbuild'

interface FixtureVersion {
	apiVersion: string
	contract: 'v1' | 'v2'
	runtime: 'node18' | 'node22' | 'node26'
}

const modulesDir = import.meta.dirname
const fixturesDir = path.join(modulesDir, 'fixtures')
const buildCacheDir = path.join(modulesDir, '../../../../.cache/module-fixture-build')

const { versions } = JSON.parse(fs.readFileSync(path.join(modulesDir, 'fixture-versions.json'), 'utf8')) as {
	versions: FixtureVersion[]
}

export function fixtureModuleId(apiVersion: string): string {
	return `test-module-${apiVersion.replaceAll('.', '-')}`
}

function buildManifest(entry: FixtureVersion): Record<string, unknown> {
	const moduleId = fixtureModuleId(entry.apiVersion)
	return {
		...(entry.contract === 'v2' ? { type: 'connection' } : {}),
		id: moduleId,
		name: `Test module (api ${entry.apiVersion})`,
		shortname: moduleId,
		description: `Integration test fixture built against @companion-module/base@${entry.apiVersion}`,
		version: '1.0.0',
		license: 'MIT',
		repository: 'https://github.com/bitfocus/companion',
		bugs: 'https://github.com/bitfocus/companion/issues',
		maintainers: [{ name: 'Companion integration tests' }],
		legacyIds: [],
		runtime: {
			// The declared runtime mirrors the engines of that base library version, like real
			// modules of that era ship
			type: entry.runtime,
			api: 'nodejs-ipc',
			apiVersion: entry.apiVersion,
			entrypoint: entry.contract === 'v2' ? 'main.mjs' : 'main.js',
		},
		manufacturer: 'Bitfocus',
		products: ['Test'],
		keywords: ['test'],
	}
}

async function buildFixture(entry: FixtureVersion): Promise<void> {
	const moduleId = fixtureModuleId(entry.apiVersion)
	console.log(`Building ${moduleId}`)

	// Install the real base library at the requested version into a scratch prefix
	const installDir = path.join(buildCacheDir, entry.apiVersion)
	fs.mkdirSync(installDir, { recursive: true })
	fs.writeFileSync(path.join(installDir, 'package.json'), JSON.stringify({ private: true }))
	execFileSync('npm', ['install', '--no-audit', '--no-fund', `@companion-module/base@${entry.apiVersion}`], {
		cwd: installDir,
		stdio: 'inherit',
	})

	const fixtureDir = path.join(fixturesDir, moduleId, 'companion')
	fs.rmSync(path.join(fixturesDir, moduleId), { recursive: true, force: true })
	fs.mkdirSync(fixtureDir, { recursive: true })

	// The fixtures live inside the repo tree where an ancestor package.json declares type=module,
	// so pin the module's own type like a real packaged module would. Deliberately does NOT declare
	// @companion-module/base - that keeps the scanner treating the module as packaged, which makes
	// the manifest apiVersion authoritative
	fs.writeFileSync(
		path.join(fixturesDir, moduleId, 'package.json'),
		JSON.stringify(
			{ name: moduleId, version: '1.0.0', private: true, type: entry.contract === 'v2' ? 'module' : 'commonjs' },
			null,
			'\t'
		) + '\n'
	)

	const entrySource = path.join(modulesDir, 'src', entry.contract === 'v2' ? 'main-v2.mjs' : 'main-v1.cjs')
	await esbuild.build({
		entryPoints: [entrySource],
		bundle: true,
		minify: true,
		platform: 'node',
		format: entry.contract === 'v2' ? 'esm' : 'cjs',
		target: entry.runtime,
		// The api version this bundle is built against, for the hasApiFeature() gates in the sources
		define: { 'process.env.FIXTURE_API_VERSION': JSON.stringify(entry.apiVersion) },
		outfile: path.join(fixtureDir, entry.contract === 'v2' ? 'main.mjs' : 'main.js'),
		// Force resolution to the version installed above - plain resolution from src/ would find
		// the repo's own copy of the base library instead
		plugins: [
			{
				name: 'pin-base-version',
				setup(build) {
					build.onResolve({ filter: /^@companion-module\/base(\/.*)?$/ }, async (args) => {
						if (args.pluginData?.pinned) return null
						return build.resolve(args.path, {
							kind: args.kind,
							resolveDir: installDir,
							pluginData: { pinned: true },
						})
					})
				},
			},
		],
		logLevel: 'warning',
		banner: {
			js: `/* Generated fixture: test module bundled with @companion-module/base@${entry.apiVersion}. Regenerate with build-module-fixtures.mts - do not edit. */`,
		},
	})

	fs.writeFileSync(path.join(fixtureDir, 'manifest.json'), JSON.stringify(buildManifest(entry), null, '\t') + '\n')
}

// Only run the build when executed directly (this file is also imported for fixtureModuleId)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
	for (const entry of versions) {
		await buildFixture(entry)
	}
	console.log('Done')
}
