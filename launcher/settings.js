// @ts-check
import { fileURLToPath } from 'node:url'
import { BrowserWindow, shell } from 'electron'
import { loadLauncherUiPage } from './launcher-ui.js'

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

	const thisWindow = (settingsWindow = new BrowserWindow({
		// A child of the launcher, so it stays above it (on macOS it also moves with it). Not modal, as then the window
		// decoration disappears on mac
		parent: parentWindow ?? undefined,
		// A single column of settings cards, at the web UI's readable width
		width: 760,
		height: 760,
		minWidth: 560,
		minHeight: 480,
		// Shown once the page has loaded, so it opens already painted in the system theme
		show: false,
		autoHideMenuBar: true,
		minimizable: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: true,
			preload: fileURLToPath(new URL('./settings-preload.mjs', import.meta.url)),
		},
	}))

	// Never rejects: a failed load has already been reported, and the window is still shown
	void loadLauncherUiPage(thisWindow, 'index.html').then(() => {
		if (!thisWindow.isDestroyed()) thisWindow.show()
	})

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
