// @ts-check
import path from 'path'
import url, { fileURLToPath } from 'url'
import fs from 'fs-extra'
import { init, getCurrentScope } from '@sentry/electron/main'
import systeminformation from 'systeminformation'
import Store from 'electron-store'
import electron, { ipcMain, app, BrowserWindow, dialog } from 'electron'
import { nanoid } from 'nanoid'
import stripAnsi from 'strip-ansi'
import chokidar from 'chokidar'
import debounceFn from 'debounce-fn'
import fileStreamRotator from 'file-stream-rotator'
import { ConfigReleaseDirs } from '@companion-app/shared/Paths.js'
import { RespawnMonitor } from '@companion-app/shared/Respawn.js'

// Electron works on older versions of macos than nodejs, we should give a proper warning if we know companion will get stuck in a crash loop
if (process.platform === 'darwin') {
	try {
		const plist = require('plist')
		const semver = require('semver')

		const minimumVersion = '11.0'
		const supportedVersions = new semver.Range(`>=${minimumVersion}`)

		/** @type {any} */
		const versionInfo = plist.parse(fs.readFileSync('/System/Library/CoreServices/SystemVersion.plist', 'utf8'))
		const productVersion = semver.coerce(versionInfo.ProductVersion)

		if (productVersion && !supportedVersions.test(productVersion)) {
			electron.dialog.showErrorBox(
				'Unsupported macOS',
				`Companion is not supported on macOS ${productVersion}, you must be running at least ${minimumVersion}`
			)
			app.quit()
		}
	} catch (e) {
		// We can't figure out if its compatible, so assume it is
	}
}

