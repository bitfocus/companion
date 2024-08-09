#!/usr/bin/env zx

import { fs, glob } from 'zx'
import { determinePlatformInfo } from './util.mjs'
import { generateVersionString } from '../lib.mjs'
import { fetchNodejs } from '../fetch_nodejs.mjs'

// Determine some environment info
const platformInfo = determinePlatformInfo(argv._[0])
if (platformInfo.nodePlatform) process.env.npm_config_platform = platformInfo.nodePlatform
if (platformInfo.nodeArch) {
	process.env.npm_config_arch = platformInfo.nodeArch
	process.env.npm_config_target_arch = platformInfo.nodeArch
}

// Download and cache build of nodejs
const nodeVersions = await fetchNodejs(platformInfo)

const runtimesDir = 'dist/node-runtimes/'
await fs.remove(runtimesDir)
await fs.mkdirp(runtimesDir)

for (const [name, extractedPath] of nodeVersions) {
	console.log(`packaging version ${name} from ${extractedPath}`)
	await fs.copy(extractedPath, path.join(runtimesDir, name))
}

if (platformInfo.runtimePlatform === 'linux') {
	// Create a symlink for the 'main' runtime, to make script maintainence easier
	await fs.createSymlink(path.join(runtimesDir, 'node22'), path.join(runtimesDir, 'main'))
}

// Install dependencies
$.cwd = 'dist'
// await fs.writeFile(`dist/yarn.lock`, '')
await $`yarn install --no-immutable`
$.cwd = undefined

// Prune out any prebuilds from other platforms
if (platformInfo.runtimePlatform === 'win') {
	// Electron-builder fails trying to sign `.node` files from other platforms
	async function pruneContentsOfDir(dirname) {
		const contents = await fs.readdir(dirname)
		for (const subdir of contents) {
			// TODO - test if it is a node file, or contains one?
			// TODO - cross-platform matching?
			if (
				subdir.includes('android') ||
				subdir.includes('linux') ||
				subdir.includes('darwin') ||
				subdir.includes('ia32')
			) {
				await fs.remove(path.join(dirname, subdir))
			}
		}
	}

	const prebuildDirs = await glob('dist/**/prebuilds', { onlyDirectories: true })
	console.log(`Cleaning ${prebuildDirs.length} prebuild directories`)
	for (const dirname of prebuildDirs) {
		console.log(`pruning prebuilds from: ${dirname}`)
		await pruneContentsOfDir(dirname)
	}
}

if (!process.env.SKIP_LAUNCH_CHECK) {
	const launchCheck = await $`node dist/main.js check-launches`.exitCode
	if (launchCheck !== 89) throw new Error("Launch check failed. Build looks like it won't launch!")
}

// if (!platform) {
// 	// If for our own platform, make sure the correct deps are installed
// 	await $`electron-builder install-app-deps`
// }

// TODO - make optional from flag
if (process.env.ELECTRON !== '0') {
	// Set version of the launcher to match the contents of the BUILD file

	const launcherPkgJsonPath = new URL('../../launcher/package.json', import.meta.url)
	const launcherPkgJsonStr = await fs.readFile(launcherPkgJsonPath)

	const versionInfo = await generateVersionString()

	const launcherPkgJson = JSON.parse(launcherPkgJsonStr.toString())
	launcherPkgJson.version = versionInfo

	await fs.writeFile(launcherPkgJsonPath, JSON.stringify(launcherPkgJson))

	try {
		// perform the electron build
		await $`yarn workspace @companion-app/launcher run -B electron-builder --publish=never ${platformInfo.electronBuilderArgs}`
	} finally {
		// undo the changes made
		await fs.writeFile(launcherPkgJsonPath, launcherPkgJsonStr)
	}
} else {
	// TODO - populate dist with the rest of the bits
}
