import fs from 'node:fs'
import path from 'node:path'

// Always disable the utf-8-validate module, it is not needed since nodejs v18.14.0
process.env.WS_NO_UTF_8_VALIDATE = '1'

/**
 * Danger: This file must not import other code, as it needs to run before `ws` is imported
 * making it unsafe to import any other code
 */

// Only run if webpacked
if (typeof __webpack_require__ === 'function') {
	// Disable loading some ws libs if they were not provided on disk, otherwise the application will crash
	if (!fs.existsSync(path.join(import.meta.dirname, 'node_modules/bufferutil'))) {
		process.env.WS_NO_BUFFER_UTIL = '1'
	}
}
