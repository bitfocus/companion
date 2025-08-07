import electron, { ipcMain, app, BrowserWindow, dialog } from 'electron'

/** @type {BrowserWindow | null} */
let settingsWindow = null

export function showSettings(/** @type {BrowserWindow | null} */ parentWindow) {
	console.log('show settings')
	// TODO

	if (settingsWindow) {
		settingsWindow.show()
		settingsWindow.focus()
		return
	}

	settingsWindow = new BrowserWindow({
		parent: parentWindow,
		modal: true,
		width: 1280,
		height: 720,
		minWidth: 640,
		minHeight: 480,
		show: true,
		autoHideMenuBar: true,
		minimizable: false,

		// webPreferences: {
		// 	nodeIntegration: true,
		// 	contextIsolation: false,
		// },
	})

	if (app.isPackaged) {
		settingsWindow.loadURL(`file://${process.resourcesPath}/settings-ui/index.html`).catch((err) => {
			console.error('Failed to load settings.html:', err)
			dialog.showErrorBox('Error', 'Failed to load settings window.')
		})
	} else {
		settingsWindow.loadURL('http://localhost:5177/').catch((err) => {
			console.error('Failed to load settings.html:', err)
			dialog.showErrorBox('Error', 'Failed to load settings window.')
		})
	}

	settingsWindow.on('closed', () => {
		settingsWindow = null
	})
}
