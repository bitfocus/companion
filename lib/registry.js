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

const debug = require('debug')('lib/Registry');

const BankController      = require('./Bank/Controller');
const DB                  = require('./Data/Database');
const DeviceController    = require('./Device/Controller');
const Graphics            = require('./Graphics/Graphics');
const ImportExport        = require('./Data/ImportExport');
const InstanceController  = require('./Instance/Controller');
const InterfaceClient     = require('./Interface/Client');
const InterfaceServer     = require('./Interface/Server');
const Page                = require('./Page/Page');
const Preset              = require('./Instance/Preset');
const Preview             = require('./Graphics/Preview');
const ScheduleController  = require('./Schedule/Controller');
const ServiceController   = require('./Service/Controller');
const UserConfig          = require('./Data/UserConfig');
const Variable            = require('./Instance/Variable');

class Registry {

	constructor(system, config) {
		this.system  = system;
		this.config  = config;
		this.appRoot = require('app-root-path');
		debug('launching core modules');

		this.server_http       = new InterfaceServer(this);
		this.io                = new InterfaceClient(this);
		this.log               = this.io.log;
		this.db                = new DB(this);
		this.userconfig        = new UserConfig(this);
		this.page              = new Page(this);
		this.variable          = new Variable(this);
		this.schedule          = new ScheduleController(this);
		this.bank              = new BankController(this);
		this.feedback          = this.bank.feedback;
		this.action            = this.bank.actions;
		this.graphics          = new Graphics(this);
		this.elgatoDM          = new DeviceController(this);
		this.preview           = new Preview(this);
		this.instance          = new InstanceController(this);
		this.serviceController = new ServiceController(this);
		this.loadsave          = new ImportExport(this);
		this.preset            = new Preset(this);
	}

	getAppRoot() {
		return this.appRoot;
	}

	getCfgDir() {
		return this.config.getCfgDir();
	}
}

exports = module.exports = Registry