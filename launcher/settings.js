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

	// const dark = nativeTheme.shouldUseDarkColors

	settingsWindow = new BrowserWindow({
		parent: parentWindow ?? undefined,
		// modal: true, // Can't use modal, as then window decoration disappears on mac
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

	void loadLauncherUiPage(settingsWindow, 'index.html')

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
