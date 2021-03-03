const path = require('path')
const asar = require('asar')
const rimraf = require('rimraf')
const util = require('util')
const { exec } = require('child_process')
const fs = require('fs')
const pall = require('p-all')

const exec2 = util.promisify(exec)
const copy2 = util.promisify(fs.copyFile)

async function runForDir(root, srcModuleDir, modName) {
	try {
		const modDir = path.join(root, modName)
		const pkgInfo = require(path.join(modDir, 'package.json'))
		if (Object.keys(pkgInfo.dependencies || {}).length > 0) {
			const hasTypescript = (pkgInfo.devDependencies || {}).typescript
			// TODO - what if it uses typescript and a native module?

			try {
				await copy2(path.join(srcModuleDir, modName, 'yarn.lock'), path.join(modDir, 'yarn.lock'))
			} catch (e) {
				console.error(`Missing yarn.lock for "${modName}"`)
			}

			console.log('running', modName)
			await exec2(`yarn --production ${hasTypescript ? '--ignore-scripts' : ''}`, {
				cwd: path.join(root, modName),
			})
		}
	} catch (e) {
		console.log(`threw error: ${e}`)
	}
}

module.exports = async function (context) {
	const APP_NAME = context.packager.appInfo.productFilename
	const PLATFORM = context.packager.platform.name
	const resourcesPath =
		PLATFORM === 'mac'
			? path.join(context.appOutDir, APP_NAME + '.app', 'Contents/Resources')
			: path.join(context.appOutDir, 'resources')

	const srcPath = context.packager.info.projectDir

	const appAsar = path.join(resourcesPath, 'app.asar')
	const tmpApp = path.join(resourcesPath, 'app.tmp')

	console.log('unpacking')
	asar.extractAll(appAsar, tmpApp)

	const srcModuleDir = path.join(srcPath, 'lib/module')
	const moduleDir = path.join(tmpApp, 'lib/module')
	const modules = await util.promisify(fs.readdir)(moduleDir)

	console.log('installing')

	await pall(
		[
			...modules.map((m) => async () => {
				// TODO - if a dir and has package.json?
				await runForDir(moduleDir, srcModuleDir, m)
			}),
		],
		{
			concurrency: 1, // Higher values cause cache errors
		}
	)

	console.log('repacking')
	await asar.createPackage(tmpApp, appAsar)

	console.log('cleanup')
	await util.promisify(rimraf)(tmpApp)

	console.log('done')
}
