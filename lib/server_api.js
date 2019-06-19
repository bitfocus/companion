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

var debug = require('debug')('lib/server_api');
var net   = require('net');

function server_api(system) {

	var self = this;

	system.on('server_api_command', function(data, response_cb) {

		debug("API parsing command:",data.trim());
		var command = data.toString();
		var match;

		if (match = command.match(/^page-set (\d+) ([a-z0-9]{3,32})\n?$/i)) {
			var page = parseInt(match[1]);
			var deviceid = match[2];
			system.emit('device_page_set', deviceid, page);
			response_cb(null, "+OK Probably?");
		}

		else if (match = command.match(/^page-up ([a-z0-9]{3,32})\n?$/i)) {
			var deviceid = match[1];
			system.emit('device_page_up', deviceid);
			response_cb(null, "+OK If " + deviceid + " is connected");
		}

		else if (match = command.match(/^page-down ([a-z0-9]{3,32})\n?$/i)) {
			var deviceid = match[1];
			system.emit('device_page_down', deviceid);
			response_cb(null, "+OK If " + deviceid + " is connected");
		}

		else if (match = command.match(/^(bank-press|bank-up|bank-down) (\d+) (\d+)\n?$/i)) {

			var func = match[1].toLowerCase();
			var page = parseInt(match[2]);
			var bank = parseInt(match[3]);

			if (page > 0 && page <= 99 && bank > 0 && bank <= global.MAX_BUTTONS) {
				system.emit('log', 'TCP Server', 'debug', func + ': ' + page + "." + bank);

				if (func == 'bank-press') {

					debug("Got /press/bank/ (trigger)",page,"button",bank);
					system.emit('bank_pressed', page, bank, true);

					setTimeout(function (){
						debug("Auto releasing /press/bank/ (trigger)",page,"button",bank);
						system.emit('bank_pressed', page, bank, false);
					}, 20);

				}

				else if (func == 'bank-down') {
					system.emit('bank_pressed', page, bank, true);
				}

				else if (func == 'bank-up') {
					system.emit('bank_pressed', page, bank, false);
				}

				response_cb(null, "+OK");
			}

			else {
				response_cb(true, "-ERR Page/bank out of range");
			}

		}

		else {
			response_cb(true, "-ERR Syntax error");
		}

	});
};


exports = module.exports = function (system) {
	return new server_api(system);
};
