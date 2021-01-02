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

class CoreBase {

	constructor(registry, logSource) {
		this.registry  = registry;
		this.system    = registry.system;
		this.logSource = logSource;
		this.log       = (level, message) => {
			this.registry.log.add(logSource, level, message);
		}
	}

	bank() {
		return this.registry.bank;
	}

	db() {
		return this.registry.db;
	}

	elgatoDM() {
		return this.registry.elgatoDM;
	}

	graphics() {
		return this.registry.graphics;
	}

	instance() {
		return this.registry.instance;
	}

	io() {
		this.registry.io;
	}

	page() {
		return this.registry.page;
	}

	schedule() {
		return this.registry.schedule;
	}

	services() {
		return this.registry.services;
	}

	userconfig() {
		return this.registry.userconfig;
	}
}

exports = module.exports = CoreBase;