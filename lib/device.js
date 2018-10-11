/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

var system;
var Image = require('./image');
var debug = require('debug')('lib/device');
var i     = new Image(1,1); // TODO: export the .rgb function
var graphics;

var bank_map = {};
var b = "1 2 3 4 6 7 8 9 11 12 13 14".split(/ /);
for (var num in b) {
	bank_map[parseInt(b[num])] = parseInt(num)+1;
}

var debug = require('debug')('lib/device');

function device(_system, panel) {
	var self = this;

	debug('loading for ' + panel.devicepath);

	system = _system;
	self.panel = panel;
	self.devicepath = panel.devicepath;
	self.page = 1;
	self.config = {};
	self.userconfig = {};
	self.deviceconfig = {};

	system.emit('db_get', 'deviceconfig', function(res) {
		if (res !== undefined && res !== null) {
			self.deviceconfig = res;
		} else {
			// Make sure we have a working reference
			self.deviceconfig = {};
			system.emit('db_set', 'deviceconfig', self.deviceconfig);
		}
	});

	if (self.panel !== undefined && self.deviceconfig[self.panel.serialnumber] !== undefined) {
		if (self.deviceconfig[self.panel.serialnumber].page !== undefined) {
			self.page = self.deviceconfig[self.panel.serialnumber].page;
		}

		var config = self.deviceconfig[self.panel.serialnumber].config;

		if (config !== undefined) {
			setImmediate(function () {
				self.panel.setConfig(config);
			});
		}
		debug('Device ' + self.panel.serialnumber + ' was on page ' + self.page);
	}

	// get userconfig object
	system.emit('get_userconfig', function(userconfig) {
		self.userconfig = userconfig;
	});

	graphics = new require('./graphics')(system);

	self.on_bank_invalidated = function (page, bank) {
		self.updateBank(page, bank);
	};

	system.on('graphics_bank_invalidated', self.on_bank_invalidated);

	self.on_graphics_page_controls_invalidated = function () {
		self.updateControls();
	};
	system.on('graphics_page_controls_invalidated', self.on_graphics_page_controls_invalidated);

	self.on_ready = function() {
		self.on_bank_update();
	};

	system.on('ready', self.on_ready);

	self.on_elgato_ready = function(devicepath) {
		if (devicepath == self.devicepath) {
			self.panel.begin();
			self.drawPage();
		}
	};

	system.on('device_redraw', function (id) {
		if (id == self.devicepath) {
			self.drawPage();
		}
	});

	system.on('elgato_ready',self.on_elgato_ready);

	system.on('device_set_page', function (deviceid, page) {
		if (self.panel.serialnumber == deviceid) {
			self.page = page;
			if (self.page == 100) { self.page = 1; }
			if (self.page == 0) { self.page = 99; }

			self.updatePagedevice();
		}
	});

	self.on_elgato_click = function(devicepath, key, state, obj) {
		if (devicepath != self.devicepath) {
			return;
		}

		if (state == true) {

			if (key == (self.userconfig.page_direction_flipped === true ? 10 : 0)) {
				self.page++;
				if (self.page == 100) { self.page = 1; }
				self.updatePagedevice();
			}

			if (key == (self.userconfig.page_direction_flipped === true ? 0 : 10)) {
				self.page--;
				if (self.page == 0) { self.page = 99; }
				self.updatePagedevice();
			}

			if (bank_map[key] !== undefined) {
				system.emit('bank-pressed', self.page, bank_map[key], true, self.panel.serialnumber);
				system.emit('log', 'device('+self.panel.serialnumber+')', 'debug', 'Button '+self.page+'.' + bank_map[key] + ' pressed');
			}

		}

		else {

			if (bank_map[key] !== undefined) {
				system.emit('bank-pressed', self.page, bank_map[key], false, self.panel.serialnumber);
				system.emit('log', 'device('+self.panel.serialnumber+')', 'debug', 'Button '+self.page+'.' + bank_map[key] + ' released');
			}

		}
	};
	system.on('elgato_click', self.on_elgato_click);

	if (self.panel.type != 'Elgato Streamdeck Emulator') {
		system.emit('skeleton-log', 'A ' + self.panel.type + ' was connected');
	}

	system.emit('request-bank-update');
}

device.prototype.updatePagedevice = function() {
	var self = this;

	if (self.deviceconfig[self.panel.serialnumber] == undefined) {
		self.deviceconfig[self.panel.serialnumber] = {};
	}
	self.deviceconfig[self.panel.serialnumber].page = self.page;
	system.emit('db_set', 'deviceconfig', self.deviceconfig);
	system.emit('db_save');

	self.drawPage();
};

device.prototype.updatedConfig = function () {
	var self = this;

	if (self.deviceconfig[self.panel.serialnumber] == undefined) {
		self.deviceconfig[self.panel.serialnumber] = {};
	}
	self.deviceconfig[self.panel.serialnumber].config = self.panel.deviceconfig;
	system.emit('db_set', 'deviceconfig', self.deviceconfig);
	system.emit('db_save');
};

device.prototype.updateControls = function() {
	var self = this;

	self.data = graphics.getImagesForPage(self.page);

	self.panel.draw(0, self.data[0].buffer);
	self.panel.draw(5, self.data[5].buffer);
	self.panel.draw(10, self.data[10].buffer);
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

	if (self.panel.type != 'Elgato Streamdeck Emulator') {
		system.emit('skeleton-log', 'A ' + self.panel.type + ' was disconnected');
	}
	system.emit('log', 'device('+self.panel.serialnumber+')', 'error', self.panel.type + ' disconnected');
	debug('unloading for ' +  self.devicepath);
	system.removeListener('graphics_bank_invalidated', self.on_bank_invalidated);
	system.removeListener('graphics_page_controls_invalidated', self.on_graphics_page_controls_invalidated);
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
