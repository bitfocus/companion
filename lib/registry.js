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
const PageController      = require('./Page/Controller');
const Preset              = require('./Instance/Preset');
const Preview             = require('./Graphics/Preview');
const ScheduleController  = require('./Schedule/Controller');
const ServiceController   = require('./Service/Controller');
const UserConfig          = require('./Data/UserConfig');
const Variable            = require('./Instance/Variable');

/**
 * The core controller that sets up all the controllers needed
 * for the app.
 * 
 * @author Keith Rocheck <keith.rocheck@gmail.com> 
 * @since 2.2.0
 */
class Registry {
	
	/**
	 * The curent file/db verison number
	 * @type {number}
	 * @static
	 */
	static FileVersion = 2;

	/**
	 * Set up the registry
	 * @param {EventEmitter} system 
	 * @param {Config} config 
	 */
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
		this.page              = new PageController(this);
		this.variable          = new Variable(this);
		this.schedule          = new ScheduleController(this);
		this.bank              = new BankController(this);
		this.graphics          = new Graphics(this);
		this.deviceController  = new DeviceController(this);
		this.preview           = new Preview(this);
		this.instance          = new InstanceController(this);
		this.service           = new ServiceController(this);
		this.loadsave          = new ImportExport(this);
		this.preset            = new Preset(this);
	}

	/**
	 * @returns {string} the application's root file path
	 */
	getAppRoot() {
		return this.appRoot;
	}

	/**
	 * @returns {string} the folder path to the config/db
	 */
	getCfgDir() {
		return this.config.getCfgDir();
	}

	/**
	 * @returns {number} the current version number for the db and file import/export
	 */
	getFileVersion() {
		return Registry.FileVersion;
	}
}

exports = module.exports = Registry