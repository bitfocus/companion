import fs from 'fs-extra'
import path from 'path'

// Only run if webpacked
if (typeof __webpack_require__ === 'function') {
	// Disable loading some ws libs if they were not provided on disk, otherwise the application will crash
	if (!fs.pathExistsSync(path.join(__dirname, 'node_modules/bufferutil'))) {
		process.env.WS_NO_BUFFER_UTIL = 1
	}
	if (!fs.pathExistsSync(path.join(__dirname, 'node_modules/utf-8-validate'))) {
		process.env.WS_NO_UTF_8_VALIDATE = 1
	}
}
