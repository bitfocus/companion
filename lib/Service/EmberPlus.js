const ServiceBase = require('./Base')
const { EmberServer, Model: EmberModel } = require('emberplus-connection')
const { getPath } = require('emberplus-connection/dist/Ember/Lib/util')

/**
 * Class providing the Ember+ api.
 *
 * @extends ServiceBase
 * @author Balte de Wit <contact@balte.nl>
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.1.1
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
class ServiceEmberPlus extends ServiceBase {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Service/EmberPlus')

	/**
	 * The port to open the socket with.  Default: <code>9092</code>
	 * @type {number}
	 * @access protected
	 */
	port = 9092

	/**
	 * Bank state array
	 * @type {Object}
	 * @access protected
	 */
	pushed = {}

	/**
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'ember+')

		this.system.on('graphics_indicate_push', this.updateBankState.bind(this))
		this.system.on('graphics_bank_invalidate', this.updateBankText.bind(this))

		this.init()
	}

	getPages() {
		this.pushed = {}
		this.pages = this.page.getAll()
		this.banks = this.bank.getAll()

		for (let page in this.banks) {
			for (let bank in this.banks[page]) {
				this.pushed[page + '_' + bank] = 0
			}
		}

		let output = {}

		for (const page in this.pages) {
			const number = parseInt(page)
			const children = {}

			for (let bank in this.banks[page]) {
				const bankNo = parseInt(bank)
				children[bankNo] = new EmberModel.NumberedTreeNodeImpl(
					bankNo,
					new EmberModel.EmberNodeImpl(`Bank ${page}.${bank}`),
					{
						0: new EmberModel.NumberedTreeNodeImpl(
							0,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.Boolean,
								'State',
								undefined,
								this.pushed[page + '_' + bank] ? true : false,
								undefined,
								undefined,
								EmberModel.ParameterAccess.ReadWrite
							)
						),
						1: new EmberModel.NumberedTreeNodeImpl(
							1,
							new EmberModel.ParameterImpl(
								EmberModel.ParameterType.String,
								'Label',
								undefined,
								this.banks[page][bank].text || '',
								undefined,
								undefined,
								EmberModel.ParameterAccess.ReadWrite
							)
						),
					}
				)
			}

			output[number] = new EmberModel.NumberedTreeNodeImpl(
				number,
				new EmberModel.EmberNodeImpl(this.pages[page].name === 'PAGE' ? 'Page ' + page : this.pages[page].name),
				children
			)
		}

		return output
	}

	listen() {
		const root = {
			0: new EmberModel.NumberedTreeNodeImpl(0, new EmberModel.EmberNodeImpl('Companion Tree'), {
				0: new EmberModel.NumberedTreeNodeImpl(0, new EmberModel.EmberNodeImpl('identity'), {
					0: new EmberModel.NumberedTreeNodeImpl(
						0,
						new EmberModel.ParameterImpl(EmberModel.ParameterType.String, 'product', undefined, 'Companion')
					),
					1: new EmberModel.NumberedTreeNodeImpl(
						1,
						new EmberModel.ParameterImpl(EmberModel.ParameterType.String, 'company', undefined, 'Bitfocus AS')
					),
					2: new EmberModel.NumberedTreeNodeImpl(
						2,
						new EmberModel.ParameterImpl(
							EmberModel.ParameterType.String,
							'version',
							undefined,
							this.registry.appVersion
						)
					),
					3: new EmberModel.NumberedTreeNodeImpl(
						3,
						new EmberModel.ParameterImpl(EmberModel.ParameterType.String, 'build', undefined, this.registry.appBuild)
					),
				}),
				1: new EmberModel.NumberedTreeNodeImpl(1, new EmberModel.EmberNodeImpl('pages'), this.getPages()),
			}),
		}

		this.server = new EmberServer(this.port)
		this.server.onSetValue = this.setValue.bind(this)
		this.server.init(root)
		this.server.on('error', this.handleSocketError.bind(this))
	}

	setValue(parameter, value) {
		const path = getPath(parameter)

		if (path.match(/^0\.1\.(\d+\.){2}0/)) {
			let pathInfo = path.split(/\./)

			if (pathInfo.length === 5) {
				let page = parseInt(pathInfo[2])
				let bank = parseInt(pathInfo[3])

				if (page > 0 && page < 100) {
					this.debug('Change bank ' + pathInfo[2] + '.' + pathInfo[3] + ' to', value)
					this.system.emit('bank_pressed', pathInfo[2], pathInfo[3], value, 'emberplus')
					this.server.update(parameter, { value })
					return Promise.resolve(true)
				}
			}
		} else if (path.match(/^0\.1\.(\d+\.){2}1/)) {
			let pathInfo = path.split(/\./)

			if (pathInfo.length === 5) {
				let page = parseInt(pathInfo[2])
				let bank = parseInt(pathInfo[3])

				if (page > 0 && page < 100) {
					this.debug('Change bank ' + pathInfo[2] + '.' + pathInfo[3] + ' text to', value)

					if (this.banks[page] && this.banks[page][bank]) {
						if (value !== this.banks[page][bank].text) {
							this.system.emit('bank_changefield', page, bank, 'text', value)
							this.server.update(parameter, { value })
							return Promise.resolve(true)
						}
					}
				}
			}
		}

		return Promise.resolve(false)
	}

	updateBankState(page, bank, state, deviceid) {
		if (deviceid === 'emberplus') {
			return
		}

		this.pushed[page + '_' + bank] = state

		if (this.server) {
			const path = '0.1.' + page + '.' + bank + '.0'
			let node = this.server.getElementByPath(path)

			// Update ember+ with internal state of button
			if (node) {
				this.server.update(node, { value: state })
			}
		}
	}

	updateBankText(page, bank) {
		this.log('log', `Updating ${page}.${bank} label ${this.banks[page][bank].text}`)
		if (this.server) {
			const path = '0.1.' + page + '.' + bank + '.1'
			let node = this.server.getElementByPath(path)

			// Update ember+ with internal state of button
			if (node && node.contents.value !== this.banks[page][bank].text) {
				this.server.update(node, { value: this.banks[page][bank].text || '' })
			}
		}
	}
}

exports = module.exports = ServiceEmberPlus
