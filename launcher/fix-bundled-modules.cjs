const path = require('path')
const fs = require('fs-extra')

exports.default = async function beforePack(context) {
	const { electronPlatformName, appOutDir } = context
	if (electronPlatformName !== 'win32') {
		return
	}

	// electron-builder messes up any symlinks in bundled-modules on windows, and causes the build to fail
	// so after the unpacked dir has been created we delete the bundled-modules and make our own copy
	await fs.remove(path.join(appOutDir, 'resources/bundled-modules'))
	await fs.copy('dist/bundled-modules', path.join(appOutDir, 'resources/bundled-modules'))
}
