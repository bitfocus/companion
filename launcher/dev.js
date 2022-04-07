try {
	require('electron-reloader')(module)
} catch (_) {}

require('./main')
