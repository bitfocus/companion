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

	const pathToDir = fileURLToPath(
		new URL(isPackaged() ? path.join(__dirname, '/node-runtimes') : '../../../.cache/node-runtime', import.meta.url)
	)
	const exeName = process.platform === 'win32' ? 'node.exe' : 'bin/node'
	const nodePath = path.join(
		pathToDir,
		isPackaged() ? runtimeType : `${process.platform}-${process.arch}-${versionNumber}`,
		exeName
	)

	// Make sure it exists
	if (!(await fs.pathExists(nodePath))) return null

	return nodePath
}
