import fs from 'fs-extra'
import { isPackaged } from '../Resources/Util.js'
import { fileURLToPath } from 'node:url'
import path from 'path'

// TODO: this won't work for webpack builds
const nodeVersionsStr = fs.readFileSync(new URL('../../../nodejs-versions.json', import.meta.url)).toString()
const nodeVersionsJson = JSON.parse(nodeVersionsStr)

console.log('versions', nodeVersionsJson)

/**
 * Get the path to the Node.js binary for the given runtime type.
 * @param {string} runtimeType
 * @returns {string | null}
 */
export function getNodeJsPath(runtimeType) {
	const versionNumber = nodeVersionsJson[runtimeType]
	if (!versionNumber) return null

	const pathToDir = fileURLToPath(
		new URL(isPackaged() ? 'node-runtimes' : '../../../.cache/node-runtime', import.meta.url)
	)
	const exeName = process.platform === 'win32' ? 'node.exe' : 'bin/node'
	return path.join(
		pathToDir,
		isPackaged() ? runtimeType : `${process.platform}-${process.arch}-${versionNumber}`,
		exeName
	)
}
