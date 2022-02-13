import fs from 'fs-extra'
import path from 'path'

const baseModulePath = './module-bundled'
const moduleListing = './default-modules.json'
const moduleProxyUrl = 'https://github.com/bitfocus/companion-module-proxy.git'

console.log(`Updating modules`)
console.log('')

const moduleJsonStr = await fs.readFile(moduleListing)
const moduleJson = JSON.parse(moduleJsonStr.toString())

if (Object.keys(moduleJson.modules).length > 0) {
	throw new Error('New module cloning not implemented yet')
}

async function doLegacyModule(id, tagName, modulePath) {
	// TODO - should we use a 'pre-built' module-proxy instead of needing all the dev stuff?
	// Ensure the module-proxy exists
	if (await fs.pathExists(modulePath)) {
		const remoteCheck = await $`git -C ${modulePath} remote get-url origin`
		if (remoteCheck.stdout.trim() !== moduleProxyUrl) {
			throw new Error(`Module is wrong repository`)
		}

		// ensure git is looking at the right code
		await $`git -C ${modulePath} reset --hard`
		await $`git -C ${modulePath} checkout main`
		await $`git -C ${modulePath} pull origin main`
	} else {
		await $`git clone ${moduleProxyUrl} ${modulePath}`
	}

	// add the legacy module
	const pkgStr = `companion-wrapped-module@github:bitfocus/companion-module-${id}#${tagName}`
	await $`yarn --cwd=${modulePath} add ${pkgStr}`

	// // clone the legacy module
	// const legacyPath = path.join(modulePath, 'module/legacy')
	// const moduleUrl = `https://github.com/bitfocus/companion-module-${id}.git`
	// if (await fs.pathExists(legacyPath)) {
	// 	const remoteCheck = await $`git -C ${legacyPath} remote get-url origin`
	// 	if (remoteCheck.stdout.trim() !== moduleUrl) {
	// 		throw new Error(`Module is wrong repository`)
	// 	}

	// 	// ensure git is looking at the right code
	// 	await $`git -C ${legacyPath} reset --hard`
	// 	await $`git -C ${legacyPath} checkout ${tagName}`
	// } else {
	// 	await $`git clone ${moduleUrl} --branch=${tagName} ${legacyPath}`
	// }

	// get yarn things done
	await $`yarn --cwd=${modulePath}`
	await $`yarn --cwd=${modulePath} link @companion-module/base` // TODO - hack
	await $`yarn --cwd=${modulePath} build`
	await $`yarn --cwd=${modulePath} generate-manifest`
	await $`yarn --cwd=${modulePath} --prod`
}

let failedModules = []

for (const [id, tagName] of Object.entries(moduleJson.legacy)) {
	console.log(`Legacy module ${id}`)
	const modulePath = path.join(baseModulePath, id)
	try {
		await doLegacyModule(id, tagName, modulePath)
	} catch (e0) {
		await fs.rm(modulePath, {
			recursive: true,
			force: true,
		})

		console.warn(`Retrying after failure: ${e0?.message ?? e0}`)
		try {
			// retry
			await doLegacyModule(id, tagName, modulePath)
		} catch (e) {
			console.error(`Failed to update module: ${e?.message ?? e}. Discarding`)
			await fs.rm(modulePath, {
				recursive: true,
				force: true,
			})
			failedModules.push(id)
		}
	}
	console.log('')
}

if (failedModules.length > 0) console.log(`Some modules failed: ${failedModules.join(', ')}`)

console.log('Done')
