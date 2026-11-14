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

interface RealModuleVersion {
	version: string
	daysAgo: number
	tarUrl: string
	tarSha: string
	apiVersion: string
}

interface RealModule {
	info: Omit<CompanionModuleInfo, 'type' | 'license' | 'licenseCategory'>
	versions: RealModuleVersion[]
}

const BUILDS = 'https://developer-module-builds.s4.bitfocus.io/connection'

/**
 * Some popular real modules, which the store offers alongside the demo modules, at versions pinned (by url and checksum)
 * so that the screenshots are the same each time. A version is downloaded the first time it is installed, and kept in
 * the repository's `.cache`. Their release dates are made recent, like those of the demo modules.
 */
export const REAL_MODULES = {
	atem: {
		info: {
			id: 'bmd-atem',
			name: 'Blackmagic Design: ATEM',
			shortname: 'atem',
			manufacturer: 'Blackmagic Design',
			products: ['ATEM'],
			keywords: ['Vision Mixer'],
			storeUrl: 'https://bitfocus.io/connections/bmd-atem',
			githubUrl: 'https://github.com/bitfocus/companion-module-bmd-atem',
			latestHelpUrl: `${BUILDS}/bmd-atem/v4.4.0-328e0a3508eb-3b99640c8d87/HELP.md`,
			legacyIds: ['atem'],
		},
		versions: [
			{
				version: '4.3.0',
				daysAgo: 160,
				tarUrl: `${BUILDS}/bmd-atem/v4.3.0-f098f3ada86415658e966e4d9d42fd5719584064/bmd-atem-v4.3.0.tgz`,
				tarSha: 'd2b5cabe6568ba6889f4bb1daebeaff22f9d4c4df2c38da63bebbb6bca965d96',
				apiVersion: '2.0.4',
			},
			{
				version: '4.3.1',
				daysAgo: 110,
				tarUrl: `${BUILDS}/bmd-atem/v4.3.1-23715ca054e1-23ffa58c85cc/bmd-atem-v4.3.1.tgz`,
				tarSha: '23ffa58c85cc1bec4d7b3290d7a82250892f0335ac01b3b855cf9e6633b7023e',
				apiVersion: '2.0.4',
			},
			{
				version: '4.4.0',
				daysAgo: 40,
				tarUrl: `${BUILDS}/bmd-atem/v4.4.0-328e0a3508eb-3b99640c8d87/bmd-atem-v4.4.0.tgz`,
				tarSha: '3b99640c8d87989cfcb2b4e0bd511a0ca25626bc9b3bfaf838bd89948dcda009',
				apiVersion: '2.0.4',
			},
		],
	},
	vmix: {
		info: {
			id: 'studiocoast-vmix',
			name: 'StudioCoast: vMix',
			shortname: 'vmix',
			manufacturer: 'StudioCoast',
			products: ['vMix'],
			keywords: ['Software', 'Vision Mixer'],
			storeUrl: 'https://bitfocus.io/connections/studiocoast-vmix',
			githubUrl: 'https://github.com/bitfocus/companion-module-studiocoast-vmix',
			latestHelpUrl: `${BUILDS}/studiocoast-vmix/v5.0.6-0f2f6670417a-1c0c8658d9a3/HELP.md`,
			legacyIds: [],
		},
		versions: [
			{
				version: '5.0.6',
				daysAgo: 25,
				tarUrl: `${BUILDS}/studiocoast-vmix/v5.0.6-0f2f6670417a-1c0c8658d9a3/studiocoast-vmix-v5.0.6.tgz`,
				tarSha: '1c0c8658d9a304770aeb1fd4cdb2b883d08ff147b0ab74bbf82f6ee1923e8f1f',
				apiVersion: '2.0.4',
			},
		],
	},
	videohub: {
		info: {
			id: 'bmd-videohub',
			name: 'Blackmagic Design: Videohub',
			shortname: 'videohub',
			manufacturer: 'Blackmagic Design',
			products: ['Videohub'],
			keywords: ['Matrix', 'Router'],
			storeUrl: 'https://bitfocus.io/connections/bmd-videohub',
			githubUrl: 'https://github.com/bitfocus/companion-module-bmd-videohub',
			latestHelpUrl: `${BUILDS}/bmd-videohub/v3.2.1-1791892cd4580c151c41db35feddf050118ec7ba/HELP.md`,
			legacyIds: ['videohub'],
		},
		versions: [
			{
				version: '3.2.1',
				daysAgo: 70,
				tarUrl: `${BUILDS}/bmd-videohub/v3.2.1-1791892cd4580c151c41db35feddf050118ec7ba/bmd-videohub-v3.2.1.tgz`,
				tarSha: 'd0d9d00baacdfe42e9da219bc1a5b080fdf78876855d0f459d26fc86683627a6',
				apiVersion: '2.0.4',
			},
		],
	},
} satisfies Record<string, RealModule>

