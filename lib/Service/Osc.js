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

const OSC = require('osc')
const { rgb } = require('../Resources/Util')
const CoreBase = require('../Core/Base')

class ServiceOsc extends CoreBase {
	constructor(registry) {
		super(registry, 'osc', 'lib/Service/Osc')

		this.sender = new OSC.UDPPort({
			localAddress: '0.0.0.0',
			localPort: 0, // random
			broadcast: true,
			metadata: true,
		})

		this.sender.open()

		this.system.on('osc_send', (host, port, path, args) => {
			this.sender.send(
				{
					address: path,
					args: args,
				},
				host,
				port
			)
		})

		/*
		Example usage of bundle scheduled after 60 seconds:

		this.system.emit('osc_send_bundle', host, port, 60, [
			{
				address: '/cmd/yes',
				args: [
					{ type: 'f', value: 1.0 }
				]
			},
			{
				address: '/cmd/somethingelse',
				args: [
					{ type: 's', value: 'hello' }
				]
			}
		]);
	*/
		this.system.on('osc_send_bundle', (host, port, time, bundle) => {
			this.sender.send(
				{
					timeTag: OSC.timeTag(time),
					packets: bundle,
				},
				host,
				port
			)
		})

		let user_config = this.db.getKey('userconfig', {})

		this.server_port = user_config.osc_listen_port

		if (user_config.osc_enabled) {
			this.start_listening()
		}

		this.system.on('set_userconfig_key', (key, value) => {
			if (key == 'osc_enabled') {
				// start/stop listener
				if (value && !this.server) {
					this.start_listening()
				} else if (!value && this.server) {
					this.stop_listening()
				}
			} else if (key == 'osc_listen_port') {
				this.server_port = value
				if (this.server) {
					// restart listener if already running
					this.start_listening()
				}
			}
		})
	}

	start_listening() {
		if (this.listener) {
			// cleanup an old server first
			this.stop_listening()
		}

		const port = this.server_port
		if (!port && typeof port !== 'number') {
			this.debug(`OSC listener disabled. Bad port ${port}`)
			return
		}

		this.listener = new OSC.UDPPort({
			localAddress: '0.0.0.0',
			localPort: port,
			broadcast: true,
			metadata: true,
		})

		this.listener.on('ready', () => {
			this.debug('OSC Server ready')
			this.system.emit('log', 'OSC Server', 'info', 'Ready for commands')
		})

		this.listener.on('error', (e) => {
			this.debug('OSC Server got error: ' + e)
			this.system.emit('log', 'OSC Server', 'error', 'Server failed: ' + e)
		})

		this.listener.open()

		this.listener.on('message', this.handle_message.bind(this))
	}

	stop_listening() {
		this.debug(`Stopping osc listener`)
		this.system.emit('log', 'OSC Server', 'info', `Stopping listening for OSC commands`)

		this.listener.close()
		delete this.listener
	}

	handle_message(message) {
		try {
			let a = message.address.split('/')
			if (message.address.match(/^\/press\/bank\/\d+\/\d+$/)) {
				if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == '1') {
					this.debug('Got /press/bank/ (press) for bank', parseInt(a[3]), 'button', parseInt(a[4]))
					this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), true)
				} else if (message.args.length > 0 && message.args[0].type == 'i' && message.args[0].value == '0') {
					this.debug('Got /press/bank/ (release) for bank', parseInt(a[3]), 'button', parseInt(a[4]))
					this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), false)
				} else {
					this.debug('Got /press/bank/ (trigger)', parseInt(a[3]), 'button', parseInt(a[4]))
					this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), true)

					setTimeout(() => {
						this.debug('Auto releasing /press/bank/ (trigger)', parseInt(a[3]), 'button', parseInt(a[4]))
						this.system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), false)
					}, 20)
				}
			} else if (message.address.match(/^\/style\/bgcolor\/\d+\/\d+$/)) {
				if (message.args.length > 2) {
					let r = message.args[0].value
					let g = message.args[1].value
					let b = message.args[2].value
					if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
						let col = rgb(r, g, b)
						this.debug('Got /style/bgcolor', parseInt(a[3]), 'button', parseInt(a[4]))
						this.system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'bgcolor', col)
						this.system.emit('graphics_bank_invalidate', parseInt(a[3]), parseInt(a[4]))
					}
				}
			} else if (message.address.match(/^\/style\/color\/\d+\/\d+$/)) {
				if (message.args.length > 2) {
					let r = message.args[0].value
					let g = message.args[1].value
					let b = message.args[2].value
					if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
						let col = rgb(r, g, b)
						this.debug('Got /style/color', parseInt(a[3]), 'button', parseInt(a[4]))
						this.system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'color', col)
						this.system.emit('graphics_bank_invalidate', parseInt(a[3]), parseInt(a[4]))
					}
				}
			} else if (message.address.match(/^\/style\/text\/\d+\/\d+$/)) {
				if (message.args.length > 0) {
					let text = message.args[0].value
					if (typeof text === 'string') {
						this.debug('Got /style/text', parseInt(a[3]), 'button', parseInt(a[4]))
						this.system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'text', text)
						this.system.emit('graphics_bank_invalidate', parseInt(a[3]), parseInt(a[4]))
					}
				}
			} else if (message.address.match(/^\/rescan$/)) {
				if (message.args.length > 0 && message.args[0].value == '1') {
					this.debug('Got /rescan 1')
					this.system.emit('log', 'OSC Server', 'debug', 'Rescanning USB')
					this.system.emit('devices_reenumerate')
				}
			}
		} catch (error) {
			this.system.emit('log', 'osc', 'warn', 'OSC Error: ' + error)
		}
	}
}

module.exports = ServiceOsc
