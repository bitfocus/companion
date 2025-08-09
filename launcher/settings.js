// @ts-check
import { app, BrowserWindow, dialog, shell, nativeTheme } from 'electron'
import { fileURLToPath } from 'url'

/** @type {BrowserWindow | null} */
let settingsWindow = null

export function getSettingsWindow() {
	return settingsWindow
}

export function showSettings(/** @type {BrowserWindow | null} */ parentWindow) {
	console.log('show settings')

	if (settingsWindow) {
		settingsWindow.show()
		settingsWindow.focus()
		return
	}

	// const dark = nativeTheme.shouldUseDarkColors

	settingsWindow = new BrowserWindow({
		parent: parentWindow ?? undefined,
		modal: true,
		width: 1280,
		height: 720,
		minWidth: 640,
		minHeight: 480,
		show: true,
		autoHideMenuBar: true,
		minimizable: false,
		backgroundColor: '#000000',
		// backgroundColor: dark ? '#000000' : '#ffffff', // Color while loading
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: true,
			preload: fileURLToPath(new URL('./settings-preload.mjs', import.meta.url)),
		},
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

	settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
		// config.fileProtocol is my custom file protocol
		if (url.startsWith('file://') || url.startsWith('http://localhost')) {
			return { action: 'allow' }
		}
		// open url in a browser and prevent default
		shell.openExternal(url)
		return { action: 'deny' }
	})

	settingsWindow.on('closed', () => {
		settingsWindow = null
	})
}
