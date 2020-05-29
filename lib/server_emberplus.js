/*
 * This file is part of the Companion project
 * Copyright (c) 2020 Bitfocus AS
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

var debug = require('debug')('lib/server_emerplus');
var emberplus = require('node-emberplus');
var EmberServer = emberplus.EmberServer;
var ParameterType = emberplus.EmberLib.ParameterType;

function server_emerplus(system) {
	var self = this;

	self.system = system;
	self.pushed = {};

	system.emit('skeleton-info-info', function (info) {
		self.companion_info = info;
	});

	system.on('graphics_indicate_push', function (page, bank, state, deviceid) {
		if (deviceid === 'emberplus') {
			return;
		}
		self.pushed[page + '_' + bank] = state;
		if (self.server) {
			var path = '0.1.' + page + '.' + bank + '.0';
			var xpath = self.server.tree.getElementByPath(path);

			// Update ember+ with internal state of button
			if (xpath) {
				self.server.setValue(xpath, state);
			}
		}
	});

	system.on('graphics_bank_invalidate', function (page, bank) {
		if (self.server) {
			var path = '0.1.' + page + '.' + bank + '.1';
			var xpath = self.server.tree.getElementByPath(path);

			// Update ember+ with internal state of button
			if (xpath && xpath.contents.value !== self.banks[page][bank].text) {
				self.server.setValue(xpath, self.banks[page][bank].text || '');
			}
		}
	});

	self.init();
};

server_emerplus.prototype.getPages = function () {
	var self = this;
	self.pushed = {};

	self.system.emit('get_page', function (pages) {
		self.pages = pages;
	});

	self.system.emit('db_get', 'bank', function (banks) {
		self.banks = banks;
		for (var page in banks) {
			for (var bank in banks[page]) {
				self.pushed[page + '_' + bank] = 0;
			}
		}
	});


	var output = [];

	for (var page in self.pages) {
		var number = parseInt(page);
		var children = [];

		for (var bank in self.banks[page]) {
			children.push({
				identifier: 'Bank ' + page + '.' + bank,
				number: parseInt(bank),
				children: [
					{
						identifier: 'State',
						type: ParameterType.boolean,
						value: self.pushed[page + '_' + bank] ? true : false,
						access: 'readWrite'
					},
					{
						identifier: 'Label',
						type: ParameterType.string,
						value: self.banks[page][bank].text || '',
						access: 'readWrite'
					}
				]
			})
		}

		output.push({
			identifier: self.pages[page].name === 'PAGE' ? 'Page ' + page : self.pages[page].name,
			number: number,
			children: children
		})
	}

	return output;
}

server_emerplus.prototype.init = function () {
	var self = this;

	var jsonTree = [
		{
		   identifier: "Companion Tree",
		   children: [
				 {
					identifier: "identity",
					children: [
					   { identifier: "product", value: "Companion" },
					   { identifier: "company", value: "Bitfocus AS" },
					   { identifier: "version", value: self.companion_info.appVersion },
					   { identifier: "build",    value: self.companion_info.appBuild }
					]
				 },
				 {
					identifier: "Pages",
					children: self.getPages()
				 }
		   ]
		}
	 ];
	 var root = EmberServer.JSONtoTree(jsonTree);
	 
	var server = self.server = new EmberServer("0.0.0.0", 9092, root);
	server.listen().then(function () {
		debug('Listening on port 9092');
		system.emit('log', 'Ember+ Server', 'info', 'Listening for Ember+ on port 9092');
	}).catch(function (e) {
		system.emit('log', 'Ember+ Server', 'error', 'Couldn\'t bind to TCP port 9092');
		console.error('ember+: Could not bind to port 9092: ' + e.message);
	});

	// Handling via promise instead
	server.on('error', function (e) {});

	 server.on("value-change", function (obj) {
		 if (obj !== null) {
			var path = obj.getPath();

			if (path.match(/^0\.1\.(\d+\.){2}0/)) {
				var pathInfo = path.split(/\./);
				if (pathInfo.length === 5) {
					var page = parseInt(pathInfo[2]);
					var bank = parseInt(pathInfo[3]);

					if (page > 0 && page < 100) {
						debug("Change bank " + pathInfo[2] + '.' + pathInfo[3] + ' to', obj.contents.value);
						system.emit('bank_pressed', pathInfo[2], pathInfo[3], obj.contents.value, 'emberplus');
					}
				}
			}
			else if (path.match(/^0\.1\.(\d+\.){2}1/)) {
				var pathInfo = path.split(/\./);
				if (pathInfo.length === 5) {
					var page = parseInt(pathInfo[2]);
					var bank = parseInt(pathInfo[3]);

					if (page > 0 && page < 100) {
						debug("Change bank " + pathInfo[2] + '.' + pathInfo[3] + ' text to', obj.contents.value);
						if (self.banks[page] && self.banks[page][bank]) {
							if (obj.contents.value !== self.banks[page][bank].text) {
								self.system.emit('bank_changefield', page, bank, 'text', obj.contents.value);
							}
						}
					}
				}
			}

		}
	 });
};


exports = module.exports = function (system) {
	return new server_emerplus(system);
};
