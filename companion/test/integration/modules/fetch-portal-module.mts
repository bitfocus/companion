/*
 * Downloads a prebuilt connection module from the Bitfocus module portal and unpacks it into the
 * repo's `.cache`, so an integration test can spawn the real module (not a hand-written fixture).
 *
 * The portal serves each module version as a self-contained tarball (bundled entrypoint + native
 * prebuilds for every platform), the same artifact `tools/fetch_builtin_modules.mts` pulls for the
 * builtin surface modules. Versions are pinned by tarball url + sha256 below, so a run is
 * reproducible and the download is verified before use. The first run fetches over the network;
 * later runs reuse the cached copy.
 */
import crypto from 'node:crypto'
import path from 'node:path'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'
import { gunzip } from 'node:zlib'
import fs from 'fs-extra'
import * as tarfs from 'tar-fs'
import { MAX_DECOMPRESSED_MODULE_TAR_SIZE, MAX_MODULE_TAR_SIZE } from '../../../lib/Instance/Constants.js'

const gunzipP = promisify(gunzip)

export interface PortalModulePin {
	/** The module id, as it appears in its manifest (and the directory it is unpacked into) */
	id: string
	/** The version string, only used for logging */
	version: string
	/** The tarball url on the portal's build store */
	tarUrl: string
	/** The expected sha256 of the tarball, to verify the download */
	tarSha: string
}

/** generic-http v3.1.0 - the release that surfaces issue #110 (custom-variable option defaults). */
export const GENERIC_HTTP_3_1_0: PortalModulePin = {
	id: 'generic-http',
	version: 'v3.1.0',
	tarUrl:
		'https://developer-module-builds.s4.bitfocus.io/connection/generic-http/v3.1.0-07573d44a0521f21878aa7ded44ba5823edf54f3/generic-http-v3.1.0.tgz',
	tarSha: '94db038e50a32932468d78a45d40479e7c3a2a72de6de5f774f4460ba1c5ad17',
}

/**
 * The directory the pinned modules are unpacked into. Its direct children are module directories,
 * so it can be passed straight to `createTestApp` as `extraModulePath`.
 */
export const PORTAL_MODULES_DIR = path.join(import.meta.dirname, '../../../../.cache/test-portal-modules')

/** Whether the pinned module is already unpacked and matches its expected checksum */
export async function isPortalModulePresent(pin: PortalModulePin): Promise<boolean> {
	const stampPath = path.join(PORTAL_MODULES_DIR, `${pin.id}.sha`)
	const existingStamp = (await fs.pathExists(stampPath)) ? (await fs.readFile(stampPath, 'utf8')).trim() : null
	return (
		existingStamp === pin.tarSha &&
		(await fs.pathExists(path.join(PORTAL_MODULES_DIR, pin.id, 'companion/manifest.json')))
	)
}

/**
 * Ensure the pinned module is unpacked under `.cache/test-portal-modules/<id>`, downloading and
 * verifying it if the cached copy is missing or stale. Returns `PORTAL_MODULES_DIR`.
 *
 * This is invoked by the `fetch-test-modules` tool (see tools/fetch_test_modules.mts), so the
 * network download is a discrete provisioning step rather than something a test does inline.
 */
export async function ensurePortalModule(pin: PortalModulePin): Promise<string> {
	if (await isPortalModulePresent(pin)) return PORTAL_MODULES_DIR

	const moduleDir = path.join(PORTAL_MODULES_DIR, pin.id)
	const stampPath = path.join(PORTAL_MODULES_DIR, `${pin.id}.sha`)

	await fs.mkdirp(PORTAL_MODULES_DIR)

	const abortControl = new AbortController()
	const response = await fetch(pin.tarUrl, {
		headers: { 'User-Agent': 'Companion integration tests' },
		signal: AbortSignal.any([abortControl.signal, AbortSignal.timeout(30000)]),
	})
	if (!response.ok) throw new Error(`Failed to fetch ${pin.id}: HTTP ${response.status} ${response.statusText}`)
	if (!response.body) throw new Error(`Failed to fetch ${pin.id}: no response body`)

	// Download into memory with a size limit, matching the guardrails the real module store uses
	const chunks: Uint8Array[] = []
	let bytesReceived = 0
	for await (const chunk of response.body as ReadableStream<Uint8Array>) {
		bytesReceived += chunk.byteLength
		if (bytesReceived > MAX_MODULE_TAR_SIZE) {
			abortControl.abort()
			throw new Error(`${pin.id} is too large to download safely`)
		}
		chunks.push(chunk)
	}
	const tarBuffer = Buffer.concat(chunks)

	const checksum = crypto.createHash('sha256').update(tarBuffer).digest('hex')
	if (checksum !== pin.tarSha) throw new Error(`${pin.id} download did not match the expected checksum`)

	const decompressed = await gunzipP(tarBuffer, { maxOutputLength: MAX_DECOMPRESSED_MODULE_TAR_SIZE })

	await fs.remove(moduleDir).catch(() => null)
	await fs.mkdirp(moduleDir)
	await new Promise<void>((resolve, reject) => {
		Readable.from(decompressed)
			.pipe(tarfs.extract(moduleDir, { strip: 1 }))
			.on('finish', resolve)
			.on('error', reject)
	})

	await fs.writeFile(stampPath, pin.tarSha, 'utf8')

	return PORTAL_MODULES_DIR
}

/** Every module pinned for the integration tests, downloaded by the `fetch-test-modules` tool */
export const ALL_PORTAL_MODULE_PINS: PortalModulePin[] = [GENERIC_HTTP_3_1_0]
