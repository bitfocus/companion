import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { buffer } from 'node:stream/consumers'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import * as esbuild from 'esbuild'
import * as tarfs from 'tar-fs'
import { SURFACE_BASE_VERSION } from '@companion-app/shared/ModuleApiVersionCheck.js'
import type {
	CompanionModuleInfo,
	CompanionModuleVersionInfo,
} from '@companion-app/shared/OpenApi/ModuleStore/types.gen.js'

const gzipP = promisify(gzip)

const DAY = 24 * 60 * 60 * 1000

/** The api of the module store, see ModuleStore.ts */
const STORE_API = 'https://developer.bitfocus.io/api/v1/companion/modules'
/** Where the fake store serves the packages of the demo modules from */
const PACKAGE_URL = 'https://docs-demo-modules.invalid/'

interface DemoModule {
	type: 'connection' | 'surface'
	id: string
	name: string
	manufacturer: string
	products: string[]
	/** The versions in the store, each released some days ago */
	versions: { version: string; daysAgo: number; prerelease: boolean }[]
}

/**
 * The modules of the docs. The connection modules are all bundled from the same source (src/main.mjs), and the
 * surface module from src/surface.mjs. The store offers them for download like it does real modules, so that the
 * screenshots can show modules being installed and updated
 */
export const DEMO_MODULES = {
	visionMixer: {
		type: 'connection',
		id: 'demo-vision-mixer',
		name: 'Demo: Vision Mixer',
		manufacturer: 'Demo',
		products: ['Vision Mixer'],
		versions: [
			{ version: '2.3.0', daysAgo: 300, prerelease: false },
			{ version: '2.4.0', daysAgo: 190, prerelease: false },
			{ version: '2.5.0', daysAgo: 180, prerelease: false },
			{ version: '2.6.0', daysAgo: 30, prerelease: false },
			{ version: '2.7.0-beta.1', daysAgo: 3, prerelease: true },
		],
	},
	audioMixer: {
		type: 'connection',
		id: 'demo-audio-mixer',
		name: 'Demo: Audio Mixer',
		manufacturer: 'Demo',
		products: ['Audio Mixer'],
		versions: [
			{ version: '1.2.0', daysAgo: 400, prerelease: false },
			{ version: '1.3.1', daysAgo: 60, prerelease: false },
		],
	},
	mediaPlayer: {
		type: 'connection',
		id: 'demo-media-player',
		name: 'Demo: Media Player',
		manufacturer: 'Demo',
		products: ['Media Player'],
		versions: [{ version: '3.0.2', daysAgo: 90, prerelease: false }],
	},
	controlPanel: {
		type: 'surface',
		id: 'demo-control-panel',
		name: 'Demo: Control Panel',
		manufacturer: 'Demo',
		products: ['Control Panel'],
		versions: [{ version: '1.1.0', daysAgo: 45, prerelease: false }],
	},
	// More modules, which the scenarios don't use, so that the lists of the store aren't so short
	videoRouter: {
		type: 'connection',
		id: 'demo-video-router',
		name: 'Demo: Video Router',
		manufacturer: 'Demo',
		products: ['Video Router'],
		versions: [{ version: '1.4.0', daysAgo: 120, prerelease: false }],
	},
	lightingDesk: {
		type: 'connection',
		id: 'demo-lighting-desk',
		name: 'Demo: Lighting Desk',
		manufacturer: 'Demo',
		products: ['Lighting Desk'],
		versions: [{ version: '5.2.1', daysAgo: 20, prerelease: false }],
	},
	graphicsTitler: {
		type: 'connection',
		id: 'demo-graphics-titler',
		name: 'Demo: Graphics Titler',
		manufacturer: 'Demo',
		products: ['Graphics Titler'],
		versions: [{ version: '0.9.3', daysAgo: 75, prerelease: false }],
	},
	jogWheel: {
		type: 'surface',
		id: 'demo-jog-wheel',
		name: 'Demo: Jog Wheel',
		manufacturer: 'Demo',
		products: ['Jog Wheel'],
		versions: [{ version: '2.0.0', daysAgo: 200, prerelease: false }],
	},
	faderBank: {
		type: 'surface',
		id: 'demo-fader-bank',
		name: 'Demo: Fader Bank',
		manufacturer: 'Demo',
		products: ['Fader Bank'],
		versions: [{ version: '1.0.4', daysAgo: 15, prerelease: false }],
	},
} satisfies Record<string, DemoModule>

/** The api version each type of demo module is built against, the one installed in the repository */
const API_VERSIONS = { connection: '2.3.0', surface: SURFACE_BASE_VERSION } as const

/**
 * Stand in for the module store, which the app can't reach from the screenshots (and whose content changes), by
 * answering its requests from `fetch` with the demo modules. Call this before the app starts, as it refreshes the
 * list of modules as it starts.
 */
