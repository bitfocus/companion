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

var debug = require('debug')('lib/Registry');

var Action              = require('./Bank/Action');
var Bank                = require('./Bank/Controller');
var DB                  = require('./Data/Database');
var DeviceController    = require('./Device/Controller');
var Feedback            = require('./Bank/Feedback');
var Graphics            = require('./Graphics/Graphics');
var ImportExport        = require('./Data/ImportExport');
var InstanceController  = require('./Instance/Controller');
var InterfaceClient     = require('./Interface/Client');
var InterfaceLog        = require('./Interface/Log');
var InterfaceServer     = require('./Interface/Server');
var Page                = require('./Page/Page');
var Preset              = require('./Instance/Preset');
var Preview             = require('./Graphics/Preview');
var ScheduleController  = require('./Schedule/Controller');
var ServiceController   = require('./Service/Controller');
var Update              = require('./Data/Update');
var UserConfig          = require('./Data/UserConfig');
var Variable            = require('./Instance/Variable');

class Registry {

	constructor(system, cfgDir) {
		this.system  = system;
		this.cfgDir  = cfgDir;
		this.appRoot = require('app-root-path');
		debug('launching core modules');

		this.server_http       = new InterfaceServer(this);
		this.io                = new InterfaceClient(this);
		this.log               = new InterfaceLog(this);
		this.db                = new DB(this);
		this.userconfig        = new UserConfig(this);
		this.update            = new Update(this);
		this.page              = new Page(this);
		this.variable          = new Variable(this);
		this.schedule          = new ScheduleController(this);
		this.feedback          = new Feedback(this);
		this.action            = new Action(this);
		this.bank              = new Bank(this);
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
		return this.cfgDir;
	}
}

exports = module.exports = Registry