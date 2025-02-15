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

const prebuildsToKeep: string[] = [
	'dist/prebuilds/better_sqlite3.node',
	'julusian_segfault_handler-',
	'julusian-image-rs.',
	'jpeg-turbo-',
	'HID-',
	'HID_hidraw-',
	'usb',
	'@serialport/bindings-cpp',
	'bufferutil',
]

// Prune out any prebuilds from other platforms
// Electron-builder on windows fails trying to sign `.node` files from other platforms, and it wastes disk space
const prebuildDirs = await glob('dist/**/*', { onlyDirectories: true })
console.log(`Cleaning ${prebuildDirs.length} prebuild directories`)
const matchedPrebuilds = new Set<string>()
const unmatchedDirs: string[] = []
for (const dirname of prebuildDirs) {
	console.log(`pruning prebuilds from: ${dirname}`)

	const subdirs = await fs.readdir(dirname)
	for (const subdir of subdirs) {
		const fullpath = path.join(dirname, subdir)
		// console.log('checking', fullpath)
		// Keep exact matches
		if (prebuildsToKeep.includes(subdir)) {
			matchedPrebuilds.add(fullpath)
			continue
		}

		// Check for partial matches
		let matched = false
		for (const name of prebuildsToKeep) {
			if (fullpath.includes(name)) {
				if (subdir.includes(platformInfo.runtimePlatform)) {
					matchedPrebuilds.add(fullpath)
				} else {
					console.log('purging', fullpath)
					await fs.remove(fullpath)
				}
				matched = true
				continue
			}
		}

		if (!matched) {
			unmatchedDirs.push(fullpath)
		}
	}
}
if (unmatchedDirs.length) {
	throw new Error(`Unknown prebuilds found in directory: ${unmatchedDirs.join(', ')}`)
}

// Clean out some extra source files that are large
await fs.remove('dist/node_modules/node-addon-api')
await fs.remove('dist/node_modules/node-gyp')
await fs.remove('dist/node_modules/usb/libusb')

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
