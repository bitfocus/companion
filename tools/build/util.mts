import path from 'path'
import electronBuilder from 'electron-builder'
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
	electronBuilderPlatform: string
	electronBuilderArch: electronBuilder.Arch
	// electronBuilderArgs: string[]
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
			electronBuilderPlatform: 'mac',
			electronBuilderArch: electronBuilder.Arch.x64,
			runtimePlatform: 'darwin',
			runtimeArch: 'x64',
		})
	} else if (platform === 'mac-arm64' || platform === 'darwin-arm' || platform === 'darwin-arm64') {
		return expandMissing({
			electronBuilderPlatform: 'mac',
			electronBuilderArch: electronBuilder.Arch.arm64,
			runtimePlatform: 'darwin',
			runtimeArch: 'arm64',
		})
	} else if (platform === 'win-x64' || platform === 'win32-x64') {
		return expandMissing({
			electronBuilderPlatform: 'win',
			electronBuilderArch: electronBuilder.Arch.x64,
			runtimePlatform: 'win',
			nodePlatform: 'win32',
			runtimeArch: 'x64',
		})
	} else if (platform === 'win-arm64' || platform === 'win32-arm64') {
		return expandMissing({
			electronBuilderPlatform: 'win',
			electronBuilderArch: electronBuilder.Arch.arm64,
			runtimePlatform: 'win',
			nodePlatform: 'win32',
			runtimeArch: 'arm64',
		})
	} else if (platform === 'linux-x64') {
		return expandMissing({
			electronBuilderPlatform: 'linux',
			electronBuilderArch: electronBuilder.Arch.x64,
			runtimePlatform: 'linux',
			runtimeArch: 'x64',
		})
	} else if (platform === 'linux-arm64') {
		return expandMissing({
			electronBuilderPlatform: 'linux',
			electronBuilderArch: electronBuilder.Arch.arm64,
			runtimePlatform: 'linux',
			runtimeArch: 'arm64',
		})
	} else {
		throw new Error(`Unknown platform "${platform}"`)
	}
}
