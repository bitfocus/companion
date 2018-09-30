// We have a lot of problems with USB in electron, so this
// is a workaround of that.
var cp = require('child_process');
var path = require('path');
var debug = require('debug')('lib/usb');
var shortid = require('shortid');

let child = null

var devices = {};
var results = {};

function usb(system, type, devicepath, cb) {
	var self = this;
	self.id = shortid.generate();

	self.debug = require('debug')('lib/usb/' + type);

  // fork the child process
  var child = self.child = cp.fork(path.join(__dirname, 'usb/handler.js'), [], {
    stdio: 'inherit',
    env: {
      ELECTRON_RUN_AS_NODE: true,
    },
  });

	child.send({ id: self.id, cmd: 'add', type: type, devicepath: devicepath });

	child.on('message', function (data) {
		if (data.cmd == 'add') {
			debug('module added successfully', data.id);
			cb();
		}
		else if (data.cmd == 'debug') {
			self.debug.apply(self.debug, data.args);
		}
		else if (data.cmd == 'publish') {
			debug('got local variables from module');
			for (var key in data.info) {
				self[key] = data.info[key];
			}
		}
		else if (data.cmd == 'error') {
			debug('Error from usb module ' + type + ': ' + data.error + " (id: " + data.id + " / " + self.id + ")");
		}
		else if (data.cmd == 'return') {
			if (typeof results[data.returnId] == 'function') {
				results[data.returnId](data.result);
				delete results[data.returnId];
			}
		}
		else if (data.cmd == 'system') {
			system.emit.apply(system, data.args);
		}
  });
}

usb.prototype._execute = function(func, args, cb) {
	var self = this;
	var returnId;

	if (typeof cb == 'function') {
		returnId = shortid.generate();
		results[returnId] = cb;
	}

	self.child.send({ cmd: 'execute', function: func, args: args, id: self.id, returnId: returnId });
};

usb.prototype.begin = function() {
	var self = this;
	var args = [].slice.call(arguments);

	self._execute('begin', args);
};

usb.prototype.getConfig = function(cb) {
	var self = this;
	var args = [].slice.call(arguments);

	self._execute('getConfig', args, cb);
};

usb.prototype.setConfig = function() {
	var self = this;
	var args = [].slice.call(arguments);

	if (self.deviceHandler) {
		// Custom override, page should have been inside the deviceconfig object
		if (args[0].page !== undefined) {
			self.deviceHandler.page = args[0].page;
		}
	}

	self._execute('setConfig', args);

	if (self.deviceHandler) {
		self.deviceconfig = args[0];
		self.deviceHandler.updatedConfig();
	}
};

usb.prototype.draw = function() {
	var self = this;
	var args = [].slice.call(arguments);

	self._execute('draw', args);
};

usb.prototype.quit = function() {
	var self = this;

	self._execute('quit');

	setTimeout(function () {
		self.child.kill();
	}, 2000);
};

exports = module.exports = usb;
