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

var debug = require('debug')('lib/telnet')
var Stream = require('stream')
var Transform = Stream.Transform
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var net = require('net')

var tcp_sockets = []

const NULL = 0
const DATA = 0
const SE = 240
const SB = 250
const WILL = 251
const WONT = 252
const DO = 253
const DONT = 254
const IAC = 255

var reverse = {
	240: 'SE',
	250: 'SB',
	251: 'WILL',
	252: 'WONT',
	253: 'DO',
	254: 'DONT',
	255: 'IAC',
}

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

function telnetStreamer(host, port, options) {
	var self = this
	if (!(this instanceof telnetStreamer)) return new telnetStreamer(options)

	self._options = options = options || {}
	self.ts = new telnetStream(options)
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

	self.ts = new telnetStream()

	self.socket = new net.Socket()
	self.socket.setKeepAlive(true)
	self.socket.setNoDelay(true)

	self.socket.pipe(self.ts)

	debug('new telnet instance for sending to ' + host)

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

	self.socket.on('connect', function () {
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

	self.ts.on('iac', self.emit.bind(self, 'iac'))
	self.ts.on('sb', self.emit.bind(self, 'sb'))
	self.ts.on('data', self.emit.bind(self, 'data'))
	self.ts.on('drain', self.emit.bind(self, 'drain'))

	tcp_sockets.push(self.socket)
	debug(tcp_sockets.length + ' TCP sockets in use (+1)')

	// Let caller install event handlers first
	setImmediate(self.connect.bind(self))

	return self
}
inherits(telnetStreamer, EventEmitter)

telnetStreamer.prototype.write = telnetStreamer.prototype.send = function (message, cb) {
	var self = this

	if (self.connected) {
		debug('sending ' + (message !== undefined ? message.length : 'undefined') + ' bytes to', self.host, self.port)

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

		return true
	} else {
		debug('Tried to send, but not connected')
		return false
	}
}

telnetStreamer.prototype.connect = function (port, host, options) {
	var self = this

	options = options || {}
	if (self.trying) {
		return
	}

	try {
		debug('new conn')
		self.trying = true
		self.socket.connect(self.port, self.host)
	} catch (e) {
		console.log('TELNET: ', e)
	}
}

telnetStreamer.prototype.destroy = function () {
	var self = this

	if (self.try_timer !== undefined) {
		clearTimeout(self.try_timer)
	}

	if (tcp_sockets.indexOf(self.socket) !== -1) {
		tcp_sockets.splice(tcp_sockets.indexOf(self.socket), 1)
		debug(tcp_sockets.length + ' telnet sockets in use (-1)')
	}
	self.socket.removeAllListeners()
	self.ts.removeAllListeners()
	self.removeAllListeners()
	self.ts.destroy()
	self.socket.destroy()
}

/*
 * TelnetStream
 */

function telnetStream(options) {
	this._options = options = options || {}

	this.buffer = Buffer.from('')
	this.subbuffer = Buffer.from('')
	this.state = DATA

	debug('new telnetStreamer(', options, ')')

	Transform.call(this, options)
}
inherits(telnetStream, Transform)

telnetStream.prototype._transform = function _transform(obj, encoding, callback) {
	for (var i = 0; i < obj.length; ++i) {
		this._handleByte(obj[i])
	}

	var data = this._getData()
	if (data.length) {
		this.push(data)
	}

	callback()
}

telnetStream.prototype._handleByte = function (byte) {
	var self = this

	if (self.state === DATA) {
		if (byte === IAC) {
			self.state = IAC
			return
		}

		self.buffer = Buffer.concat([self.buffer, Buffer.from([byte])])
	} else if (self.state === IAC) {
		switch (byte) {
			case SB:
			case WILL:
			case WONT:
			case DO:
			case DONT:
				self.state = byte
				break

			default:
				self.state = DATA
				break
		}
	} else if (self.state >= WILL && self.state <= DONT) {
		self.emit('iac', reverse[self.state], byte)

		self.state = DATA
		return
	} else if (self.state === SB) {
		if (byte === SE) {
			self.emit('sb', self.subbuffer)
			self.state = DATA
			self.subbuffer = Buffer.from('')
			return
		}

		self.subbuffer = Buffer.concat([self.subbuffer, Buffer.from([byte])])
	}
}

telnetStream.prototype._getData = function (arguments) {
	var self = this
	var buff = self.buffer

	self.buffer = Buffer.from('')

	return buff
}

module.exports = telnetStreamer