/** Where the packages of the real modules are kept once downloaded */
const REAL_MODULES_CACHE = path.join(import.meta.dirname, '../../../../.cache/docs-store-modules')

/** The package of a version of a real module, from the cache, or downloaded (and checked) the first time */
async function realModulePackage(fetchFn: typeof fetch, version: RealModuleVersion): Promise<Buffer> {
	const cachePath = path.join(REAL_MODULES_CACHE, `${version.tarSha}.tgz`)
	if (fs.existsSync(cachePath)) return fs.readFileSync(cachePath)

	const response = await fetchFn(version.tarUrl)
	if (!response.ok) throw new Error(`Failed to download ${version.tarUrl}: HTTP ${response.status}`)
	const tarball = Buffer.from(await response.arrayBuffer())
	const sha = crypto.createHash('sha256').update(tarball).digest('hex')
	if (sha !== version.tarSha) throw new Error(`${version.tarUrl} does not match its checksum`)

	fs.mkdirSync(REAL_MODULES_CACHE, { recursive: true })
	fs.writeFileSync(cachePath, tarball)
	return tarball
}

/** The api version each type of demo module is built against, the one installed in the repository */
const API_VERSIONS = { connection: '2.3.0', surface: SURFACE_BASE_VERSION } as const

/**
 * Stand in for the module store, whose content changes, by answering its requests from `fetch` with the demo modules
 * and the pinned versions of some real ones. Call this before the app starts, as it refreshes the
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

	const realPackages = new Map<string, RealModuleVersion>()
	for (const module of Object.values(REAL_MODULES) as RealModule[]) {
		versions.set(
			`connection/${module.info.id}`,
			module.versions.map((version) => {
				realPackages.set(version.tarUrl, version)
				return {
					id: `v${version.version}`,
					isPrerelease: false,
					isLegacy: false,
					releasedAt: now - version.daysAgo * DAY,
					tarUrl: version.tarUrl,
					tarSha: version.tarSha,
					apiVersion: version.apiVersion,
					license: 'MIT',
					licenseCategory: 'MIT',
				}
			})
		)
	}

	const storeModules: Record<string, CompanionModuleInfo[]> = {
		connection: [
			...demoModules.filter((module) => module.type === 'connection').map((module) => storeInfo(module)),
			...(Object.values(REAL_MODULES) as RealModule[]).map((module): CompanionModuleInfo => ({
				...module.info,
				type: 'connection',
				license: 'MIT',
				licenseCategory: 'MIT',
			})),
		],
		surface: demoModules.filter((module) => module.type === 'surface').map((module) => storeInfo(module)),
	}

	const realFetch = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

		const tarball = packages.get(url)
		if (tarball) return new Response(new Uint8Array(tarball))

		const realPackage = realPackages.get(url)
		if (realPackage) return new Response(new Uint8Array(await realModulePackage(realFetch, realPackage)))

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
