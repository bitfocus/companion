import fs from 'fs-extra'
import path from 'path'
import { isPackaged } from './Util.js'

// Always disable the utf-8-validate module, it is not needed since nodejs v18.14.0
process.env.WS_NO_UTF_8_VALIDATE = '1'

/**
 * Danger: This file must not import other code, as it needs to run before `ws` is imported
 * making it unsafe to import any other code
 */

// Only run if webpacked
if (isPackaged()) {
	// Disable loading some ws libs if they were not provided on disk, otherwise the application will crash
	if (!fs.pathExistsSync(path.join(import.meta.dirname, 'node_modules/bufferutil'))) {
		process.env.WS_NO_BUFFER_UTIL = '1'
	}
}
