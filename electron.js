var electron = require('electron')
const { ipcMain } = require('electron')
var app = electron.app
var BrowserWindow = electron.BrowserWindow
var path = require('path')
var url = require('url')
var Registry = require('./lib/Registry.js')
var fs = require('fs-extra')
const { init, showReportDialog, configureScope } = require('@sentry/electron')
const systeminformation = require('systeminformation')
const Store = require('electron-store')
const pkgInfo = require('./package.json')

// Ensure there isn't another instance of companion running already
var lock = app.requestSingleInstanceLock()
if (!lock) {
	electron.dialog.showErrorBox(
		'Multiple instances',
		'Another instance is already running. Please close the other instance first.'
	)
	app.quit()
	return
}

let configDir = app.getPath('appData')
if (process.env.COMPANION_CONFIG_BASEDIR !== undefined) {
	configDir = process.env.COMPANION_CONFIG_BASEDIR
}

const configDefaults = {
	http_port: 8000,
	bind_ip: '127.0.0.1',
	start_minimised: false,
}

;(async () => {
	const fullConfigDir = path.join(configDir, '/companion/')

	try {
		const oldConfigPath = path.join(fullConfigDir, 'config')
		if (await fs.pathExists(oldConfigPath)) {
			// Pre 3.0 config file exists, lets import the values
			const contentsBuf = await fs.readFile(oldConfigPath)
			if (contentsBuf) {
				Object.assign(configDefaults, JSON.parse(contentsBuf.toString()))
			}
			await fs.unlink(oldConfigPath)
		}
	} catch (e) {
		// Ignore the failure, its not worth trying to handle
	}

	const uiConfig = new Store({
		cwd: fullConfigDir,
		clearInvalidConfig: true,
		defaults: configDefaults,
	})

	const registry = await Registry.create(configDir)

	let appInfo = {
		appVersion: registry.appVersion,
		appBuild: registry.appBuild,
		appName: pkgInfo.description,

		appStatus: 'Unknown',
		appURL: 'Waiting for webserver..',
		appLaunch: null,
	}

	function sendAppInfo() {
		if (window) {
			window.webContents.send('info', uiConfig.store, appInfo)
		}
	}

	registry.system.on('http-bind-status', (status) => {
		appInfo = {
			...appInfo,
			...status,
		}

		sendAppInfo()
	})

	if (process.env.DEVELOPER === undefined) {
		console.log('Configuring sentry error reporting')
		init({
			dsn: 'https://535745b2e446442ab024d1c93a349154@sentry.bitfocus.io/8',
			release: `companion@${registry.appBuild || registry.appVersion}`,
			beforeSend(event) {
				if (event.exception) {
					showReportDialog()
				}
				return event
			},
		})
	} else {
		console.log('Sentry error reporting is disabled')
	}

	function rebindHttp() {
		const ip = uiConfig.get('bind_ip')
		const port = uiConfig.get('http_port')

		registry.rebindHttp(ip, port)
	}

	var window
	var tray = null

	function createWindow() {
		window = new BrowserWindow({
			show: false,
			width: 400,
			height: 470,
			minHeight: 600,
			minWidth: 440,
			maxHeight: 380,
			frame: false,
			resizable: false,
			icon: path.join(__dirname, 'assets/icon.png'),
			webPreferences: {
				pageVisibility: true,
				nodeIntegration: true,
				contextIsolation: true,
				preload: path.join(__dirname, 'window-preload.js'),
			},
		})

		window
			.loadURL(
				url.format({
					pathname: path.join(__dirname, 'window.html'),
					protocol: 'file:',
					slashes: true,
				})
			)
			.then(() => {
				window.webContents.setBackgroundThrottling(false)
			})

		ipcMain.on('info', function () {
			sendAppInfo()
		})

		ipcMain.on('launcher-close', function (req, cb) {
			registry.emit('exit')
		})

		ipcMain.on('launcher-minimize', function (req, cb) {
			window.hide()
		})

		ipcMain.on('launcher-open-gui', function () {
			launchUI()
		})

		ipcMain.on('launcher-set-bind-ip', function (e, msg) {
			console.log('changed bind ip:', msg)
			uiConfig.set('bind_ip', msg)

			rebindHttp()
		})

		ipcMain.on('launcher-set-http-port', function (e, msg) {
			console.log('changed bind port:', msg)
			uiConfig.set('http_port', msg)

			rebindHttp()
		})

		ipcMain.on('launcher-set-start-minimised', function (e, msg) {
			console.log('changed start minimized:', msg)
			uiConfig.set('start_minimised', msg)
		})

		ipcMain.once('launcher-ready', function () {
			const ip = uiConfig.get('bind_ip')
			const port = uiConfig.get('http_port')

			registry.ready(ip, port, !process.env.DEVELOPER).catch((e) => {
				console.log('Failed to init')
				process.exit(1)
			})
		})

		ipcMain.on('network-interfaces:get', function () {
			systeminformation.networkInterfaces().then(function (list) {
				const interfaces = [
					{ id: '0.0.0.0', label: 'All Interfaces: 0.0.0.0' },
					{ id: '127.0.0.1', label: 'localhost: 127.0.0.1' },
				]

				for (const obj of list) {
					if (obj.ip4 && !obj.internal) {
						let label = `${obj.iface}: ${obj.ip4}`
						if (obj.type && obj.type !== 'unknown') label += ` (${obj.type})`

						interfaces.push({
							id: obj.ip4,
							label: label,
						})
					}
				}

				if (window) {
					window.webContents.send('network-interfaces:get', interfaces)
				}
			})
		})

		registry.on('restart', function () {
			app.relaunch()
			app.exit()
		})

		window.on('closed', function () {
			window = null
		})

		window.on('ready-to-show', function () {
			if (!uiConfig.get('start_minimised')) {
				showWindow()
			}
		})

		try {
			configureScope(function (scope) {
				scope.setUser({ id: registry.machineId })
				scope.setExtra('build', registry.appBuild)
			})
		} catch (e) {
			console.log('Error reading BUILD and/or package info: ', e)
		}
	}

	function createTray() {
		tray = new electron.Tray(
			process.platform == 'darwin'
				? path.join(__dirname, 'assets', 'trayTemplate.png')
				: path.join(__dirname, 'assets', 'icon.png')
		)
		tray.setIgnoreDoubleClickEvents(true)
		if (process.platform !== 'darwin') {
			tray.on('click', toggleWindow)
		}

		const menu = new electron.Menu()
		menu.append(
			new electron.MenuItem({
				label: 'Show/Hide window',
				click: toggleWindow,
			})
		)
		menu.append(
			new electron.MenuItem({
				label: 'Launch GUI',
				click: launchUI,
			})
		)
		menu.append(
			new electron.MenuItem({
				label: 'Scan USB Devices',
				click: scanUsb,
			})
		)
		menu.append(
			new electron.MenuItem({
				label: 'Quit',
				click: trayQuit,
			})
		)
		tray.setContextMenu(menu)
	}

	function launchUI() {
		if (appInfo.appLaunch && appInfo.appLaunch.match(/http/)) {
			electron.shell.openExternal(appInfo.appLaunch).catch((e) => {
				// Ignore
			})
		}
	}

	function trayQuit() {
		electron.dialog
			.showMessageBox(undefined, {
				title: 'Companion',
				message: 'Are you sure you want to quit Companion?',
				buttons: ['Quit', 'Cancel'],
			})
			.then((v) => {
				if (v.response === 0) {
					registry.emit('exit')
				}
			})
	}

	function scanUsb() {
		registry.system.emit('devices_reenumerate')
	}

	function toggleWindow() {
		if (window.isVisible()) {
			window.hide()
		} else {
			showWindow()
		}
	}

	function showWindow() {
		window.show()
		window.focus()
	}

	app.whenReady().then(function () {
		createTray()
		createWindow()

		electron.powerMonitor.on('suspend', () => {
			registry.system.emit('launcher-power-status', 'suspend')
		})

		electron.powerMonitor.on('resume', () => {
			registry.system.emit('launcher-power-status', 'resume')
		})

		electron.powerMonitor.on('on-ac', () => {
			registry.system.emit('launcher-power-status', 'ac')
		})

		electron.powerMonitor.on('on-battery', () => {
			registry.system.emit('launcher-power-status', 'battery')
		})
	})

	app.on('window-all-closed', function () {
		app.quit()
	})

	app.on('activate', function () {
		if (window === null) {
			createWindow()
		}
	})
})()
