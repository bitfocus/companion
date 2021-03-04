/*
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

/**
 * Abstract class to be extended by most core classes.  Provides access to the
 * {@link Registry} and other core modules.
 *
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @since 2.2.0
 * @abstract
 */
class CoreBase {
	/**
	 * The module name to use in UI logs
	 * @type {string}
	 * @access protected
	 */
	logSource = null
	/**
	 * the core registry
	 * @type {Registry}
	 * @access protected
	 */
	registry = null
	/**
	 * the application's event smitter
	 * @type {EventEmitter}
	 * @access protected
	 */
	system = null

	/**
	 * Create the core base object.  This needs to be called in the extending class
	 * using `super(registry, 'module_name')`.
	 * @param {Registry} registry - the core registry
	 * @param {string} logSource - module name to be used in UI logs
	 */
	constructor(registry, logSource) {
		this.registry = registry
		this.system = registry.system
		this.logSource = logSource
	}

	/**
	 * @returns {BankController} the core bank controller
	 * @access protected
	 */
	bank() {
		return this.registry.bank
	}

	/**
	 * @returns {Database} the core database library
	 * @access protected
	 */
	db() {
		return this.registry.db
	}

	/**
	 * @returns {DeviceController} the core device controller
	 * @access protected
	 */
	deviceController() {
		return this.registry.deviceController
	}

	/**
	 * @returns {Graphics} the core graphics controller
	 * @access protected
	 */
	graphics() {
		return this.registry.graphics
	}

	/**
	 * @returns {InstanceController} the core instance controller
	 * @access protected
	 */
	instance() {
		return this.registry.instance
	}

	/**
	 * @returns {InterfaceClient} the core interface client
	 * @access protected
	 */
	io() {
		this.registry.io
	}

	/**
	 * Send a log message to the UI
	 * @param {string} level - 'debug' | 'info' | 'warn' | 'error'
	 * @param {atring} message - the message to print
	 * @access protected
	 */
	log(level, message) {
		this.registry.log.add(this.logSource, level, message)
	}

	/**
	 * @returns {PageController} the core page controller
	 * @access protected
	 */
	page() {
		return this.registry.page
	}

	/**
	 * @returns {ScheduleController} the core schedule controller
	 * @access protected
	 */
	schedule() {
		return this.registry.schedule
	}

	/**
	 * @returns {ServiceController} the core service controller
	 * @access protected
	 */
	services() {
		return this.registry.services
	}

	/**
	 * @returns {UserConfig} the core user config manager
	 * @access protected
	 */
	userconfig() {
		return this.registry.userconfig
	}
}

exports = module.exports = CoreBase
