const path = require('path')
const url = require('url')
const fs = require('fs-extra')
const { init, showReportDialog, configureScope } = require('@sentry/electron')
const systeminformation = require('systeminformation')
const Store = require('electron-store')
const { ipcMain, app, BrowserWindow, dialog } = require('electron')
const electron = require('electron')
const { nanoid } = require('nanoid')
const respawn = require('respawn')
const stripAnsi = require('strip-ansi')
const chokidar = require('chokidar')
const debounceFn = require('debounce-fn')

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

	// Setup a simple logging method
	// TODO - this will loose some lines when exiting
	let logwriting = false
	let logbuffer = []
	setInterval(() => {
		if (logbuffer.length > 0 && !logwriting) {
			const writestring = logbuffer.join('\n')
			logbuffer = []
			logwriting = true
			fs.appendFile(path.join(configDir, 'companion.log'), writestring + '\n', function (err) {
				if (err) {
					console.log('log write error', err)
				}
				logwriting = false
			})
		}
	}, 1000)

	function customLog(line, prefix) {
		line = stripAnsi(line.trim())
		if (prefix) line = `${new Date().toISOString()} ${prefix}: ${line}`

		logbuffer.push(line)
		console.log(line)
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
			console.warn(`Error reading machid file: ${e}`)
		}
	} else {
		try {
			fs.writeFileSync(machineIdPath, machineId)
		} catch (e) {
			console.warn(`Error writing machid file: ${e}`)
		}
	}

	const configDefaults = {
		http_port: 8000,
		bind_ip: '127.0.0.1',
		start_minimised: false,

		enable_developer: false,
		dev_modules_path: '',
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

	let appInfo = {
		// The version number of the build was set to match the BUILD file
		appVersion: app.getVersion(),

		appStatus: 'Unknown',
		appURL: 'Waiting for webserver..',
		appLaunch: null,
	}

	if (app.isPackaged && sentryDsn && sentryDsn.substring(0, 8) == 'https://') {
		console.log('Configuring sentry error reporting')
		init({
			dsn: sentryDsn,
			release: `companion@${appInfo.appVersion}`,
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
				scope.setExtra('build', appInfo.appVersion)
			})
		} catch (e) {
			console.log('Error setting up sentry info: ', e)
		}
	} else {
		console.log('Sentry error reporting is disabled')
	}

	function sendAppInfo() {
		if (window) {
			const loginSettings = app.getLoginItemSettings()
			window.webContents.send(
				'info',
				{
					...uiConfig.store,
					run_at_login: loginSettings.openAtLogin,
				},
				appInfo,
				process.platform
			)
		}
	}

	let child

	function rebindHttp() {
		const ip = uiConfig.get('bind_ip')
		const port = uiConfig.get('http_port')

		if (child && child.child) {
			child.child.send({
				messageType: 'http-rebind',
				ip,
				port,
			})
		}
	}

	let window
	let tray = null

	const triggerRestart = debounceFn(
		() => {
			customLog('trigger companion restart', 'Application')

			child?.stop(() => child?.start())
		},
		{
			wait: 500,
			before: false,
			after: true,
		}
	)

	let watcher = null
	let pendingWatcher = null
	function restartWatcher() {
		if (pendingWatcher) return

		Promise.resolve().then(async () => {
			try {
				pendingWatcher = true
				try {
					// Stop the existing watcher
					await watcher?.close()
				} catch (e) {
					customLog(`Failed to stop watcher: ${e}`, 'Application')
				}

				// Check developer mode is enabled
				if (!uiConfig.get('enable_developer')) return

				const newPath = uiConfig.get('dev_modules_path')
				if (newPath && (await fs.pathExists(newPath))) {
					watcher = chokidar.watch(newPath, {
						ignoreInitial: true,
					})

					watcher.on('all', triggerRestart)
				}
			} catch (e) {
				customLog(`Failed to restart watcher: ${e}`, 'Application')
			} finally {
				pendingWatcher = false
			}
		})
	}
	restartWatcher()

	function createWindow() {
		window = new BrowserWindow({
			show: false,
			width: 400,
			height: 600,
			minHeight: 600,
			minWidth: 440,
			// maxHeight: 380,
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

		// window.webContents.openDevTools({
		// 	mode:'detach'
		// })

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

		ipcMain.on('setHeight', (e, height) => {
			// console.log('height', height)
			const oldSize = window.getSize()
			// window.setSize(oldSize[0], height, false)
			window.setBounds({ width: oldSize[0], height: height })
		})

		ipcMain.on('info', () => {
			sendAppInfo()
		})

		ipcMain.on('launcher-close', () => {
			if (child) {
				if (watcher) watcher.close().catch(() => console.error('Failed to stop'))

				child.shouldRestart = false
				if (child.child) {
					child.child.send({
						messageType: 'exit',
					})
				}
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

		ipcMain.on('launcher-set-run-at-login', (e, msg) => {
			console.log('changed run at login:', msg)

			app.setLoginItemSettings({
				openAtLogin: !!msg,
			})
		})

		ipcMain.on('toggle-developer-settings', (e, msg) => {
			console.log('toggle developer settings')
			uiConfig.set('enable_developer', !uiConfig.get('enable_developer'))

			sendAppInfo()
			triggerRestart()
			restartWatcher()
		})

		ipcMain.on('pick-developer-modules-path', () => {
			console.log('pick dev modules path')
			electron.dialog
				.showOpenDialog(window, {
					properties: ['openDirectory'],
				})
				.then((r) => {
					if (!r.canceled && r.filePaths.length > 0) {
						uiConfig.set('dev_modules_path', r.filePaths[0])

						sendAppInfo()
						triggerRestart()
						restartWatcher()
					}
				})
		})
		ipcMain.on('clear-developer-modules-path', () => {
			console.log('clear dev modules path')
			uiConfig.set('dev_modules_path', '')

			sendAppInfo()
			triggerRestart()
			restartWatcher()
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
					if (watcher) watcher.close().catch(() => console.error('Failed to stop'))

					if (child) {
						child.shouldRestart = false
						if (child.child) {
							child.child.send({
								messageType: 'exit',
							})
						}
					}
				}
			})
	}

	function scanUsb() {
		if (child && child.child) {
			child.child.send({
				messageType: 'scan-usb',
			})
		}
	}

	function showConfigFolder() {
		try {
			electron.shell.showItemInFolder(path.join(configDir, 'db'))
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
			if (child && child.child) {
				child.child.send({
					messageType: 'power-status',
					status: 'suspend',
				})
			}
		})

		electron.powerMonitor.on('resume', () => {
			if (child && child.child) {
				child.child.send({
					messageType: 'power-status',
					status: 'resume',
				})
			}
		})

		electron.powerMonitor.on('on-ac', () => {
			if (child && child.child) {
				child.child.send({
					messageType: 'power-status',
					status: 'ac',
				})
			}
		})

		electron.powerMonitor.on('on-battery', () => {
			if (child && child.child) {
				child.child.send({
					messageType: 'power-status',
					status: 'battery',
				})
			}
		})

		let crashCounter = 0
		let crashTimeout = null

		// Find the node binary
		const nodeBinPath = [
			path.join(companionRootPath, 'node-runtime/bin/node'),
			path.join(companionRootPath, 'node-runtime/node'),
			path.join(companionRootPath, 'node-runtime/node.exe'),
		]
		let nodeBin = null
		for (const p of nodeBinPath) {
			if (fs.pathExistsSync(p)) {
				nodeBin = p
				break
			}
		}
		if (!app.isPackaged && !nodeBin) nodeBin = 'node'

		if (!nodeBin) {
			dialog.showErrorBox('Unable to start', 'Failed to find binary to run')
			app.exit(11)
		}

		child = respawn(
			() => [
				// Build a new command string for each start
				nodeBin,
				path.join(companionRootPath, 'main.js'),
				`--machine-id=${machineId}`,
				`--config-dir=${configDir}`,
				`--admin-port=${uiConfig.get('http_port')}`,
				`--admin-address=${uiConfig.get('bind_ip')}`,
				uiConfig.get('enable_developer') ? `--extra-module-path=${uiConfig.get('dev_modules_path')}` : undefined,
			],
			{
				name: `Companion process`,
				env: {
					COMPANION_IPC_PARENT: 1,
				},
				maxRestarts: -1,
				sleep: 1000,
				kill: 5000,
				cwd: companionRootPath,
				stdio: [null, null, null, 'ipc'],
			}
		)
		child.on('start', () => {
			customLog(`Companion process started`, 'Application')
		})
		child.on('stop', () => {
			customLog(`Companion process stopped`, 'Application')

			appInfo = {
				...appInfo,

				appStatus: 'Unknown',
				appURL: 'Waiting for webserver..',
				appLaunch: null,
			}
			sendAppInfo()

			if (!child || !child.shouldRestart) {
				if (watcher) watcher.close().catch(() => console.error('Failed to stop'))

				app.exit()
			} else {
				child.start()
			}
		})

		child.on('spawn', () => {
			if (crashTimeout) clearTimeout(crashTimeout)
			crashTimeout = setTimeout(() => {
				crashTimeout = null
				customLog('Companion looks to be stable', 'Application')
				crashCounter = 0
			}, 5000)
		})

		child.on('exit', (code) => {
			if (code === 0) return

			crashCounter++
			clearTimeout(crashTimeout)
			crashTimeout = null

			customLog(`Crashes: ${crashCounter}`, 'Application')
			if (crashCounter > 3) {
				child.stop()
				dialog.showErrorBox('Unable to start', 'Companion is unable to start')
				app.exit(1)
			}
		})

		child.on('stdout', (data) => {
			customLog(data.toString())
		})
		child.on('stderr', (data) => {
			customLog(data.toString())
		})
		child.on('message', (data) => {
			console.log('Received IPC message', data)
			if (data.messageType === 'fatal-error') {
				electron.dialog.showErrorBox(data.title, data.body)
				app.exit(1)
			} else if (data.messageType === 'show-error') {
				electron.dialog.showErrorBox(data.title, data.body)
			} else if (data.messageType === 'http-bind-status') {
				appInfo = {
					...appInfo,
					...data,
				}
				delete appInfo.messageType

				sendAppInfo()
			} else if (data.messageType === 'exit') {
				if (watcher) watcher.close().catch(() => customLog('Failed to stop', 'Application'))

				if (data.restart) {
					// Do nothing, autorestart will kick in
					if (child) child.shouldRestart = true
				} else {
					// Exit
					if (child) child.shouldRestart = false
				}
			}
		})
		child.start()
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
