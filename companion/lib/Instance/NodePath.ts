import fs from 'fs-extra'
import { isPackaged } from '../Resources/Util.js'
import { fileURLToPath } from 'node:url'
import path from 'path'

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
