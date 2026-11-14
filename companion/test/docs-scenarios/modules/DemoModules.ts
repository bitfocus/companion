import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { buffer } from 'node:stream/consumers'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import * as esbuild from 'esbuild'
import * as tarfs from 'tar-fs'
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
	id: string
	name: string
	manufacturer: string
	products: string[]
	/** The versions in the store, each released some days ago */
	versions: { version: string; daysAgo: number; prerelease: boolean }[]
}

/**
 * The connection modules of the docs, all bundled from the same source (src/main.mjs). The store offers them for
 * download like it does real modules, so that the screenshots can show modules being installed and updated
 */
export const DEMO_MODULES = {
	visionMixer: {
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
		id: 'demo-media-player',
		name: 'Demo: Media Player',
		manufacturer: 'Demo',
		products: ['Media Player'],
		versions: [{ version: '3.0.2', daysAgo: 90, prerelease: false }],
	},
} satisfies Record<string, DemoModule>

/** Modules the store lists, without any versions to download, so that the list isn't only the demo modules */
const OTHER_STORE_CONNECTIONS: Pick<CompanionModuleInfo, 'id' | 'name' | 'manufacturer' | 'products'>[] = [
	{ id: 'generic-http', name: 'Generic: HTTP Requests', manufacturer: 'Generic', products: ['HTTP Requests'] },
	{ id: 'generic-osc', name: 'Generic: OSC', manufacturer: 'Generic', products: ['OSC'] },
	{ id: 'generic-ping', name: 'Generic: Ping', manufacturer: 'Generic', products: ['Ping'] },
	{ id: 'generic-tcp-udp', name: 'Generic: TCP/UDP', manufacturer: 'Generic', products: ['TCP/UDP'] },
	{ id: 'generic-websocket', name: 'Generic: Websocket', manufacturer: 'Generic', products: ['Websocket'] },
]

/**
 * Stand in for the module store, which the app can't reach from the screenshots (and whose content changes), by
 * answering its requests from `fetch` with the demo modules. Call this before the app starts, as it refreshes the
 * list of modules as it starts.
 */
export async function standInForModuleStore(): Promise<void> {
	const packages = new Map<string, Buffer>()
	const versions = new Map<string, CompanionModuleVersionInfo[]>()
	const now = Date.now()

	const bundle = await bundleModuleSource()
	for (const module of Object.values(DEMO_MODULES) as DemoModule[]) {
		const moduleVersions: CompanionModuleVersionInfo[] = []
		for (const { version, daysAgo, prerelease } of module.versions) {
			const tarball = await packModule(module, version, bundle)
			const tarUrl = `${PACKAGE_URL}${module.id}-${version}.tgz`
			packages.set(tarUrl, tarball)
			moduleVersions.push({
				id: `v${version}`,
				isPrerelease: prerelease,
				isLegacy: false,
				releasedAt: now - daysAgo * DAY,
				tarUrl,
				tarSha: crypto.createHash('sha256').update(tarball).digest('hex'),
				apiVersion: MODULE_API_VERSION,
				license: 'MIT',
				licenseCategory: 'MIT',
			})
		}
		versions.set(module.id, moduleVersions)
	}

	const connections: CompanionModuleInfo[] = [
		...(Object.values(DEMO_MODULES) as DemoModule[]).map((module) => storeInfo(module)),
		...OTHER_STORE_CONNECTIONS.map((module) => storeInfo(module)),
	]

	const realFetch = globalThis.fetch
	globalThis.fetch = async (input, init) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

		const tarball = packages.get(url)
		if (tarball) return new Response(new Uint8Array(tarball))

		if (url.startsWith(STORE_API)) {
			// `<api>/<moduleType>` lists the modules, and `<api>/<moduleType>/<moduleId>` the versions of one
			const [moduleType, moduleId] = new URL(url).pathname.slice(new URL(STORE_API).pathname.length + 1).split('/')

			if (moduleId === undefined) {
				return Response.json({ modules: moduleType === 'connection' ? connections : [] })
			}

			const moduleVersions = moduleType === 'connection' ? versions.get(moduleId) : undefined
			if (!moduleVersions) return Response.json({ error: 'Not found' }, { status: 404 })
			return Response.json({ versions: moduleVersions })
		}

		return realFetch(input, init)
	}
}

/** The module api version the demo modules are built against, the one installed in the repository */
const MODULE_API_VERSION = '2.3.0'

function storeInfo(
	module: Pick<CompanionModuleInfo, 'id' | 'name' | 'manufacturer' | 'products'>
): CompanionModuleInfo {
	return {
		id: module.id,
		type: 'connection',
		name: module.name,
		shortname: module.id,
		manufacturer: module.manufacturer,
		products: module.products,
		keywords: [],
		storeUrl: `https://bitfocus.io/connections/${module.id}`,
		githubUrl: `https://github.com/bitfocus/companion-module-${module.id}`,
		legacyIds: [],
		license: 'MIT',
		licenseCategory: 'MIT',
	}
}

async function bundleModuleSource(): Promise<string> {
	const result = await esbuild.build({
		entryPoints: [path.join(import.meta.dirname, 'src/main.mjs')],
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
		fs.writeFileSync(
			path.join(pkgDir, 'companion/manifest.json'),
			JSON.stringify({
				type: 'connection',
				id: module.id,
				name: module.name,
				shortname: module.id,
				description: `A demo of a ${module.products.join(', ').toLowerCase()}, for the docs`,
				version,
				license: 'MIT',
				repository: 'https://github.com/bitfocus/companion',
				bugs: 'https://github.com/bitfocus/companion/issues',
				maintainers: [{ name: 'Bitfocus' }],
				legacyIds: [],
				runtime: { type: 'node22', api: 'nodejs-ipc', apiVersion: MODULE_API_VERSION, entrypoint: 'main.mjs' },
				manufacturer: module.manufacturer,
				products: module.products,
				keywords: [],
			})
		)

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
