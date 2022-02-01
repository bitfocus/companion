/*
 * This file is part of the Companion project
 * Copyright (c) 2020 Bitfocus AS
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

const { EmberServer, Model: EmberModel } = require('emberplus-connection')
const { getPath } = require('emberplus-connection/dist/Ember/Lib/util')
const CoreBase = require('../Core/Base')

class ServiceEmberPlus extends CoreBase {
	/**
	 * @param {Registry} registry - the application's core
	 */
	constructor(registry) {
		super(registry, 'ember+', 'lib/Service/EmberPlus')
		this.pushed = {}

		this.system.on('set_userconfig_key', (key, val) => {
			if (key !== 'emberplus_enabled') {
				return
			}

			this.config['emberplus_enabled'] = val

			try {
				if (val === true) {
					this.init()
				} else {
					this.server.discard()
				}
			} catch (e) {
				console.log('Error listening/stopping ember+', e)
			}
		})

		this.system.on('graphics_indicate_push', (page, bank, state, deviceid) => {
			if (deviceid === 'emberplus') {
				return
			}
			this.pushed[page + '_' + bank] = state
			if (this.server) {
				let path = '0.1.' + page + '.' + bank + '.0'
				let node = this.server.getElementByPath(path)

				// Update ember+ with internal state of button
				if (node) {
					this.server.update(node, { value: state })
				}
			}
		})

		this.system.on('graphics_bank_invalidate', (page, bank) => {
			if (this.server) {
				//this.log('info', `Updating ${page}.${bank} label ${this.banks[page][bank].text}`)
				let path = '0.1.' + page + '.' + bank + '.1'
				let node = this.server.getElementByPath(path)

				// Update ember+ with internal state of button
				if (node && node.contents.value !== this.banks[page][bank].text) {
					this.server.update(node, { value: this.banks[page][bank].text || '' })
				}
			}
		})

		this.system.emit('get_userconfig', (obj) => {
			this.config = obj

			if (this.config['emberplus_enabled'] === true) {
				try {
					this.init()
				} catch (e) {
					console.log('Error listening for ember+', e)
				}
			}
		})
	}

	getPages() {
		this.pushed = {}

		this.pages = this.page.getAll(true)

		this.banks = this.db.getKey('bank')

		for (const page in banks) {
			for (const bank in banks[page]) {
				this.pushed[page + '_' + bank] = 0
			}
		}

		let output = {}

		for (const page in this.pages) {
			const number = parseInt(page)
			const children = {}

			for (const bank in this.banks[page]) {
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

	init() {
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
						new EmberModel.ParameterImpl(EmberModel.ParameterType.String, 'version', undefined, this.system.appVersion)
					),
					3: new EmberModel.NumberedTreeNodeImpl(
						3,
						new EmberModel.ParameterImpl(EmberModel.ParameterType.String, 'build', undefined, this.system.appBuild)
					),
				}),
				1: new EmberModel.NumberedTreeNodeImpl(1, new EmberModel.EmberNodeImpl('pages'), this.getPages()),
			}),
		}((this.server = new EmberServer(9092)))

		this.server.onSetValue = (parameter, value) => {
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

		this.server.init(root)
		// .then(() => {
		this.debug('Listening on port 9092')
		this.log('info', 'Listening for Ember+ on port 9092')
		// }).catch((e) => {
		// 	this.log('error', 'Couldn\'t bind to TCP port 9092');
		// 	console.error('ember+: Could not bind to port 9092: ' + e.message);
		// });

		// Handling via promise instead
		this.server.on('error', (e) => {
			this.log('error', "Couldn't bind to TCP port 9092")
			console.error('ember+: Could not bind to port 9092: ' + e.message)
		})
	}
}

module.exports = ServiceEmberPlus
