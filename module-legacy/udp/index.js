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

var debug = require('debug')('lib/udp')
var UDP = require('dgram')
var util = require('util')
var EventEmitter = require('events').EventEmitter

var udp_sockets = []

const STATUS_UNKNOWN = null
const STATUS_OK = 0
const STATUS_WARNING = 1
const STATUS_ERROR = 2

// Private function
function new_status(self, status, message) {
	if (self.status != status) {
		self.status = status
		self.emit('status_change', status, message)
	}
}

function udp(host, port, options) {
	var self = this

	EventEmitter.call(this)

	self.status = undefined
	self.host = host
	self.port = port
	self.options = options || {}
	self.bound = false
	self.pending_memberships = []

	self.socket = UDP.createSocket('udp4')

	debug('new udp instance for sending to ' + host)

	if (self.options.bind_port || self.options.bind_ip) {
		try {
			self.socket.bind(self.options.bind_port || 0, self.options.bind_ip)
		} catch (e) {
			debug('Error binding to ip/port: ' + self.options.bind_ip + ':' + self.options.bind_port)
			new_status(self, STATUS_ERROR, 'Unable to bind to port ' + self.options.bind_port)
		}
	}

	if (self.options.broadcast) {
		self.socket.setBroadcast(true)
	}

	if (self.options.ttl !== undefined) {
		self.socket.setTTL(self.options.ttl)
	}

	if (self.options.multicast_ttl !== undefined) {
		self.socket.setMulticastTTL(self.options.multicast_ttl)
	}

	self.socket.on('error', function (error) {
		// status levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		new_status(self, STATUS_ERROR, error.message)
		self.emit.apply(self, ['error'].concat(Array.from(arguments)))
	})

	self.socket.on('listening', function () {
		self.bound = true

		if (self.pending_memberships.length) {
			while (self.pending_memberships.length > 0) {
				self.socket.addMembership(member.shift())
			}
		}

		if (self.options.multicast_interface) {
			self.socket.setMulticastInterface(self.options.multicast_interface)
		}

		new_status(self, STATUS_OK)
		self.emit.apply(self, ['listening'].concat(Array.from(arguments)))
	})

	self.socket.on('message', self.emit.bind(self, 'data'))

	udp_sockets.push(self.socket)
	debug(udp_sockets.length + ' UDP sockets in use (+1)')

	return self
}
util.inherits(udp, EventEmitter)

udp.prototype.send = function (message, cb) {
	var self = this

	debug('sending ' + (message !== undefined ? message.length : 'undefined') + ' bytes to', self.host, self.port)

	self.socket.send(message, self.port, self.host, function (error) {
		if (error) {
			new_status(self, STATUS_ERROR, error.message)
			self.emit.apply(self, ['error'].concat(Array.from(arguments)))

			if (typeof cb == 'function') {
				cb(error)
			}
			return
		}

		new_status(self, STATUS_OK)

		if (typeof cb == 'function') {
			cb()
		}
	})
}

udp.prototype.addMembership = function (member) {
	if (!self.bound) {
		self.pending_memberships.push(member)
	} else {
		self.socket.addMembership(member)
	}
}

udp.prototype.destroy = function () {
	var self = this

	if (udp_sockets.indexOf(self.socket) !== -1) {
		udp_sockets.splice(udp_sockets.indexOf(self.socket), 1)
		debug(udp_sockets.length + ' UDP sockets in use (-1)')
	}
	self.socket.removeAllListeners()
	self.removeAllListeners()
	self.socket.close()
}

exports = module.exports = udp
