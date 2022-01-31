const BankController = require('./Bank/Controller')
const GraphicsController = require('./Graphics/Controller')
const GraphicsPreview = require('./Graphics/Preview')
const DataController = require('./Data/Controller')
const InstanceController = require('./Instance/Controller')
const PageController = require('./Page/Controller')
const ServiceController = require('./Service/Controller')
const SurfaceController = require('./Surface/Controller')
const TriggerController = require('./Triggers/Controller')
const UIController = require('./UI/Controller')

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

		this.ui = new UIController(this)
		this.io = this.ui.io
		this.log = this.ui.log
		this.data = new DataController(this)
		this.db = this.data.db
		this.userconfig = this.data.userconfig
		this.page = new PageController(this)
		this.triggers = new TriggerController(this)
		this.bank = new BankController(this)
		this.graphics = new GraphicsController(this)
		this.preview = new GraphicsPreview(this)
		this.surfaces = new SurfaceController(this)
		this.instance = new InstanceController(this)
		this.services = new ServiceController(this)

		//this.system.emit('modules_loaded')
	}
}

module.exports = Registry
