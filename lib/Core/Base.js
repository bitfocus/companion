/**
 * This file is part of the Companion project
 * Copyright (c) 2021 Bitfocus AS
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

// Imports for JSDoc
const BankController      = require('../Bank/Controller');
const Database            = require('../Data/Database');
const DeviceController    = require('../Device/Controller');
const EventEmitter        = require('events');
const Graphics            = require('../Graphics/Graphics');
const InstanceController  = require('../Instance/Controller');
const InterfaceClient     = require('../Interface/Client');
const PageController      = require('../Page/Controller');
const Registry            = require('../registry');
const ScheduleController  = require('../Schedule/Controller');
const ServiceController   = require('../Service/Controller');
const UserConfig          = require('../Data/UserConfig');

 /**
  * Abstract class to be extended by most core classes.  Provides access to the
  * {@link Registry} and other core modules.
  * 
  * @author Keith Rocheck <keith.rocheck@gmail.com> 
  * @since 2.2.0
  * @abstract
  */
class CoreBase {

	/** @type {string} */
	logSource;
	/** @type {Registry} */
	registry;
	/** @type {EventEmitter} */
	system;

	/**
	 * Create the core base object.  This needs to be called in the extending class
	 * using `super(registry, 'module_name')`.
	 * @param {Registry} registry the core registry
	 * @param {string} logSource module name to be used in logs
	 */
	constructor(registry, logSource) {
		this.registry  = registry;
		this.system    = registry.system;
		this.logSource = logSource;
	}

	/**
	 * @returns {BankController} the bank controller
	 */
	bank() {
		return this.registry.bank;
	}

	/**
	 * @returns {Database} the database library
	 */
	db() {
		return this.registry.db;
	}

	/**
	 * @returns {DeviceController} the device controller
	 */
	elgatoDM() {
		return this.registry.elgatoDM;
	}

	/**
	 * @returns {Graphics} the graphics controller
	 */
	graphics() {
		return this.registry.graphics;
	}

	/**
	 * @returns {InstanceController} the instance controller
	 */
	instance() {
		return this.registry.instance;
	}

	/**
	 * @returns {InterfaceClient} the interface client
	 */
	io() {
		this.registry.io;
	}

	/**
	 * Send a log message to the UI
	 * @param {string} level - 'debug' | 'info' | 'warn' | 'error'
	 * @param {atring} message - the message to print
	 */
	log(level, message) {
		this.registry.log.add(this.logSource, level, message);
	}

	/**
	 * @returns {PageController} the page controller
	 */
	page() {
		return this.registry.page;
	}

	/**
	 * @returns {ScheduleController} the schedule controller
	 */
	schedule() {
		return this.registry.schedule;
	}

	/**
	 * @returns {ServiceController} the service controller
	 */
	services() {
		return this.registry.services;
	}

	/**
	 * @returns {UserConfig} the user config manager
	 */
	userconfig() {
		return this.registry.userconfig;
	}
}

exports = module.exports = CoreBase;