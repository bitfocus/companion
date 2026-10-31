// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { app, dialog } from 'electron'

const DEV_SERVER_URL = 'http://localhost:5177'
const DEV_BUILD_DIR = fileURLToPath(new URL('../launcher-ui/build', import.meta.url))

/**
 * Load a page of the launcher-ui package.
 * Packaged builds load it from the resources folder. In development it comes from the launcher-ui vite dev server,
 * falling back to a local `yarn workspace @companion-app/launcher-ui build` when that is not running.
 * @param {import('electron').BrowserWindow} window
 * @param {string} page - html file name, eg `launcher.html`
 * @returns {Promise<void>}
 */
export async function loadLauncherUiPage(window, page) {
	if (app.isPackaged) {
		await loadOrReport(window, pathToFileURL(path.join(process.resourcesPath, 'settings-ui', page)).href, page)
		return
	}

	try {
		await window.loadURL(`${DEV_SERVER_URL}/${page}`)
		return
	} catch (err) {
		console.warn(`launcher-ui dev server not available for ${page}:`, err)
	}

	const builtPage = path.join(DEV_BUILD_DIR, page)
	if (fs.existsSync(builtPage)) {
		await loadOrReport(window, pathToFileURL(builtPage).href, page)
	} else {
		dialog.showErrorBox(
			'Error',
			`Failed to load ${page}. Start the launcher-ui dev server with \`yarn workspace @companion-app/launcher-ui dev\`, or build it once with \`yarn workspace @companion-app/launcher-ui build\`.`
		)
	}
}

/**
 * @param {import('electron').BrowserWindow} window
 * @param {string} pageUrl
 * @param {string} page
 */
async function loadOrReport(window, pageUrl, page) {
	try {
		await window.loadURL(pageUrl)
	} catch (err) {
		console.error(`Failed to load ${page}:`, err)
		dialog.showErrorBox('Error', `Failed to load ${page}.`)
	}
}
