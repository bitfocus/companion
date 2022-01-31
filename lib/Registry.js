const Bank = require('./Bank')
const Database = require('./Database')
const Graphics = require('./Graphics')
const Data = require('./Data')
const Instance = require('./Instance')
const Interface = require('./Interface')
const Page = require('./Page')
const Service = require('./Service')
const Surface = require('./Surface')
const Trigger = require('./Trigger')

const EventEmitter = require('events')

/**
 * The core controller that sets up all the controllers needed
 * for the app.
 *
 * @extends EventEmitter
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 * @copyright 2021 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class Registry extends EventEmitter {
	debug = require('debug')('lib/Registry')

	/** */
	constructor() {
		super()
	}

	/**
	 * Launch the core application
	 * @access public
	 */
	launch(system) {
		this.debug('launching core modules')

		this.system = system

		this.ui = new Interface(system)
		this.io = this.ui.io
		this.log = this.ui.log
		this.db = new Database(system)
		this.data = new Data(system)
		this.page = new Page(system)
		this.triggers = new Trigger(system)
		this.bank = new Bank(this)
		this.graphics = new Graphics(system)
		this.surfaces = new Surface(system)
		this.instance = new Instance(system)
		this.services = new Service(system, this.ui)

		//this.system.emit('modules_loaded')
	}
}

module.exports = Registry
