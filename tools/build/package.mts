#!/usr/bin/env zx

import { $, fs, glob, usePowerShell, argv } from 'zx'
import path from 'path'
import { determinePlatformInfo } from './util.mts'
import { generateVersionString } from '../lib.mts'
import { fetchNodejs } from '../fetch_nodejs.mts'
import electronBuilder from 'electron-builder'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

$.verbose = true

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

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
	async function pruneContentsOfDir(dirname: string) {
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
		const options: electronBuilder.Configuration = {
			productName: 'Companion',
			executableName: 'Companion',
			appId: 'test-companion.bitfocus.no',
			dmg: {
				artifactName: 'companion-mac-${arch}.dmg',
				sign: !!process.env.CSC_LINK, // Only sign in ci
			},
			mac: {
				target: 'dmg',
				category: 'no.bitfocus.companion',
				extendInfo: {
					LSBackgroundOnly: 1,
					LSUIElement: 1,
					NSAppleEventsUsageDescription: 'Companion uses AppleEvents to control local applications.',
				},
				hardenedRuntime: true,
				gatekeeperAssess: false,
				entitlements: 'launcher/entitlements.mac.plist',
				entitlementsInherit: 'launcher/entitlements.mac.plist',
			},
			afterPack: 'launcher/fix-bundled-modules.cjs',
			win: {
				target: 'nsis',
				signtoolOptions: {
					signingHashAlgorithms: ['sha256'],

					sign: async function sign(config, packager) {
						// const path = require('path')
						// const { signWindows } = await import('app-builder-lib/out/codeSign/windowsCodeSign')
						const { getSignVendorPath } = await import('app-builder-lib/out/codeSign/windowsSignToolManager')

						// Do not sign if no certificate is provided.
						if (!config.cscInfo) {
							return
						}

						if (!packager) throw new Error('Packager is required')

						const targetPath = config.path
						// Do not sign elevate file, because that prompts virus warning?
						if (targetPath.endsWith('elevate.exe')) {
							return
						}

						const vendorPath = await getSignVendorPath()
						const toolPath = path.join(vendorPath, 'windows-10', process.arch, 'signtool.exe')

						if (!process.env.BF_CODECERT_KEY) throw new Error('BF_CODECERT_KEY not set')

						const vm = await packager.vm.value
						// const args = configuration.computeSignToolArgs(isWin)

						const args = [
							`sign`,
							'/fd',
							'SHA256',
							'/td',
							'SHA256',
							'/tr',
							'http://timestamp.digicert.com',
							'/d',
							'$Description',
							'/du',
							'https://bitfocus.io',
							'/f',
							'c:\\actions-runner-bitfocusas\\codesign.cer',
							'/csp',
							'eToken Base Cryptographic Provider',
							'/k',
							process.env.BF_CODECERT_KEY,
							targetPath,
						]

						// await retry(
						// 	() =>
						await vm.exec(toolPath, args, {
							timeout: 10 * 60 * 1000,
							env: process.env,
						})
						// 2,
						// 15000,
						// 10000,
						// 0,
						// (e: any) => {
						// 	if (
						// 		e.message.includes('The file is being used by another process') ||
						// 		e.message.includes('The specified timestamp server either could not be reached') ||
						// 		e.message.includes('No certificates were found that met all the given criteria.')
						// 	) {
						// 		log.warn(`Attempt to code sign failed, another attempt will be made in 15 seconds: ${e.message}`)
						// 		return true
						// 	}
						// 	return false
						// }
						// )
						//

						// await signWindows(config, packager)
					},
				},
			},
			nsis: {
				artifactName: 'companion-win64.exe',
				createStartMenuShortcut: true,
				perMachine: false,
				oneClick: false,
				selectPerMachineByDefault: true,
				allowElevation: true,
				allowToChangeInstallationDirectory: true,
				installerIcon: 'icon.ico',
				installerSidebar: 'compinst.bmp',
				uninstallerSidebar: 'compinst.bmp',
			},
			directories: {
				buildResources: 'assets/',
				output: '../electron-output/',
			},
			linux: {
				target: 'dir',
				executableName: 'companion-launcher',
				artifactName: 'companion-x64',
				extraFiles: [
					{
						from: '../assets/linux',
						to: '.',
					},
				],
			},
			files: ['**/*', 'assets/*'],
			extraResources: [
				{
					from: '../dist',
					to: '.',
					filter: ['**/*', '!.yarn'],
				},
			],
		}

		// perform the electron build
		await electronBuilder.build({
			targets: electronBuilder.Platform.fromString(platformInfo.electronBuilderPlatform).createTarget(
				null,
				platformInfo.electronBuilderArch
			),
			config: options,
			projectDir: 'launcher',
		})
	} finally {
		// undo the changes made
		await fs.writeFile(launcherPkgJsonPath, launcherPkgJsonStr)
	}
} else {
	// TODO - populate dist with the rest of the bits
}
