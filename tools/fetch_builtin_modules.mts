// @ts-check

import { fetch, fs, path, usePowerShell } from 'zx'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'
import crypto from 'crypto'
import { generateVersionString } from './lib.mts'
import { AbortError } from 'p-retry'
import { gunzip } from 'zlib'
import * as tarfs from 'tar-fs'
import { MAX_MODULE_TAR_SIZE } from '../companion/lib/Instance/Constants.js'

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

const gunzipP = promisify(gunzip)

const builtinSurfacesManifestPath = path.join(import.meta.dirname, '../assets/builtin-surface-modules.json')
const builtinSurfacesManifestStr = await fs.readFile(builtinSurfacesManifestPath, 'utf8')
const builtinSurfacesManifestChecksum = crypto.createHash('sha256').update(builtinSurfacesManifestStr).digest('hex')
const builtinSurfacesManifestJson = JSON.parse(builtinSurfacesManifestStr)

const cacheRoot = path.join(import.meta.dirname, '../.cache')
const cacheDir = path.join(cacheRoot, 'builtin-surfaces')

const cacheChecksumPath = path.join(cacheRoot, 'builtin-surfaces-checksum.txt')

export async function fetchBuiltinSurfaceModules() {
	await fs.mkdirp(cacheDir)

	const existingChecksum = (await fs.pathExists(cacheChecksumPath))
		? (await fs.readFile(cacheChecksumPath, 'utf8')).trim()
		: null

	if (existingChecksum === builtinSurfacesManifestChecksum) {
		console.log('Builtin surface modules are up to date, skipping fetch.')
		return cacheDir
	}

	// Fetch each builtin surface module
	await Promise.all(
		Object.entries<Record<string, any>>(builtinSurfacesManifestJson).map(async ([moduleId, moduleInfo]) => {
			await fetchSinglePackage(moduleId, moduleInfo)
		})
	)

	// Update checksum
	await fs.writeFile(cacheChecksumPath, builtinSurfacesManifestChecksum, 'utf8')

	return cacheDir
}

const userAgent = `Companion dev ${await generateVersionString()}`

async function fetchSinglePackage(moduleId: string, moduleInfo: Record<string, any>) {
	const moduleDir = path.join(cacheDir, moduleId)

	const abortControl = new AbortController()
	const response = await fetch(moduleInfo.tarUrl, {
		headers: {
			'User-Agent': userAgent,
		},
		signal: abortControl.signal,
	})
	if (!response.body) throw new Error('Failed to fetch module, got no body')

	// Download into memory with a size limit
	const chunks: Uint8Array[] = []
	let bytesReceived = 0
	for await (const chunk of response.body as ReadableStream<Uint8Array>) {
		bytesReceived += chunk.byteLength
		if (bytesReceived > MAX_MODULE_TAR_SIZE) {
			abortControl.abort()
			throw new AbortError('Module is too large to download safely')
		}
		chunks.push(chunk)
	}

	const fullTarBuffer = Buffer.concat(chunks)

	const bufferChecksum = crypto.createHash('sha256').update(fullTarBuffer).digest('hex')
	if (bufferChecksum !== moduleInfo.tarSha) {
		throw new Error('Download did not match checksum')
	}

	const decompressedData = await gunzipP(fullTarBuffer)
	if (!decompressedData) {
		throw new Error('Failed to decompress data')
	}

	await fs.mkdirp(moduleDir)

	await new Promise((resolve, reject) => {
		Readable.from(decompressedData)
			.pipe(tarfs.extract(moduleDir, { strip: 1 }))
			.on('finish', resolve)
			.on('error', reject)
	})

	console.log(`Fetched ${moduleId} (${moduleInfo.version})`)
}
