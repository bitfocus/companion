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

var debug    = require('debug')('lib/Data/UserConfig');
var CoreBase = require('../Core/Base');

class UserConfig extends CoreBase {

	constructor(registry) {
		super(registry, 'userconfig');

		this.userconfig = this.db().getKey('userconfig', UserConfig.Defaults);

		this.system.on('get_userconfig', (cb) => {
			cb(this.userconfig);
		});

		this.system.on('io_connect', (client) => {

			client.on('set_userconfig_key', (key, value) => {
				this.setKey(key, value);
				client.broadcast.emit('set_userconfig_key', key, value);
			});

			client.on('get_userconfig_all', () => {
				client.emit('get_userconfig_all:result', this.userconfig);
			});
		});
	}

	static Defaults = {
		page_direction_flipped:  false,
		page_plusminus:          false,
		emulator_control_enable: false,
		pin_enable:              false,
		link_lockouts:           false,
		pin:                     '',
		pin_timeout:             0
	};

	get() {
		return this.userconfig;
	}

	getKey(key) {
		return this.userconfig[key];
	}

	setKey(key, value) {
		this.userconfig[key] = value;
		debug('set_userconfig_key', key, value);
		this.log('info', 'set ' + key + ' = ' + value);
		this.system.emit('set_userconfig_key', key, value);
		this.db().setDirty();
	}
}

exports = module.exports = UserConfig;