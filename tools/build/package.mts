#!/usr/bin/env zx

import { $, fs, glob, usePowerShell, argv } from 'zx'
import path from 'path'
import { determinePlatformInfo } from './util.mts'
import { generateVersionString } from '../lib.mts'
import { fetchNodejs } from '../fetch_nodejs.mts'
import electronBuilder from 'electron-builder'

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
const latestRuntimeDir = path.join(runtimesDir, 'node22')
await fs.remove(runtimesDir)
await fs.mkdirp(runtimesDir)

for (const [name, extractedPath] of nodeVersions) {
	console.log(`packaging version ${name} from ${extractedPath}`)
	await fs.copy(extractedPath, path.join(runtimesDir, name))
}

if (platformInfo.runtimePlatform === 'linux') {
	// Create a symlink for the 'main' runtime, to make script maintenance easier
	await fs.createSymlink(latestRuntimeDir, path.join(runtimesDir, 'main'), 'dir')
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

	let prebuildDirs = await glob('dist/**/prebuilds', { onlyDirectories: true, expandDirectories: false })
	// Note: "dist/node_modules/@napi-rs" will usually have only the relevant prebuild folder (canvas-osname)
	// so this only does anything when `os:` in 'dist/.yarnrc.yml' is a list (see dist.mts)
	prebuildDirs.push('dist/node_modules/@napi-rs')
	console.log(`Cleaning ${prebuildDirs.length} prebuild directories`)
	for (const dirname of prebuildDirs) {
		console.log(`pruning prebuilds from: ${dirname}`)
		await pruneContentsOfDir(dirname)
	}
}

// Cleanup some other 'junk'
await fs.remove('dist/node_modules/.bin')
await fs.remove('dist/node_modules/usb/libusb')
await fs.remove('dist/node_modules/usb/node_modules/node-addon-api')
await fs.remove('dist/node_modules/node-addon-api')

if (!process.env.SKIP_LAUNCH_CHECK) {
	const nodeExePath =
		platformInfo.runtimePlatform === 'win'
			? path.join(latestRuntimeDir, 'node.exe')
			: path.join(latestRuntimeDir, 'bin/node')

	// Note: the ./${nodeExePath} syntax is a workaround for windows
	if (platformInfo.runtimePlatform === 'win' && process.platform === 'linux') {
		// Assume we're in WSL: exe files are not executable by default. Alt test: add is-wsl package... (but this code is harmless)
		fs.chmodSync(nodeExePath, 0o755)
	}
	// (Note that Windows "loses" the current directory since UNC paths are not supported, but that's OK here.)
	const launchCheck = await $`./${nodeExePath} dist/main.js check-launches`.exitCode
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

	// Update the version if not a stable build
	const versionInfo = await generateVersionString()
	if (!versionInfo.includes('-stable-')) {
		const launcherPkgJson = JSON.parse(launcherPkgJsonStr.toString())
		launcherPkgJson.version = versionInfo

		await fs.writeFile(launcherPkgJsonPath, JSON.stringify(launcherPkgJson))
	}

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
					NSLocalNetworkUsageDescription: 'Companion uses local network to communicate with devices.',
				},
				hardenedRuntime: true,
				gatekeeperAssess: false,
				entitlements: 'launcher/entitlements.mac.plist',
				entitlementsInherit: 'launcher/entitlements.mac.plist',
			},
			win: {
				target: 'nsis',
				verifyUpdateCodeSignature: false, // Enabling this would need publishedName to be set, not sure if that is possible
				signtoolOptions: {
					signingHashAlgorithms: ['sha256'],

					sign: async function sign(config, packager) {
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

						if (!process.env.BF_CODECERT_KEY) throw new Error('BF_CODECERT_KEY variable is not set')

						const vm = await packager.vm.value
						await vm.exec(
							'powershell.exe',
							['c:\\actions-runner-bitfocus\\sign.ps1', targetPath, `-Description`, 'Bitfocus Companion'],
							{
								timeout: 10 * 60 * 1000,
								env: process.env,
							}
						)
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
				{
					from: '../launcher-ui/build',
					to: './settings-ui',
					filter: ['**/*', '!*.map'],
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
