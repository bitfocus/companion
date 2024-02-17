try {
	require('electron-reloader')(module)
} catch (_) {}

import('./main.js')
