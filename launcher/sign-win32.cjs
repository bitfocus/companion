exports.default = async function signWin32(config, packager) {
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
}
