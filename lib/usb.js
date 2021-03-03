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

// We have a lot of problems with USB in electron, so this
// is a workaround of that.
var cp = require('child_process')
var path = require('path')
var debug = require('debug')('lib/usb')
var shortid = require('shortid')

let child = null

var devices = {}
var results = {}

function usb(system, type, devicepath, cb) {
	var self = this
	self.id = shortid.generate()

	self.debug = require('debug')('lib/usb/' + type)

	// fork the child process
	var child = (self.child = cp.fork(path.join(__dirname, 'usb/handler.js'), [], {
		stdio: 'inherit',
		env: {
			ELECTRON_RUN_AS_NODE: true,
			MAX_BUTTONS: global.MAX_BUTTONS,
			MAX_BUTTONS_PER_ROW: global.MAX_BUTTONS_PER_ROW,
		},
	}))

	system.on('graphics_set_bank_bg', (page, bank, bgcolor) => {
		child.send({ id: self.id, cmd: 'system', args: ['graphics_set_bank_bg', page, bank, bgcolor] })
	})

	child.send({ id: self.id, cmd: 'add', type: type, devicepath: devicepath })

	child.on('message', function (data) {
		if (data.cmd == 'add') {
			debug('module added successfully', data.id)
			cb()
		} else if (data.cmd == 'debug') {
			self.debug.apply(self.debug, data.args)
		} else if (data.cmd == 'publish') {
			debug('got local variables from module')
			for (var key in data.info) {
				self[key] = data.info[key]
			}
		} else if (data.cmd == 'error') {
			debug('Error from usb module ' + type + ': ' + data.error + ' (id: ' + data.id + ' / ' + self.id + ')')
		} else if (data.cmd == 'return') {
			if (typeof results[data.returnId] == 'function') {
				results[data.returnId](data.result)
				delete results[data.returnId]
			}
		} else if (data.cmd == 'system') {
			system.emit.apply(system, data.args)
		}
	})

	child.on('error', function (e) {
		debug('Handle USB error: ', e)
	})
}

usb.prototype._execute = function (func, args, cb) {
	var self = this
	var returnId

	if (typeof cb == 'function') {
		returnId = shortid.generate()
		results[returnId] = cb
	}

	self.child.send({ cmd: 'execute', function: func, args: args, id: self.id, returnId: returnId })
}

usb.prototype.begin = function () {
	var self = this
	var args = [].slice.call(arguments)

	self._execute('begin', args)
}

usb.prototype.getConfig = function (cb) {
	var self = this
	var args = [].slice.call(arguments)

	self._execute('getConfig', args, cb)
}

usb.prototype.setConfig = function () {
	var self = this
	var args = [].slice.call(arguments)

	if (self.deviceHandler) {
		// Custom override, page should have been inside the deviceconfig object
		if (args[0].page !== undefined) {
			self.deviceHandler.page = args[0].page
		}
	}

	self._execute('setConfig', args)

	if (self.deviceHandler) {
		self.deviceconfig = args[0]
		self.deviceHandler.updatedConfig()
	}
}

usb.prototype.draw = function () {
	var self = this
	var args = [].slice.call(arguments)

	self._execute('draw', args)
}

usb.prototype.clearDeck = function () {
	var self = this
	var args = [].slice.call(arguments)

	self._execute('clearDeck', args)
}

usb.prototype.quit = function () {
	var self = this

	self._execute('quit')

	setTimeout(function () {
		self.child.kill()
	}, 2000)
}

exports = module.exports = usb
