var electron = require('electron')
var RPC = require('electron-rpc/server')
var app = electron.app
var BrowserWindow = electron.BrowserWindow;
var path = require('path')
var url = require('url')
var main = require('./app.js');
var system = main();
var fs = require("fs");
var exec = require('child_process').exec;
const { init, showReportDialog, configureScope } = require('@sentry/electron');

function packageinfo() {
	var fileContents = fs.readFileSync(__dirname + '/package.json');
	var object = JSON.parse(fileContents);
	return object;
};

const buildNumber = fs.readFileSync(__dirname + "/BUILD").toString().trim();

if (process.env.DEVELOPER === undefined) {
	console.log('Configuring sentry error reporting')
	init({
		dsn: 'https://535745b2e446442ab024d1c93a349154@sentry.bitfocus.io/8',
		release: 'companion@' + ( buildNumber !== undefined ? buildNumber.trim() : packageinfo().version),
		beforeSend(event) {
			if (event.exception) {
				showReportDialog();
			}
			return event;
		}
	});
} else {
	console.log('Sentry error reporting is disabled')
}

var window;
var exiting = false;
var tray = null;

var skeleton_info = {
	appName: '',
	appBuild: '',
	appVersion: '',
	appURL: '',
	appStatus: '',
	configDir: app.getPath('appData'),
	startMinimised: '',
};


/* Module should return true if this application should be single instance only */
system.emit('skeleton-single-instance-only', function (response) {
	if (response === true) {
		if (app.requestSingleInstanceLock) { // new api
			var lock = app.requestSingleInstanceLock();
			if (!lock) {
				exiting = true;

				if (window !== undefined) {
					window.close();
				}
				electron.dialog.showErrorBox('Multiple instances', 'Another instance is already running. Please close the other instance first.');
				app.quit();
				return;
			}
		} else { // old api
			var nolock = app.makeSingleInstance(function () {});
			if (nolock) {
				exiting = true;

				if (window !== undefined) {
					window.close();
				}
				electron.dialog.showErrorBox('Multiple instances', 'Another instance is already running. Please close the other instance first.');
				app.quit();
				return;
			}
		}
	}
});

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
			nodeIntegration: true
		}
	});

	window.loadURL(url.format({
		pathname: path.join(__dirname, 'window.html'),
		protocol: 'file:',
		slashes: true
	}));

	window.webContents.setBackgroundThrottling(false)

	var rpc = new RPC();
	rpc.configure(window.webContents);

	rpc.on('info', function(req, cb) {
		cb(null, skeleton_info);
	});

	rpc.on('log', function(req, cb) {
		cb(null, "Started");
	});

	rpc.on('skeleton-close', function(req, cb) {
		system.emit('exit');
	});

	rpc.on('skeleton-minimize', function(req, cb) {
		window.hide();
	});

	rpc.on('skeleton-launch-gui', function () {
		launchUI()
	})

	rpc.on('skeleton-bind-ip', function(req, cb) {
		console.log("changed bind ip:",req.body)
		system.emit('skeleton-bind-ip', req.body);
	});

	rpc.on('skeleton-bind-port', function(req, cb) {
		console.log("changed bind port:",req.body)
		system.emit('skeleton-bind-port', req.body);
	});

	rpc.on('skeleton-start-minimised', function(req, cb) {
		console.log("changed start minimized:",req.body)
		system.emit('skeleton-start-minimised', req.body);
	});

	rpc.on('skeleton-ready', function(req, cb) {
		system.emit('skeleton-ready');
	});

	system.on('skeleton-ip-unavail', function() {
	});

	system.on('skeleton-info', function(key,val) {
		skeleton_info[key] = val;
		rpc.send('info', skeleton_info);
	});

	system.on('restart', function() {
		app.relaunch()
		app.exit()
	});

	system.on('skeleton-log', function(line) {
		rpc.send('log', line);
	});

	window.on('closed', function () {
		window = null
	});

	window.on('ready-to-show', function () {
		if (!skeleton_info.startMinimised) {
			showWindow();
		}
	});

	if (!exiting) {
		try {
			var pkg = packageinfo();
			system.emit('skeleton-info', 'appVersion', pkg.version );
			system.emit('skeleton-info', 'appBuild', buildNumber.trim() );
			system.emit('skeleton-info', 'appName', pkg.description);
			system.emit('skeleton-info', 'appStatus', 'Starting');
			system.emit('skeleton-info', 'configDir', app.getPath('appData') );
			
			configureScope(function(scope) {
				var machidFile = app.getPath('appData') + '/companion/machid'
				var machid = fs.readFileSync(machidFile).toString().trim()
				scope.setUser({"id": machid});
				scope.setExtra("build",buildNumber.trim());
			});
			

		} catch (e) {
			console.log("Error reading BUILD and/or package info: ", e);
		}
	}
}

function createTray() {
	tray = new electron.Tray(
		process.platform == "darwin" ?
		path.join(__dirname, 'assets', 'trayTemplate.png') :
		path.join(__dirname, 'assets', 'icon.png')
	);
	tray.setIgnoreDoubleClickEvents(true)
	if (process.platform !== "darwin") {
		tray.on('click', toggleWindow);
	}

	const menu = new electron.Menu()
	menu.append(new electron.MenuItem({
		label: 'Show/Hide window',
		click: toggleWindow,
	}))
	menu.append(new electron.MenuItem({
		label: 'Launch GUI',
		click: launchUI,
	}))
	menu.append(new electron.MenuItem({
		label: 'Scan USB Devices',
		click: scanUsb,
	}))
	menu.append(new electron.MenuItem({
		label: 'Quit',
		click: trayQuit,
	}))
	tray.setContextMenu(menu)
}

function launchUI() {
	var isWin = process.platform == 'win32';
	var isMac = process.platform == 'darwin';
	var isLinux = process.platform == 'linux';

	if (skeleton_info.appURL.match(/http/)) {
		if (isWin) {
			exec('start ' + skeleton_info.appURL, function callback(error, stdout, stderr){});
		} else if (isMac) {
			exec('open ' + skeleton_info.appURL, function callback(error, stdout, stderr){});
		} else if (isLinux) {
			exec('xdg-open ' + skeleton_info.appURL, function callback(error, stdout, stderr){});
		}
	}
}

function trayQuit() {
	electron.dialog.showMessageBox(undefined, {
		title: 'Companion',
		message: 'Are you sure you want to quit Companion?',
		buttons: ['Quit', 'Cancel']
	}).then((v) => {
		if (v.response === 0) {
			system.emit('exit');
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
	createTray();
	createWindow();

	electron.powerMonitor.on('suspend', () => {
		system.emit('skeleton-power', 'suspend');
	});

	electron.powerMonitor.on('resume', () => {
		system.emit('skeleton-power', 'resume');
	});

	electron.powerMonitor.on('on-ac', () => {
		system.emit('skeleton-power', 'ac');
	});

	electron.powerMonitor.on('on-battery', () => {
		system.emit('skeleton-power', 'battery');
	});

});

app.on('window-all-closed', function () {
	app.quit()
});

app.on('activate', function () {
	if (window === null) {
		createWindow();
	}
})
