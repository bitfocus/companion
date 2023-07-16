function expandMissing(info) {
	return {
		// Allow some fields to be optional, if they are repeated
		nodeArch: info.runtimeArch,
		runtimePlatform: info.runtimePlatform,
		runtimeArch: info.runtimeArch,
		...info,
	}
}

export function determinePlatformInfo(platform) {
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
