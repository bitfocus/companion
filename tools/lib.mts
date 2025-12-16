import { $, fs } from 'zx'

// suppress fnm reporting node version
process.env.FNM_LOGLEVEL = 'quiet'

async function parseGitRef() {
	const gitRefRaw = await $`git rev-parse --abbrev-ref HEAD`
	const gitRef = gitRefRaw.stdout.trim()
	if (!gitRef || gitRef === 'HEAD') {
		return process.env.GITHUB_REF_NAME || 'unknown'
	} else {
		return gitRef
	}
}

export async function generateVersionString() {
	return goSilent(async () => {
		const headHashRaw = await $`git rev-parse --short=10 HEAD`
		const headHash = headHashRaw.stdout.trim()

		const packageJsonStr = await fs.readFile(new URL('../package.json', import.meta.url))
		const packageJson = JSON.parse(packageJsonStr.toString())
		const packageVersion = packageJson.version

		let gitRef = await parseGitRef()
		if (gitRef === 'v' + packageVersion) {
			gitRef = 'stable'
		} else {
			gitRef = gitRef.replaceAll(/[^a-zA-Z0-9]+/g, '-').replaceAll(/[-]+/g, '-')
		}

		const commitCountRaw = await $`git rev-list --count HEAD`
		const commitCount = commitCountRaw.stdout.trim()

		return `${packageVersion}+${commitCount}-${gitRef}-${headHash}`
	})
}

export async function generateMiniVersionString() {
	return goSilent(async () => {
		const packageJsonStr = await fs.readFile(new URL('../package.json', import.meta.url))
		const packageJson = JSON.parse(packageJsonStr.toString())
		const packageVersion = packageJson.version

		const gitRef = await parseGitRef()
		if (gitRef === 'v' + packageVersion) {
			return packageVersion
		} else {
			const commitCountRaw = await $`git rev-list --count HEAD`
			const commitCount = commitCountRaw.stdout.trim()

			return `${packageVersion}+${commitCount}`
		}
	})
}

/** Run some code with the $.verbose set to false */
export async function goSilent<T>(fcn: () => Promise<T>): Promise<T> {
	const verboseBefore = $.verbose
	$.verbose = false

	try {
		return await fcn()
	} finally {
		$.verbose = verboseBefore
	}
}

export function $withoutEscaping(pieces, ...args) {
	const origQuote = $.quote
	try {
		$.quote = (unescapedCmd) => unescapedCmd
		return $(pieces, args)
	} finally {
		$.quote = origQuote
	}
}
