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

var debug = require('debug')('lib/tcp')
var net = require('net')
var util = require('util')
var EventEmitter = require('events').EventEmitter

var tcp_sockets = []

const STATUS_UNKNOWN = null
const STATUS_OK = 0
const STATUS_WARNING = 1
const STATUS_ERROR = 2

// Private functions
function new_status(self, status, message) {
	if (self.status != status) {
		self.status = status
		self.emit('status_change', status, message)
	}
}

function tcp_reconnect(self) {
	delete self.try_timer

	new_status(self, STATUS_WARNING, 'Connecting')
	self.failed_attempts++
	debug('Reconnecting to ' + self.host + ':' + self.port + ', retry ' + self.failed_attempts)

	self.connect()
}

function tcp(host, port, options) {
	var self = this

	EventEmitter.call(this)

	self.status = undefined
	self.host = host
	self.port = port
	self.options = options || {}
	self.trying = false
	self.try_timer = undefined
	self.failed_attempts = 0
	self.connected = false

	if (self.options.reconnect_interval === undefined) {
		self.options.reconnect_interval = 2000
	}

	if (self.options.reconnect === undefined) {
		self.options.reconnect = true
	}

	self.socket = new net.Socket()
	self.socket.setKeepAlive(true)
	self.socket.setNoDelay(true)

	debug('new tcp instance for sending to ' + host)

	self.socket.on('error', function (err) {
		self.trying = false
		self.connected = false

		if (self.options.reconnect) {
			if (self.try_timer !== undefined) {
				clearTimeout(self.try_timer)
			}
			self.try_timer = setTimeout(tcp_reconnect, self.options.reconnect_interval, self)
		}

		// status levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		debug('error', err.message)
		new_status(self, STATUS_ERROR, err.message)
		self.emit.apply(self, ['error'].concat(Array.from(arguments)))
	})

	self.socket.on('ready', function () {
		self.failed_attempts = 0
		self.connected = true
		self.trying = false

		new_status(self, STATUS_OK)
		self.emit('connect', self.socket)
	})

	self.socket.on('end', function () {
		debug('Disconnected')

		self.connected = false
		new_status(self, STATUS_ERROR, 'Disconnected')

		if (!self.trying && self.options.reconnect) {
			if (self.try_timer !== undefined) {
				clearTimeout(self.try_timer)
			}

			self.try_timer = setTimeout(tcp_reconnect, self.options.reconnect_interval, self)
		}

		self.emit('end')
	})

	self.socket.on('data', self.emit.bind(self, 'data'))
	self.socket.on('drain', self.emit.bind(self, 'drain'))

	tcp_sockets.push(self.socket)
	debug(tcp_sockets.length + ' TCP sockets in use (+1)')

	// Let caller install event handlers first
	setImmediate(self.connect.bind(self))

	return self
}
util.inherits(tcp, EventEmitter)

tcp.prototype.connect = function () {
	var self = this

	if (!self.trying) {
		self.trying = true
		self.socket.connect(self.port, self.host)
	}
}

tcp.prototype.write = tcp.prototype.send = function (message, cb) {
	var self = this

	if (self.connected && self.socket && !self.socket.destroyed) {
		debug('sending ' + (message !== undefined ? message.length : 'undefined') + ' bytes to', self.host, self.port)

		try {
			self.socket.write(message, function (error) {
				if (error) {
					new_status(self, STATUS_ERROR, error.message)
					self.emit.apply(self, ['error'].concat(Array.from(arguments)))

					if (typeof cb == 'function') {
						cb(error)
					}
					return
				}

				if (typeof cb == 'function') {
					cb()
				}
			})
		} catch (error) {
			// Unhandeled socket error
			new_status(self, STATUS_ERROR, error.message)
			self.emit.apply(self, ['error'].concat(Array.from(arguments)))
			self.connected = false
			cb(error)
		}

		return true
	} else {
		debug('Tried to send, but not connected')
		return false
	}
}

tcp.prototype.destroy = function () {
	var self = this

	if (self.try_timer !== undefined) {
		clearTimeout(self.try_timer)
	}

	if (tcp_sockets.indexOf(self.socket) !== -1) {
		tcp_sockets.splice(tcp_sockets.indexOf(self.socket), 1)
		debug(tcp_sockets.length + ' TCP sockets in use (-1)')
	}
	self.socket.removeAllListeners()
	self.removeAllListeners()
	self.socket.destroy()
}

exports = module.exports = tcp
