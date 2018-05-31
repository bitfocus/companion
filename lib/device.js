var system;
var Image = require('./drawbuf');
var debug = require('debug')('device');
var i     = new Image(1,1); // TODO: export the .rgb function
var graphics;

var bank_map = {};
var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);
for (var num in b) {
	bank_map[parseInt(b[num])] = parseInt(num)+1;
}

var debug   = require('debug')('lib/device');

function device(_system, panel) {
	var self = this;

	debug('loading for ' + panel.devicepath);

	system = _system;
	self.panel = panel;
	self.devicepath = panel.devicepath;
	self.page = 1;
	self.config = {};

	graphics = require('./graphics')(system);

	self.on_bank_invalidated = function (page, bank) {
		self.updateBank(page, bank);
	};
	system.on('graphics_bank_invalidated', self.on_bank_invalidated);

	self.on_ready = function() {
		self.on_bank_update();
	};
	system.on('ready', self.on_ready);

	self.on_elgato_ready = function(devicepath) {
		if (devicepath == self.devicepath) {
			self.drawPage();
		}
	};
	system.on('elgato_ready',self.on_elgato_ready);

	self.on_elgato_click = function(devicepath, key, state, obj) {
		if (devicepath != self.devicepath) {
			return;
		}

		if (state == true) {

			if (key == 0) {
				self.page++;
				if (self.page == 100) { self.page = 1; }
				self.updatePagedevice();
				self.page_up_timer = setInterval(function() {
					if (self.page+5 < 100) {
						self.page += 5;
						self.updatePagedevice();
					}
				}, 400);
			}

			if (key == 10) {
				self.page--;
				if (self.page == 0) { self.page = 99; }
				self.updatePagedevice();
				self.page_down_timer = setInterval(function() {
					if (self.page-5 > 1) {
						self.page -= 5;
						self.updatePagedevice();
					}
				}, 400);
			}

			if (bank_map[key] !== undefined) {
				system.emit('bank-pressed', self.page, bank_map[key]);
				system.emit('skeleton-log', 'Page '+self.page+' Bank ' + bank_map[key] + ' pressed');
			}

		}

		else {
			if (self.page_up_timer !== undefined) clearTimeout(self.page_up_timer);
			if (self.page_down_timer !== undefined) clearTimeout(self.page_down_timer);
		}
	};
	system.on('elgato_click', self.on_elgato_click);

	if (self.panel.type == 'Elgato Streamdeck device') {
		system.emit('skeleton-log', 'A Elgato Streamdeck was connected');
	}

	system.emit('request-bank-update');
}

device.prototype.updatePagedevice = function(arguments) {
	var self = this;

	self.drawPage();
};

device.prototype.drawPage = function() {
	var self = this;

	self.data = graphics.getImagesForPage(self.page);

	for (var i in self.data) {
		self.panel.draw(i, self.data[i].buffer);
	}
};

device.prototype.updateBank = function(page, bank) {
	var self = this;

	var img = graphics.getBank(page, bank);

	if (page == self.page) {
		setImmediate(function () {
			self.panel.draw(b[bank-1], img.buffer);
		});
	}
};

device.prototype.unload = function () {
	var self = this;

	if (self.panel.type == 'Elgato Streamdeck device') {
		system.emit('skeleton-log', 'A Elgato Streamdeck was disconnected');
	}
	debug('unloading for ' +  self.devicepath);
	system.removeListener('graphics_bank_invalidated', self.on_bank_invalidated);
	system.removeListener('ready', self.on_ready);
	system.removeListener('elgato_ready',self.on_elgato_ready);
	system.removeListener('elgato_click', self.on_elgato_click);
	self.panel.device = undefined;
};


device.prototype.quit = function () {
	this.unload();
};

exports = module.exports = function (system, panel) {
	return new device(system, panel);
};
