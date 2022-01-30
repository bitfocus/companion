#!/usr/bin/env zx

import { generateVersionString } from './lib.mjs'

// await $`git fetch --depth=10000`

const build = await generateVersionString().catch((e) => {
	console.error('Failed to detemine BUILD string')
	console.error(e)
	process.exit(1)
})
console.log('Build:', build)

// find all the possible files
const rawList = await fs.readdir(new URL('../electron-output', import.meta.url)).catch(() => {
	console.error('Error opening electron-output directory')
	console.error(e)
	process.exit(1)
})
const list = rawList.map((line) => `electron-output/${line}`)
console.log('Possible files:\n ', list.join('\n  '))

// match the file to upload
let artifact_source
let artifact_dest

if (process.env.CI_BUILD_OS === 'osx') {
	const arch = process.env.CI_BUILD_ARCH
	artifact_source = list.find((file) => file.match(/\.dmg$/))
	artifact_dest = `companion-${build}-mac-${arch}.dmg`
} else if (process.env.CI_BUILD_OS === 'linux') {
	artifact_source = list.find((file) => file.match(/\.gz$/))
	artifact_dest = `companion-${build}-linux-x64.tar.gz`
} else if (process.env.CI_BUILD_OS === 'win64') {
	artifact_source = list.find((file) => file.match(/\.exe$/))
	artifact_dest = `companion-${build}-win64.exe`
} else if (process.env.CI_BUILD_OS === 'armv7l') {
	artifact_source = list.find((file) => file.match(/\.z$/))
	artifact_dest = `companion-${build}-linux-armv7l.tar.gz`
} else {
	console.error(`Unknown operating system: ${process.env.CI_BUILD_OS}`)
	process.exit(1)
}

if (!artifact_source) {
	console.error(`Failed to find file to upload`)
	process.exit(1)
}

// do the upload
try {
	console.log(`Upload ${artifact_source} to ${artifact_dest}`)
	const scriptPath = new URL('./upload_build.js', import.meta.url).pathname
	await $`node ${scriptPath} ${artifact_source} ${artifact_dest}`
} catch (e) {
	console.error('Error uploading artifact: ', e)
	process.exit(1)
}

console.log('DONE')
