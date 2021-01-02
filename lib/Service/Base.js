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

const CoreBase = require('../Core/Base');

class ServiceBase extends CoreBase {

	constructor(registry, logSource, defaults, defaultItem) {
		super(registry, logSource);

		this.initialized  = false;
		this.currentState = false;
		this.defaultItem  = defaultItem;

		this.setDefaults(defaults);
		this.setCheckEnabled();
	}

	disableModule() {

		if (this.socket) {
			try {
				this.currentState = false;
				this.log('debug', 'Stopped listening on port ' + this.port);
				this.socket.close();
				delete this.socket;
			}
			catch(e) {

			}
		}
	}

	enableModule() {

		if (this.initialized === true) {
			try {
				this.listen();
			}
			catch(e) {
				console.log("Error listening for ${this.logSource}",e);
			}
		}
	}

	handleSocketError(e) {
		let message;

		switch (e.code) {
			case 'EADDRINUSE':
				message = `Port ${this.port} already in use.`;
				break;
			case 'EACCES':
				message = `Access to port ${this.port} denied.`;
				break;
			default:
				message = `Could not open socket on port ${this.port}: ${e.code}`;
		}

		this.log('error', message);
		this.disableModule();
	}

	init() {
		this.initialized = true;

		if (this.defaultItem === undefined || (this.defaultItem !== undefined && this.userconfig().getKey(this.defaultItem) === true)) {
			this.enableModule();
		} 
	}

	setCheckEnabled() {

		if (this.defaultItem !== undefined) {
			this.system.on('set_userconfig_key', (key,val) => {

				if (key == this.defaultItem) {
					if (this.currentState == false && val == true) {
						this.enableModule();
					}
					else if (this.currentState == true && val == false) {
						this.disableModule();
					}
				}
			});
		}
	}

	setDefaults(defaults) {
		const config = this.userconfig().get();

		if (defaults !== undefined && typeof defaults == 'object') {
			for (let key in defaults) {
				if (config[key] === undefined) {
					this.userconfig().setKey(key, defaults[key])
				}
			}
		}
	}
}

exports = module.exports = ServiceBase;