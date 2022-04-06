// Electron doesn't support ESM main files, so we need to use this file to be our conversion point
;(async function () {
	try {
        // Make electron 'global' as it can't be imported in esm files
		globalThis.electron = require('electron')
		await import('./electron.js')
	} catch (e) {
		console.error(`Failed to start: ${e}`)
		process.exit(1)
	}
})()
