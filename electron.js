var electron = require('electron')
const { ipcMain } = require('electron')
var app = electron.app
var BrowserWindow = electron.BrowserWindow
var path = require('path')
var url = require('url')
var system = require('./app.js')
var fs = require('fs')
var exec = require('child_process').exec
const { init, showReportDialog, configureScope } = require('@sentry/electron')
var network = require('network')

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

let skeleton_info = {}
system.emit('skeleton-info-info', function (info) {
	// Assume this happens synchronously
	skeleton_info = info
})

if (process.env.DEVELOPER === undefined) {
	console.log('Configuring sentry error reporting')
	init({
		dsn: 'https://535745b2e446442ab024d1c93a349154@sentry.bitfocus.io/8',
		release: `companion@${skeleton_info.appBuild || skeleton_info.appVersion}`,
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
		if (window) {
			window.webContents.send('info', skeleton_info)
		}
	})

	ipcMain.on('skeleton-close', function (req, cb) {
		system.emit('exit')
	})

	ipcMain.on('skeleton-minimize', function (req, cb) {
		window.hide()
	})

	ipcMain.on('skeleton-launch-gui', function () {
		launchUI()
	})

	ipcMain.on('skeleton-bind-ip', function (e, msg) {
		console.log('changed bind ip:', msg)
		system.emit('skeleton-bind-ip', msg)
	})

	ipcMain.on('skeleton-bind-port', function (e, msg) {
		console.log('changed bind port:', msg)
		system.emit('skeleton-bind-port', msg)
	})

	ipcMain.on('skeleton-start-minimised', function (e, msg) {
		console.log('changed start minimized:', msg)
		system.emit('skeleton-start-minimised', msg)
	})

	ipcMain.once('skeleton-ready', function () {
		system.ready(!process.env.DEVELOPER)
	})

	ipcMain.on('network-interfaces:get', function () {
		network.get_interfaces_list(function (err, list) {
			const interfaces = [{ id: '127.0.0.1', label: 'localhost / 127.0.0.1' }]

			for (const obj of list) {
				if (obj.ip_address !== null) {
					interfaces.push({
						id: obj.ip_address,
						label: `${obj.name}: ${obj.ip_address} (${obj.type})`,
					})
				}
			}

			if (window) {
				window.webContents.send('network-interfaces:get', interfaces)
			}
		})
	})

	system.on('skeleton-ip-unavail', function () {})

	system.on('skeleton-info', function (key, val) {
		skeleton_info[key] = val
		if (window) {
			window.webContents.send('info', skeleton_info)
		}
	})

	system.on('restart', function () {
		app.relaunch()
		app.exit()
	})

	window.on('closed', function () {
		window = null
	})

	window.on('ready-to-show', function () {
		if (!skeleton_info.startMinimised) {
			showWindow()
		}
	})

	try {
		system.emit('skeleton-info', 'configDir', app.getPath('appData'))

		configureScope(function (scope) {
			var machidFile = app.getPath('appData') + '/companion/machid'
			var machid = fs.readFileSync(machidFile).toString().trim()
			scope.setUser({ id: machid })
			scope.setExtra('build', skeleton_info.appBuild)
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
	var isWin = process.platform == 'win32'
	var isMac = process.platform == 'darwin'
	var isLinux = process.platform == 'linux'

	if (skeleton_info.appURL.match(/http/)) {
		if (isWin) {
			exec('start ' + skeleton_info.appURL, function callback(error, stdout, stderr) {})
		} else if (isMac) {
			exec('open ' + skeleton_info.appURL, function callback(error, stdout, stderr) {})
		} else if (isLinux) {
			exec('xdg-open ' + skeleton_info.appURL, function callback(error, stdout, stderr) {})
		}
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
				system.emit('exit')
			}
		})
}

function scanUsb() {
	system.emit('devices_reenumerate')
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
		system.emit('skeleton-power', 'suspend')
	})

	electron.powerMonitor.on('resume', () => {
		system.emit('skeleton-power', 'resume')
	})

	electron.powerMonitor.on('on-ac', () => {
		system.emit('skeleton-power', 'ac')
	})

	electron.powerMonitor.on('on-battery', () => {
		system.emit('skeleton-power', 'battery')
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
