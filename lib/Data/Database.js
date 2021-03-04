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
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 1.0.4
 */
class Database extends DataStoreBase {
	/**
	 * The default minimum interval in ms to save to disk (4000 ms)
	 * @type {number}
	 * @static
	 * @final
	 */
	static SaveInterval = 4000

	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('lib/Data/Database')

	/**
	 * the core registry
	 * @type {Registry}
	 * @access protected
	 */
	registry = null

	/**
	 * Create a new application flat file DB controller
	 * @param {EventEmitter} system - the application's event emitter
	 * @param {string} cfgDir - the directory the flat file will be saved
	 * @param {Object[]} defaults - the default data to use when making a new file
	 */
	constructor(registry) {
		super(registry.system, 'db', registry.getCfgDir(), Database.SaveInterval, {})
		this.registry = registry

		this.load()

		if (this.store.page_config_version !== undefined) {
			//let upgrade = new DataUpgrade(registry, this);
			//db = upgrade.checkDbVersion();

			if (db === null) {
				var dialog = require('electron').dialog
				dialog.showErrorBox(
					'Error starting companion',
					'You have previously installed a much newer version of companion. Since the configuration files are incompatible between major versions of companion, you need to remove the old config before continuing with this version.'
				)
				process.exit(1)
			} else {
				this.store = db
			}
		} else {
			this.store.page_config_version = this.registry.getFileVersion()
		}
	}
}

exports = module.exports = Database
