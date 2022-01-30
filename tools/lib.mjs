export async function generateVersionString() {
	return goSilent(async () => {
		const headHashRaw = await $`git rev-parse --short HEAD`
		const headHash = headHashRaw.stdout.trim()

		const packageJsonStr = await fs.readFile(new URL('../package.json', import.meta.url))
		const packageJson = JSON.parse(packageJsonStr.toString())
		const packageVersion = packageJson.version

		const commitCountRaw = await $`git rev-list --count HEAD`
		const commitCount = commitCountRaw.stdout.trim()

		return `${packageVersion}-${headHash}-${commitCount}`
	})
}

/** Run some code with the $.verbose set to false */
export async function goSilent(fcn) {
	const verboseBefore = $.verbose
	$.verbose = false

	try {
		return await fcn()
	} finally {
		$.verbose = verboseBefore
	}
}