// Ensure there isn't another instance of companion running already
const lock = app.requestSingleInstanceLock()
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

	// Remove the old log file
	try {
		const oldLogFile = path.join(configDir, 'companion.log')
		if (fs.existsSync(oldLogFile)) {
			fs.removeSync(oldLogFile)
		}
	} catch (e) {
		// Ignore
	}

	// Setup a simple logging method
	const logsDir = path.join(configDir, 'logs')
	const logStream = fileStreamRotator.getStream({
		filename: path.join(logsDir, 'companion-%DATE%'),
		extension: '.log',
		frequency: 'daily',
		date_format: 'YYYY-MM-DD',
		size: '100m',
		max_logs: '7d',
		audit_file: path.join(logsDir, 'audit.json'),
		end_stream: true,
	})
	logStream.on('error', (e) => {
		console.log('Error writing log:', e)
	})

	function customLog(line, prefix) {
		line = stripAnsi(line.trim())
		if (prefix) line = `${new Date().toISOString()} ${prefix}: ${line}`

		logStream.write(line + '\n')
		console.log(line)
	}

	// Use stored value
	let machineId = nanoid()
	const machineIdPath = path.join(configDir, 'machid')
	if (fs.pathExistsSync(machineIdPath)) {
		try {
			machineId = fs.readFileSync(machineIdPath).toString().trim() || machineId
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

	const thisDbFolderName = ConfigReleaseDirs[ConfigReleaseDirs.length - 1]
	const thisDbPath = path.join(configDir, thisDbFolderName, 'db.sqlite')

	const uiConfig = new Store({
		cwd: configDir,
		clearInvalidConfig: true,
		defaults: configDefaults,
	})

	let sentryDsn
	try {
		sentryDsn = fs
			.readFileSync(new URL('/SENTRY', import.meta.url))
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
		companionRootPath = fileURLToPath(new URL('../companion/dist', import.meta.url))
		// }
	}

	/**
	 * @type {{
	 *   appVersion: string
	 *   appStatus: string
	 *   appURL: string
	 *   appLaunch: string | null
	 * }}
	 */
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
				// if (event.exception) {
				// 	showReportDialog()
				// }
				return event
			},
		})

		try {
			const scope = getCurrentScope()
			scope.setUser({ id: machineId })
			scope.setExtra('build', appInfo.appVersion)
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

	/** @type {electron.BrowserWindow | null} */
	let window
	/** @type {electron.Tray | null} */
	let tray = null

	const cachedDebounces = {}

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

	let restartCounter = 0

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

				const newPath0 = uiConfig.get('dev_modules_path')
				if (newPath0 && (await fs.pathExists(newPath0))) {
					// Watch for changes in the modules
					const devModulesPath = path.resolve(newPath0)
					watcher = chokidar.watch(['**/*.mjs', '**/*.js', '**/*.cjs', '**/*.json'], {
						cwd: devModulesPath,
						ignoreInitial: true,
						ignored: ['**/node_modules/**'],
					})

					watcher.on('error', (error) => {
						customLog(`Watcher error: ${error}`, 'Application')
					})

					watcher.on('all', (event, filename) => {
						const moduleDirName = filename.split(path.sep)[0]

						let fn = cachedDebounces[moduleDirName]
						if (!fn) {
							// Debounce, to avoid spamming when many files change
							fn = debounceFn(
								() => {
									console.log('Sending reload for module:', moduleDirName)
									if (child?.child) {
										child.child.send({
											messageType: 'reload-extra-module',
											fullpath: path.join(devModulesPath, moduleDirName),
										})
									}
								},
								{
									after: true,
									before: false,
									wait: 100,
								}
							)
							cachedDebounces[moduleDirName] = fn
						}
						fn()
					})
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
		const thisWindow = (window = new BrowserWindow({
			show: false,
			width: 400,
			height: 600,
			//minHeight: 600,
			minWidth: 440,
			// maxHeight: 380,
			frame: false,
			resizable: false,
			icon: fileURLToPath(new URL('./assets/icon.png', import.meta.url)),
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: true,
				preload: fileURLToPath(new URL('./window-preload.mjs', import.meta.url)),
			},
		}))
		console.log('preload', fileURLToPath(new URL('./window-preload.js', import.meta.url)))

		// window.webContents.openDevTools({
		// 	mode:'detach'
		// })

		app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
			// Someone tried to run a second instance, we should focus our window.
			if (window) {
				showWindow()
			}
		})

		thisWindow
			.loadURL(
				url.format({
					pathname: fileURLToPath(new URL('./window.html', import.meta.url)),
					protocol: 'file:',
					slashes: true,
				})
			)
			.then(() => {
				thisWindow.webContents.setBackgroundThrottling(false)
			})

		let width = 0
		ipcMain.on('setHeight', (e, height) => {
			// console.log('height', height)

			// Cache the width, otherwise it can keep on growing unexpectedly on some machines
			if (width === 0) {
				const oldSize = thisWindow.getSize()
				width = oldSize[0]
			}

			thisWindow.setBounds({ width: width, height: height })
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
			thisWindow.hide()
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
			const newPort = Number(msg)
			if (isNaN(newPort) || newPort < 1024 || newPort > 65535) {
				electron.dialog
					.showMessageBox(thisWindow, {
						type: 'warning',
						message: 'Port must be between 1024 and 65535',
					})
					.catch(() => null)
				return
			}

			console.log('changed bind port:', newPort)
			uiConfig.set('http_port', newPort)

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

			// This isn't a usual restart, so pretend it didn't happen
			restartCounter = 0

			sendAppInfo()
			triggerRestart()
			restartWatcher()
		})

		ipcMain.on('pick-developer-modules-path', () => {
			console.log('pick dev modules path')
			electron.dialog
				.showOpenDialog(thisWindow, {
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

				if (Array.isArray(list)) {
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

		window.on('close', (e) => {
			e.preventDefault()

			performQuit()
		})
	}

	function createTray() {
		tray = new electron.Tray(
			process.platform == 'darwin'
				? fileURLToPath(new URL('./assets/trayTemplate.png', import.meta.url))
				: fileURLToPath(new URL('./assets/icon.png', import.meta.url))
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
			.showMessageBox({
				title: 'Companion',
				message: 'Are you sure you want to quit Companion?',
				buttons: ['Quit', 'Cancel'],
			})
			.then((v) => {
				if (v.response === 0) {
					performQuit()
				}
			})
	}

	function performQuit() {
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

	function scanUsb() {
		if (child && child.child) {
			child.child.send({
				messageType: 'scan-usb',
			})
		}
	}

	function showConfigFolder() {
		try {
			electron.shell.showItemInFolder(thisDbPath)
		} catch (e) {
			electron.dialog.showErrorBox('File Error', 'Could not open config directory.')
		}
	}

	function toggleWindow() {
		if (!window) return
		if (window.isVisible()) {
			window.hide()
		} else {
			showWindow()
		}
	}

	function showWindow() {
		if (!window) return
		window.show()
		window.focus()
	}

	app
		.whenReady()
		.then(async () => {
			// Check for a more recently modified db
			const dirs = fs.readdirSync(configDir)
			/** @type {[number, string] | null} */
			let mostRecentDir = null
			for (const dirname of dirs) {
				try {
					const dbStat = fs.statSync(path.join(configDir, dirname, 'db.sqlite'))
					if (dirname.match('^v(.*)') && dbStat && dbStat.isFile()) {
						if (!mostRecentDir || mostRecentDir[0] < dbStat.mtimeMs) {
							mostRecentDir = [dbStat.mtimeMs, dirname]
						}
					}
				} catch (e) {
					// Not worth considering
				}
			}

			if (mostRecentDir && mostRecentDir[1] !== thisDbFolderName) {
				let selected
				// Check for a new db file
				if (fs.existsSync(thisDbPath)) {
					selected = electron.dialog.showMessageBoxSync({
						title: 'Config version mismatch',
						message:
							`Another version of Companion (${mostRecentDir[1]}) has been run more recently.\n` +
							`Any config changes you have made to that version will not be loaded, but will return when you next open the other version.\n\n` +
							`Do you wish to continue?`,
						type: 'question',
						buttons: ['Continue', 'Exit'],
						defaultId: 0,
					})
				} else {
					if (!ConfigReleaseDirs.includes(mostRecentDir[1])) {
						// Figure out what version the upgrade will be from
						let importFrom = null
						for (let i = ConfigReleaseDirs.length - 2; i--; i > 0) {
							const dirname = ConfigReleaseDirs[i]
							if (
								dirname &&
								(fs.existsSync(path.join(configDir, dirname, 'db')) ||
									fs.existsSync(path.join(configDir, dirname, 'db.sqlite')))
							) {
								importFrom = dirname
								break
							}
						}
						if (!importFrom && fs.existsSync(path.join(configDir, 'db'))) {
							importFrom = 'v2.4'
						}
						const importNote = importFrom
							? `This will import the configuration from ${importFrom}`
							: `This will create an empty configuration`

						// It looks like a newer version has been opened
						selected = electron.dialog.showMessageBoxSync({
							title: 'Config version mismatch',
							message:
								`Another version of Companion (${mostRecentDir[1]}) has been run more recently.\n` +
								`Any config changes you have made to that version will not be loaded, but will return when you next open the other version.\n\n` +
								`Do you wish to continue? ${importNote}`,
							type: 'question',
							buttons: ['Continue', 'Exit'],
							defaultId: 0,
						})
					}
				}

				if (selected == 1) {
					app.exit(1)
				} else if (fs.existsSync(thisDbPath)) {
					// Mark the current config as most recently modified
					try {
						fs.utimesSync(thisDbPath, new Date(), new Date())
					} catch (_e) {
						// Ignore
					}
				}
			}

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

			let isLocked = false
			electron.powerMonitor.on('lock-screen', () => {
				isLocked = true
				if (child && child.child) {
					child.child.send({
						messageType: 'lock-screen',
						status: true,
					})
				}
			})
			electron.powerMonitor.on('unlock-screen', () => {
				isLocked = false
				if (child && child.child) {
					child.child.send({
						messageType: 'lock-screen',
						status: false,
					})
				}
			})

			let crashTimeout = null

			// Find the node binary
			const nodejsBasePath = path.join(companionRootPath, 'node-runtimes', 'node22')
			const nodeBinPath = [
				path.join(nodejsBasePath, 'bin/node'),
				path.join(nodejsBasePath, 'node'),
				path.join(nodejsBasePath, 'node.exe'),
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

			let disableAdminPassword = false
			const args = process.argv

			args.forEach((value, index) => {
				if (value == '--disable-admin-password') {
					disableAdminPassword = true
				}
			})

			child = new RespawnMonitor(
				// @ts-ignore
				() =>
					[
						// Build a new command string for each start
						nodeBin,
						path.join(companionRootPath, 'main.js'),
						`--machine-id=${machineId}`,
						`--config-dir=${configDir}`,
						`--admin-port=${uiConfig.get('http_port')}`,
						`--admin-address=${uiConfig.get('bind_ip')}`,
						uiConfig.get('enable_developer') ? `--extra-module-path=${uiConfig.get('dev_modules_path')}` : undefined,
						disableAdminPassword || process.env.DISABLE_ADMIN_PASSWORD ? `--disable-admin-password` : undefined,
					].filter((v) => !!v),
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

				if (isLocked) {
					child.child.send({
						messageType: 'lock-screen',
						status: isLocked,
					})
				}
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
					restartCounter = 0
				}, 30000)
			})

			child.on('exit', (code) => {
				customLog(`Companion exited with code: ${code}`, 'Application')

				if (code === 0) return

				restartCounter++
				clearTimeout(crashTimeout)
				crashTimeout = null

				customLog(`Restart Count: ${restartCounter}`, 'Application')
				if (restartCounter > 3) {
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
			child.on('warn', (data) => {
				customLog(data.toString())
			})
			child.on('message', (/** @type {any} */ data) => {
				console.log('Received IPC message', data)
				if (data.messageType === 'fatal-error') {
					electron.dialog.showErrorBox(data.title, data.body)
					app.exit(1)
				} else if (data.messageType === 'show-error') {
					electron.dialog.showErrorBox(data.title, data.body)
				} else if (data.messageType === 'http-bind-status') {
					delete data.messageType
					appInfo = {
						...appInfo,
						...data,
					}

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
		.catch((e) => {
			electron.dialog.showErrorBox(
				'Startup error',
				`Companion encountered an error while starting: ${e?.message ?? e?.toString?.() ?? e}`
			)
			app.quit()
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
