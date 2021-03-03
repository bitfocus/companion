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

var debug = require('debug')('lib/osc')
var OSC = require('osc')

function osc(system) {
	var self = this
	self.ready = true
	self.system = system

	self.listener = new OSC.UDPPort({
		localAddress: '0.0.0.0',
		localPort: 12321,
		broadcast: true,
		metadata: true,
	})

	self.listener.open()

	self.listener.on('ready', function () {
		self.ready = true
	})

	self.listener.on('message', function (message) {
		try {
			var a = message.address.split('/')
			if (message.address.match(/^\/press\/bank\/\d+\/\d+$/)) {
				if (message.args.length == 0) {
					debug('Got /press/bank/ (trigger)', parseInt(a[3]), 'button', parseInt(a[4]))
					system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), true)

					setTimeout(function () {
						debug('Auto releasing /press/bank/ (trigger)', parseInt(a[3]), 'button', parseInt(a[4]))
						system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), false)
					}, 20)
				} else {
					if (message.args[0].type == 'i' && message.args[0].value == '1') {
						debug('Got /press/bank/ (press) for bank', parseInt(a[3]), 'button', parseInt(a[4]))
						system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), true)
					} else if (message.args[0].type == 'i' && message.args[0].value == '0') {
						debug('Got /press/bank/ (release) for bank', parseInt(a[3]), 'button', parseInt(a[4]))
						system.emit('bank_pressed', parseInt(a[3]), parseInt(a[4]), false)
					}
				}
			} else if (message.address.match(/^\/style\/bgcolor\/\d+\/\d+$/)) {
				if (message.args.length > 2) {
					var r = message.args[0].value
					var g = message.args[1].value
					var b = message.args[2].value
					if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
						var col = rgb(r, g, b)
						debug('Got /style/bgcolor', parseInt(a[3]), 'button', parseInt(a[4]))
						system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'bgcolor', col)
						system.emit('graphics_bank_invalidate', parseInt(a[3]), parseInt(a[4]))
					}
				}
			} else if (message.address.match(/^\/style\/color\/\d+\/\d+$/)) {
				if (message.args.length > 2) {
					var r = message.args[0].value
					var g = message.args[1].value
					var b = message.args[2].value
					if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
						var col = rgb(r, g, b)
						debug('Got /style/color', parseInt(a[3]), 'button', parseInt(a[4]))
						system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'color', col)
						system.emit('graphics_bank_invalidate', parseInt(a[3]), parseInt(a[4]))
					}
				}
			} else if (message.address.match(/^\/style\/text\/\d+\/\d+$/)) {
				if (message.args.length > 0) {
					var text = message.args[0].value
					if (typeof text === 'string') {
						debug('Got /style/text', parseInt(a[3]), 'button', parseInt(a[4]))
						system.emit('bank_set_key', parseInt(a[3]), parseInt(a[4]), 'text', text)
						system.emit('graphics_bank_invalidate', parseInt(a[3]), parseInt(a[4]))
					}
				}
			}
		} catch (error) {
			system.emit('log', 'osc', 'warn', 'OSC Error: ' + error)
		}
	})

	function rgb(r, g, b) {
		return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
	}

	self.system.on('osc_send', function (host, port, path, args) {
		self.listener.send(
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

		system.emit('osc_send_bundle', host, port, 60, [
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
	self.system.on('osc_send_bundle', function (host, port, time, bundle) {
		self.listener.send(
			{
				timeTag: OSC.timeTag(time),
				packets: bundle,
			},
			host,
			port
		)
	})

	return self
}

exports = module.exports = function (system) {
	return new osc(system)
}