export async function standInForModuleStore(): Promise<void> {
	const packages = new Map<string, Buffer>()
	const versions = new Map<string, CompanionModuleVersionInfo[]>()
	const now = Date.now()

	const bundles = {
		connection: await bundleModuleSource('main.mjs'),
		surface: await bundleModuleSource('surface.mjs'),
	}
	const demoModules = Object.values(DEMO_MODULES) as DemoModule[]
	for (const module of demoModules) {
		const moduleVersions: CompanionModuleVersionInfo[] = []
		for (const { version, daysAgo, prerelease } of module.versions) {
			const tarball = await packModule(module, version, bundles[module.type])
			const tarUrl = `${PACKAGE_URL}${module.id}-${version}.tgz`
			packages.set(tarUrl, tarball)
			moduleVersions.push({
				id: `v${version}`,
				isPrerelease: prerelease,
				isLegacy: false,
				releasedAt: now - daysAgo * DAY,
				tarUrl,
				tarSha: crypto.createHash('sha256').update(tarball).digest('hex'),
				apiVersion: API_VERSIONS[module.type],
				license: 'MIT',
				licenseCategory: 'MIT',
			})
		}
		versions.set(`${module.type}/${module.id}`, moduleVersions)
	}

	const storeModules: Record<string, CompanionModuleInfo[]> = {
		connection: demoModules.filter((module) => module.type === 'connection').map((module) => storeInfo(module)),
		surface: demoModules.filter((module) => module.type === 'surface').map((module) => storeInfo(module)),
	}

	const realFetch = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

		const tarball = packages.get(url)
		if (tarball) return new Response(new Uint8Array(tarball))

		if (url.startsWith(STORE_API)) {
			// `<api>/<moduleType>` lists the modules, and `<api>/<moduleType>/<moduleId>` the versions of one
			const [moduleType, moduleId] = new URL(url).pathname.slice(new URL(STORE_API).pathname.length + 1).split('/')

			if (moduleId === undefined) return Response.json({ modules: storeModules[moduleType] ?? [] })

			const moduleVersions = versions.get(`${moduleType}/${moduleId}`)
			if (!moduleVersions) return Response.json({ error: 'Not found' }, { status: 404 })
			return Response.json({ versions: moduleVersions })
		}

		return realFetch(input, init)
	}
}

function storeInfo(module: DemoModule): CompanionModuleInfo {
	const type = module.type
	return {
		id: module.id,
		type,
		name: module.name,
		shortname: module.id,
		manufacturer: module.manufacturer,
		products: module.products,
		keywords: [],
		storeUrl: `https://bitfocus.io/${type}s/${module.id}`,
		// The lists of modules to add only show those with a stable release, which have help
		latestHelpUrl: `https://bitfocus.io/${type}s/${module.id}/help`,
		githubUrl: `https://github.com/bitfocus/companion-${type === 'connection' ? 'module' : 'surface'}-${module.id}`,
		legacyIds: [],
		license: 'MIT',
		licenseCategory: 'MIT',
	}
}

async function bundleModuleSource(file: string): Promise<string> {
	const result = await esbuild.build({
		entryPoints: [path.join(import.meta.dirname, 'src', file)],
		bundle: true,
		minify: true,
		platform: 'node',
		format: 'esm',
		target: 'node22',
		write: false,
		logLevel: 'warning',
	})
	return result.outputFiles[0].text
}

/** Pack a module as a tarball, laid out like those of the module store */
async function packModule(module: DemoModule, version: string, bundle: string): Promise<Buffer> {
	const dir = fs.mkdtempSync(path.join(import.meta.dirname, '../../../../.cache/docs-module-'))
	try {
		const pkgDir = path.join(dir, 'pkg')
		fs.mkdirSync(path.join(pkgDir, 'companion'), { recursive: true })
		fs.writeFileSync(
			path.join(pkgDir, 'package.json'),
			JSON.stringify({ name: module.id, version, private: true, type: 'module' })
		)
		fs.writeFileSync(path.join(pkgDir, 'companion/main.mjs'), bundle)
		const manifest = {
			type: module.type,
			id: module.id,
			name: module.name,
			shortname: module.id,
			description: `A demo of a ${module.products.join(', ').toLowerCase()}, for the docs`,
			version,
			license: 'MIT',
			repository: 'https://github.com/bitfocus/companion',
			bugs: 'https://github.com/bitfocus/companion/issues',
			maintainers: [{ name: 'Bitfocus' }],
			products: module.products,
			keywords: [],
			...(module.type === 'connection'
				? {
						legacyIds: [],
						manufacturer: module.manufacturer,
						runtime: { type: 'node22', api: 'nodejs-ipc', apiVersion: API_VERSIONS.connection, entrypoint: 'main.mjs' },
					}
				: {
						usbIds: [],
						runtime: { type: 'node22', apiVersion: API_VERSIONS.surface, entrypoint: 'main.mjs' },
					}),
		}
		fs.writeFileSync(path.join(pkgDir, 'companion/manifest.json'), JSON.stringify(manifest))

		const pack = tarfs.pack(dir, {
			entries: ['pkg'],
			// The store's tarballs name their root directory with a trailing slash
			map: (header) =>
				header.type === 'directory' && !header.name.endsWith('/') ? { ...header, name: `${header.name}/` } : header,
		})
		return await gzipP(await buffer(Readable.from(pack)))
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
}
