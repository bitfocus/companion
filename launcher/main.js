const path = require('path')
const url = require('url')
const fs = require('fs-extra')
const { init, showReportDialog, configureScope } = require('@sentry/electron')
const systeminformation = require('systeminformation')
const Store = require('electron-store')
const { ipcMain, app, BrowserWindow } = require('electron')
const electron = require('electron')
const { nanoid } = require('nanoid')
const readPackage = require('read-pkg')
const respawn = require('respawn')

// Ensure there isn't another instance of companion running already
var lock = app.requestSingleInstanceLock()
if (!lock) {
	electron.dialog.showErrorBox(
		'Multiple instances',
		'Another instance is already running. Please close the other instance first.'
	)
	app.quit()
} else {
	let configDir = path.join(app.getPath('appData'), '/companion/')
	if (process.env.COMPANION_CONFIG_BASEDIR !== undefined) {
		configDir = process.env.COMPANION_CONFIG_BASEDIR
	}

	// Use stored value
	let machineId = nanoid()
	const machineIdPath = path.join(configDir, 'machid')
	if (fs.pathExistsSync(machineIdPath)) {
		let text = ''
		try {
			text = fs.readFileSync(machineIdPath)
			if (text) {
				machineId = text.toString()
			}
		} catch (e) {
			console.warn(`Error reading uuid-file: ${e}`)
		}
	} else {
		try {
			fs.writeFileSync(machineIdPath, machineId)
		} catch (e) {
			console.warn(`Error writing uuid-file: ${e}`)
		}
	}

	const configDefaults = {
		http_port: 8000,
		bind_ip: '127.0.0.1',
		start_minimised: false,
	}

	try {
		const oldConfigPath = path.join(configDir, 'config')
		if (fs.pathExistsSync(oldConfigPath)) {
			// Pre 3.0 config file exists, lets import the values
			const contentsBuf = fs.readFileSync(oldConfigPath)
			if (contentsBuf) {
				Object.assign(configDefaults, JSON.parse(contentsBuf.toString()))
			}
			fs.unlinkSync(oldConfigPath)
		}
	} catch (e) {
		// Ignore the failure, its not worth trying to handle
	}

	const uiConfig = new Store({
		cwd: configDir,
		clearInvalidConfig: true,
		defaults: configDefaults,
	})

	let sentryDsn
	try {
		sentryDsn = fs
			.readFileSync(__dirname + '/SENTRY')
			.toString()
			.trim()
	} catch (e) {
		console.log('Sentry DSN not located')
	}

	let companionRootPath = process.resourcesPath
	if (!app.isPackaged) {
		// // Try the dist folder above
		// companionRootPath = path.join(__dirname, '../dist')
		// if (!fs.pathExistsSync(path.join(companionRootPath, 'BUILD'))) {
		// Finally, use the unbuilt parent
		companionRootPath = path.join(__dirname, '..')
		// }
	}

	let appBuild
	try {
		appBuild = fs.readFileSync(path.join(companionRootPath, 'BUILD')).toString().trim()
	} catch (e) {
		electron.dialog.showErrorBox('Missing files', 'The companion installation is corrupt. Please reinstall')
		app.exit(1)
	}

	const pkgInfo = readPackage.sync()

	let appInfo = {
		appVersion: pkgInfo.version,
		appBuild: appBuild,

		appLaunch: '',
		appStatus: 'Unknown',
		appURL: 'Waiting for webserver..',
		appLaunch: null,
	}

	if (process.env.DEVELOPER === undefined && sentryDsn && sentryDsn.substring(0, 8) == 'https://') {
		console.log('Configuring sentry error reporting')
		init({
			dsn: sentryDsn,
			release: `companion@${appInfo.appBuild || appInfo.appVersion}`,
			beforeSend(event) {
				if (event.exception) {
					showReportDialog()
				}
				return event
			},
		})

		try {
			configureScope((scope) => {
				scope.setUser({ id: machineId })
				scope.setExtra('build', appInfo.appBuild)
			})
		} catch (e) {
			console.log('Error setting up sentry info: ', e)
		}
	} else {
		console.log('Sentry error reporting is disabled')
	}

	function sendAppInfo() {
		if (window) {
			window.webContents.send('info', uiConfig.store, appInfo)
		}
	}

	let child

	function rebindHttp() {
		const ip = uiConfig.get('bind_ip')
		const port = uiConfig.get('http_port')

		if (child) {
			child.child.send({
				messageType: 'http-rebind',
				ip,
				port,
			})
		}
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
			icon: path.join(__dirname, './assets/icon.png'),
			webPreferences: {
				pageVisibility: true,
				nodeIntegration: true,
				contextIsolation: true,
				preload: path.join(__dirname, './window-preload.js'),
			},
		})

		window
			.loadURL(
				url.format({
					pathname: path.join(__dirname, './window.html'),
					protocol: 'file:',
					slashes: true,
				})
			)
			.then(() => {
				window.webContents.setBackgroundThrottling(false)
			})

		ipcMain.on('info', () => {
			sendAppInfo()
		})

		ipcMain.on('launcher-close', () => {
			if (child) {
				child.child.send({
					messageType: 'exit',
				})
			}
		})

		ipcMain.on('launcher-minimize', () => {
			window.hide()
		})

		ipcMain.on('launcher-open-gui', () => {
			launchUI()
		})

		ipcMain.on('launcher-set-bind-ip', (e, msg) => {
			console.log('changed bind ip:', msg)
			uiConfig.set('bind_ip', msg)

			rebindHttp()
		})

		ipcMain.on('launcher-set-http-port', (e, msg) => {
			console.log('changed bind port:', msg)
			uiConfig.set('http_port', msg)

			rebindHttp()
		})

		ipcMain.on('launcher-set-start-minimised', (e, msg) => {
			console.log('changed start minimized:', msg)
			uiConfig.set('start_minimised', msg)
		})

		ipcMain.once('launcher-ready', () => {
			const ip = uiConfig.get('bind_ip')
			const port = uiConfig.get('http_port')

			const nodeBinPath = path.join(companionRootPath, 'node-runtime/bin/node')
			const nodeBin = app.isPackaged || fs.pathExistsSync(nodeBinPath) ? nodeBinPath : 'node'
			child = respawn(
				[
					nodeBin,
					path.join(companionRootPath, 'main.js'),
					`--machineId="${machineId}"`,
					`--config-dir="${configDir}"`,
					`--admin-port=${port}`,
					`--admin-addrss=${ip}`,
				],
				{
					name: `Companion process`,
					env: {
						COMPANION_IPC_PARENT: 1,
						// CONNECTION_ID: connectionId,
						// SOCKETIO_URL: `ws://localhost:${this.socketPort}`,
						// SOCKETIO_TOKEN: child.authToken,
						// MODULE_FILE: path.join(moduleInfo.basePath, moduleInfo.manifest.runtime.entrypoint),
						// MODULE_MANIFEST: path.join(moduleInfo.basePath, 'companion/manifest.json'),
					},
					maxRestarts: 0,
					sleep: 60000, // Don't auto-restart
					kill: 5000,
					cwd: companionRootPath,
					stdio: [null, null, null, 'ipc'],
				}
			)
			child.on('start', () => {
				console.log(`Companion process started`)
			})
			child.on('stop', () => {
				console.log(`Companion process stopped`)
			})
			child.on('crash', () => {
				console.log(`Companion process crashed`)
			})
			child.on('stdout', (data) => {
				console.log(`Companion process stdout: ${data.toString()}`)
			})
			child.on('stderr', (data) => {
				console.log(`Companion process stderr: ${data.toString()}`)
			})
			child.on('message', (data) => {
				console.log('Received IPC message', data)
				if (data.messageType === 'show-error') {
					electron.dialog.showErrorBox(data.title, data.body)
				} else if (data.messageType === 'http-bind-status') {
					appInfo = {
						...appInfo,
						...data,
					}
					delete appInfo.messageType

					sendAppInfo()
				} else if (data.messageType === 'exit') {
					if (data.restart) {
						// Do nothing, autorestart will kick in
					} else {
						// TODO registry
					}
				}
			})
			child.start()
		})

		ipcMain.on('network-interfaces:get', () => {
			systeminformation.networkInterfaces().then((list) => {
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

		window.on('closed', () => {
			window = null
		})

		window.on('ready-to-show', () => {
			if (!uiConfig.get('start_minimised')) {
				showWindow()
			}
		})
	}

	function createTray() {
		tray = new electron.Tray(
			process.platform == 'darwin'
				? path.join(__dirname, 'assets/trayTemplate.png')
				: path.join(__dirname, 'assets/icon.png')
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
				label: 'Show config folder',
				click: showConfigFolder,
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
					if (child) {
						child.child.send({
							messageType: 'exit',
							ip,
							port,
						})
					}
				}
			})
	}

	function scanUsb() {
		if (child) {
			child.child.send({
				messageType: 'scan-usb',
			})
		}
	}

	function showConfigFolder() {
		try {
			electron.shell.showItemInFolder(path.join(configDir, 'companion', 'db'))
		} catch (e) {
			electron.dialog.showErrorBox('File Error', 'Could not open config directory.')
		}
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

	app.whenReady().then(async () => {
		createTray()
		createWindow()

		electron.powerMonitor.on('suspend', () => {
			if (child) {
				child.child.send({
					messageType: 'power-status',
					status: 'suspend',
				})
			}
		})

		electron.powerMonitor.on('resume', () => {
			if (child) {
				child.child.send({
					messageType: 'power-status',
					status: 'resume',
				})
			}
		})

		electron.powerMonitor.on('on-ac', () => {
			if (child) {
				child.child.send({
					messageType: 'power-status',
					status: 'ac',
				})
			}
		})

		electron.powerMonitor.on('on-battery', () => {
			if (child) {
				child.child.send({
					messageType: 'power-status',
					status: 'battery',
				})
			}
		})
	})

	app.on('window-all-closed', () => {
		app.quit()
	})

	app.on('activate', () => {
		if (window === null) {
			createWindow()
		}
	})
}
