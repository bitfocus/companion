import fs from 'fs-extra'
import { isPackaged } from '../Resources/Util.js'
import path from 'path'
import { doesModuleSupportPermissionsModel } from './Connection/ApiVersions.js'
import type { SomeModuleManifest } from '@companion-app/shared/Model/ModuleManifest.js'
import { createRequire } from 'module'

/**
 * Get the path to the Node.js binary for the given runtime type.
 */
export async function getNodeJsPath(runtimeType: string): Promise<string | null> {
	if (!isPackaged()) {
		const nodeVersionsStr = fs
			.readFileSync(path.join(import.meta.dirname, '../../../assets/nodejs-versions.json'))
			.toString()
		const nodeVersionsJson = JSON.parse(nodeVersionsStr)
		const versionNumber = nodeVersionsJson[runtimeType]
		if (!versionNumber) return null
		runtimeType = `${process.platform}-${process.arch}-${versionNumber}`
	}
	const pathToDir = isPackaged() ? './node-runtimes' : '../../../.cache/node-runtime'
	const nodePath = path.join(
		path.join(import.meta.dirname, pathToDir),
		runtimeType,
		process.platform === 'win32' ? 'node.exe' : 'bin/node'
	)

	// Make sure it exists
	if (!(await fs.pathExists(nodePath))) return null

	return nodePath
}

export function getNodeJsPermissionArguments(
	manifest: SomeModuleManifest,
	moduleApiVersion: string,
	moduleDir: string,
	enableInspect: boolean
): string[] {
	// Not supported by surfaces
	if (manifest.type === 'surface') return []

	// Not supported by node18
	if (enableInspect || manifest.runtime.type === 'node18' || !doesModuleSupportPermissionsModel(moduleApiVersion))
		return []

	const args = [
		'--no-warnings=SecurityWarning',
		'--permission',
		// Always allow read access to the module source directory
		`--allow-fs-read=${moduleDir}`,
	]

	if (!isPackaged()) {
		// Always allow read access to module host package, needed when running a dev version
		const require = createRequire(import.meta.url)
		args.push(`--allow-fs-read=${path.join(path.dirname(require.resolve('@companion-module/host')), '../../..')}`)
	}

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
