import fs from 'fs-extra'
import { isPackaged } from '../Resources/Util.js'
import { fileURLToPath } from 'node:url'
import path from 'path'
import type { ModuleManifest } from '@companion-module/base'
import { doesModuleSupportPermissionsModel } from './ApiVersions.js'

// This isn't used once webpacked, but avoiding including it in the final build becomes messy
const nodeVersionsStr = fs.readFileSync(new URL('../../../nodejs-versions.json', import.meta.url)).toString()
const nodeVersionsJson = JSON.parse(nodeVersionsStr)

/**
 * Get the path to the Node.js binary for the given runtime type.
 */
export async function getNodeJsPath(runtimeType: string): Promise<string | null> {
	const versionNumber = nodeVersionsJson[runtimeType]
	if (!versionNumber) return null

	const pathToDir = isPackaged() ? path.join(__dirname, '/node-runtimes') : '../../../.cache/node-runtime'
	const nodePath = path.join(
		isPackaged() ? pathToDir : fileURLToPath(new URL(pathToDir, import.meta.url)),
		isPackaged() ? runtimeType : `${process.platform}-${process.arch}-${versionNumber}`,
		process.platform === 'win32' ? 'node.exe' : 'bin/node'
	)

	// Make sure it exists
	if (!(await fs.pathExists(nodePath))) return null

	return nodePath
}

export function getNodeJsPermissionArguments(
	manifest: ModuleManifest,
	moduleApiVersion: string,
	moduleDir: string
): string[] {
	// Not supported by node18
	if (manifest.runtime.type === 'node18' || !doesModuleSupportPermissionsModel(moduleApiVersion)) return []

	const args = [
		'--permission',
		// Always allow read access to the module source directory
		`--allow-fs-read=${moduleDir}`,
	]

	let forceReadWriteAll = false
	if (process.platform === 'win32' && moduleDir.startsWith('\\\\')) {
		// This is a network path, which nodejs does not support for the permissions model
		forceReadWriteAll = true
	}

	const manifestPermissions = manifest.runtime.permissions || {}
	if (manifestPermissions['worker-threads']) args.push('--allow-worker')
	if (manifestPermissions['child-process'] || manifestPermissions['native-addons']) args.push('--allow-child-process')
	if (manifestPermissions['native-addons']) args.push('--allow-addons')
	if (manifestPermissions['native-addons'] || manifestPermissions['filesystem'] || forceReadWriteAll) {
		// Note: Using native addons usually means probing random filesystem paths to check the current platform

		// Future: This should be scoped to some limited directories as specified by the user in the connection settings
		args.push('--allow-fs-read=*', '--allow-fs-write=*')
	}

	return args
}
