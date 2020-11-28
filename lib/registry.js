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

var debug   = require('debug')('lib/registry');

var Action            = require('./action');
var Bank              = require('./bank');
var ClientIO          = require('./io');
var DB                = require('./db');
var ElgatoDM          = require('./elgato_dm');
var Feedback          = require('./feedback');
var Graphics          = require('./graphics');
var Help              = require('./help');
var HttpServer        = require('./server_http');
var ImportExport      = require('./loadsave');
var Instance          = require('./instance');
var Log               = require('./log');
var Page              = require('./page');
var Preset            = require('./preset');
var Preview           = require('./preview');
var Rest              = require('./rest');
var RestPoll          = require('./rest_poll');
var Scheduler         = require('./schedule');
var ServiceController = require('./Service/controller');
var Tablet            = require('./tablet');
var Update            = require('./update');
var UserConfig        = require('./userconfig');
var Variable          = require('./variable');

class Registry {

	constructor(system, cfgDir) {
		this.system  = system;
		this.cfgDir  = cfgDir;
		this.appRoot = require('app-root-path');
		debug('launching core');

		this.server_http       = new HttpServer(this);
		this.io                = new ClientIO(this);
		this.log               = new Log(this);
		this.db                = new DB(this);
		this.userconfig        = new UserConfig(this);
		this.update            = new Update(this);
		this.page              = new Page(this);
		this.variable          = new Variable(this);
		this.schedule          = new Scheduler(this);
		this.feedback          = new Feedback(this);
		this.action            = new Action(this);
		this.bank              = new Bank(this);
		this.graphics          = new Graphics(this);
		this.elgatoDM          = new ElgatoDM(this);
		this.preview           = new Preview(this);
		this.instance          = new Instance(this);
		this.serviceController = new ServiceController(this);
		this.rest              = new Rest(this);
		this.rest_poll         = new RestPoll(this);
		this.loadsave          = new ImportExport(this);
		this.preset            = new Preset(this);
		this.tablet            = new Tablet(this);
		this.help              = new Help(this);
	}

	getAppRoot() {
		return this.appRoot;
	}

	getCfgDir() {
		return this.cfgDir;
	}
}

exports = module.exports = Registry