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

const DataStoreBase = require('./StoreBase')
const DataUpgrade = require('./Upgrade')

/**
 * The class that manages the applications's main database
 *
 * @extends DataStoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 1.0.4
 */
class Database extends DataStoreBase {
	/**
	 * The default minimum interval in ms to save to disk (4000 ms)
	 * @type {number}
	 * @static
	 */
	static SaveInterval = 4000

	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Data/Database')

	/**
	 * the core registry
	 * @type {Registry}
	 * @access protected
	 */
	registry = null

	/**
	 * Create a new application flat file DB controller
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'db', registry.cfgDir, Database.SaveInterval, {})

		this.loadSync()

		this.upgrade = new DataUpgrade(registry, this)
	}
}

exports = module.exports = Database
