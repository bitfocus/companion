import path from 'path'
import { SetOptional } from 'type-fest'

function expandMissing(info: SetOptional<PlatformInfo, 'nodeArch' | 'nodePlatform'>): PlatformInfo {
	return {
		// Allow some fields to be optional, if they are repeated
		nodeArch: info.runtimeArch,
		nodePlatform: info.runtimePlatform,
		...info,
	}
}

export const toPosix = (str: string) => str.split(path.sep).join(path.posix.sep)

export interface PlatformInfo {
	electronBuilderArgs: string[]
	runtimePlatform: string
	runtimeArch: string
	nodePlatform: string
	nodeArch: string
}

export function determinePlatformInfo(platform: string | undefined): PlatformInfo {
	if (!platform) {
		platform = `${process.platform}-${process.arch}`
		console.log(`No platform specified, assumed ${platform}`)
	}

	if (platform === 'mac-x64' || platform === 'darwin-x64') {
		return expandMissing({
			electronBuilderArgs: ['--x64', '--mac'],
			runtimePlatform: 'darwin',
			runtimeArch: 'x64',
		})
	} else if (platform === 'mac-arm64' || platform === 'darwin-arm' || platform === 'darwin-arm64') {
		return expandMissing({
			electronBuilderArgs: ['--arm64', '--mac'],
			runtimePlatform: 'darwin',
			runtimeArch: 'arm64',
		})
	} else if (platform === 'win-x64' || platform === 'win32-x64') {
		return expandMissing({
			electronBuilderArgs: ['--x64', '--win'],
			runtimePlatform: 'win',
			nodePlatform: 'win32',
			runtimeArch: 'x64',
		})
	} else if (platform === 'linux-x64') {
		return expandMissing({
			electronBuilderArgs: ['--x64', '--linux'],
			runtimePlatform: 'linux',
			runtimeArch: 'x64',
		})
	} else if (platform === 'linux-arm7' || platform === 'linux-arm' || platform === 'linux-armv7l') {
		return expandMissing({
			electronBuilderArgs: ['--armv7l', '--linux'],
			runtimePlatform: 'linux',
			runtimeArch: 'armv7l',
			nodeArch: 'arm',
		})
	} else if (platform === 'linux-arm64') {
		return expandMissing({
			electronBuilderArgs: ['--arm64', '--linux'],
			runtimePlatform: 'linux',
			runtimeArch: 'arm64',
		})
	} else {
		throw new Error(`Unknown platform "${platform}"`)
	}
}
