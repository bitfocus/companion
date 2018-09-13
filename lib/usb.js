// We have a lot of problems with USB in electron, so this
// is a workaround of that.
var cp = require('child_process');
var path = require('path');
var debug = require('debug')('lib/usb');
var shortid = require('shortid');

let child = null

var devices = {};

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
		else if (data.cmd == 'system') {
			system.emit.apply(system, data.args);
		}
  });
}

usb.prototype.begin = function() {
	var self = this;
	var args = [].slice.call(arguments);

	self.child.send({ cmd: 'execute', function: 'begin', args: args, id: self.id });
};

usb.prototype.draw = function() {
	var self = this;
	var args = [].slice.call(arguments);

	self.child.send({ cmd: 'execute', function: 'draw', args: args, id: self.id });
};

usb.prototype.quit = function() {
	var self = this;

	self.child.send({ cmd: 'execute', function: 'quit', args: [], id: self.id });

	setTimeout(function () {
		self.child.kill();
	}, 2000);
};

exports = module.exports = usb;
