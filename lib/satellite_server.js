/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: Håkon Nessjøen <haakon@bitfocus.io>, William Viker <william@bitfocus.io>
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
var system
var debug = require('debug')('lib/satellite_server')
var net = require('net')
var protocol = require('./satellite_protocol')

var elgatoDM

function satelliteServer(_system) {
	var self = this

	self.ready = true
	self.system = system = _system
	self.clients = []
	self.devices = {}

	elgatoDM = require('./elgato_dm')(system)

	self.server = net.createServer(function (socket) {
		socket.name = socket.remoteAddress + ':' + socket.remotePort

		self.initSocket(socket)
	})
	self.server.on('error', function (e) {
		debug('listen-socket error: ', e)
	})

	try {
		self.server.listen(37133)
	} catch (e) {
		debug('ERROR opening port 37133 for companion satellite devices')
	}
}

satelliteServer.prototype.initSocket = function (socket) {
	var self = this
	debug('new connection from ' + socket.name)

	socket.buffer = Buffer.from('')

	socket.on('data', function (data) {
		socket.buffer = Buffer.concat([socket.buffer, data])

		self.findPackets(socket)
	})

	socket.on('error', function (e) {
		debug('socket error:', e)
	})

	socket.on('close', function () {
		for (var key in self.devices) {
			if (self.devices[key].socket === socket) {
				elgatoDM.removeDevice(self.devices[key].id)
				system.removeAllListeners(self.devices[key].id + '_button')
				delete self.devices[key]
			}
		}

		socket.removeAllListeners('data')
		socket.removeAllListeners('close')
	})
}

satelliteServer.prototype.findPackets = function (socket) {
	var self = this

	var header = protocol.readHeader(socket.buffer)

	// not enough data
	if (header === false) {
		return
	}

	// out of sync
	if (header === -1) {
		debug('Out of sync, trying to find next valid packet')
		// Try to find next start of packet
		socket.buffer = socket.buffer.slice(1)

		// Loop until it is found or we are out of buffer-data
		self.findPackets(socket)
		return
	}

	if (header.length + 6 <= socket.buffer.length) {
		self.parsePacket(socket, header)
		socket.buffer = socket.buffer.slice(header.length + 6)

		self.findPackets(socket)
	}
}

satelliteServer.prototype.parsePacket = function (socket, header) {
	var self = this
	var crc = protocol.calcCRC(socket.buffer.slice(5, 5 + header.length))

	if (crc != socket.buffer[5 + header.length]) {
		debug('CRC Error in received packet from ' + socket.name)
		return
	}

	var packet = socket.buffer.slice(5, 5 + header.length)

	switch (header.command) {
		case protocol.SCMD_PING:
			protocol.sendPacket(socket, protocol.SCMD_PONG, [])
			break

		case protocol.SCMD_VERSION:
			self.handleVersion(packet, socket)
			break

		case protocol.SCMD_ADDDEVICE:
			self.newDevice(packet, socket)
			break

		case protocol.SCMD_ADDDEVICE2:
			self.newDevice2(packet, socket)
			break

		case protocol.SCMD_REMOVEDEVICE:
			self.removeDevice(packet, socket)
			break

		case protocol.SCMD_BUTTON:
			self.handleButton(packet, socket)
			break

		default:
			debug('Unknown command in packet: ' + header.command)
	}
}

satelliteServer.prototype.handleVersion = function (packet, socket) {
	var self = this

	function abort() {
		socket.end()

		for (var key in self.devices) {
			if (self.devices[key].socket === socket) {
				elgatoDM.removeDevice(self.devices[key].id)
				system.removeAllListeners(self.devices[key].id + '_button')
				delete self.devices[key]
			}
		}

		socket.removeAllListeners('data')
		socket.removeAllListeners('close')
	}

	var obj = protocol.SCMD_VERSION_PARSER.parse(packet)
	if (obj.versionMajor > protocol.SUPPORTED_MAJOR) {
		debug('Too new version on satellite device')
		return abort()
	}
	if (obj.versionMajor == protocol.SUPPORTED_MAJOR && obj.versionMinior > protocol.SUPPORTED_MINIOR) {
		debug('Too new version on satellite device')
		return abort()
	}

	obj.versionMajor = protocol.SUPPORTED_MAJOR
	obj.versionMinior = protocol.SUPPORTED_MINIOR

	var buffer = protocol.SCMD_VERSION_PARSER.serialize(obj)
	protocol.sendPacket(socket, protocol.SCMD_VERSION, buffer)
}

satelliteServer.prototype.handleButton = function (packet, socket) {
	var self = this

	var obj = protocol.SCMD_BUTTON_PARSER.parse(packet)

	if (self.devices[obj.deviceId] !== undefined) {
		self.system.emit(self.devices[obj.deviceId].id + '_button', obj.keyIndex, obj.state == 1)
	}
}

satelliteServer.prototype.findNewId = function () {
	var self = this
	var i = 1

	do {
		if (self.devices[i] === undefined) {
			return i
		}
	} while (i++)
}

satelliteServer.prototype.removeDevice = function (packet, socket) {
	var self = this

	var data = protocol.SCMD_REMOVEDEVICE_PARSER.parse(packet)

	if (self.devices[data.deviceId] !== undefined) {
		self.system.removeAllListeners(self.devices[data.deviceId].id + '_button')
		elgatoDM.removeDevice(self.devices[data.deviceId].id)
		delete self.devices[data.deviceId]
		delete socket.device
	}

	protocol.sendPacket(socket, protocol.SCMD_REMOVEDEVICE, packet)
}

satelliteServer.prototype.newDevice = function (packet, socket) {
	var self = this

	var data = protocol.SCMD_ADDDEVICE_PARSER.parse(packet)

	var internalId = self.newDevice_inner(data, socket)

	// Rewrite packet, and send back as ack
	data.deviceId = internalId
	protocol.SCMD_ADDDEVICE_PARSER.serialize(data, packet)
	protocol.sendPacket(socket, protocol.SCMD_ADDDEVICE, packet)
}

satelliteServer.prototype.newDevice2 = function (packet, socket) {
	var self = this

	var data = protocol.SCMD_ADDDEVICE2_PARSER.parse(packet)

	var internalId = self.newDevice_inner(data, socket)

	// Rewrite packet, and send back as ack
	data.deviceId = internalId
	protocol.SCMD_ADDDEVICE2_PARSER.serialize(data, packet)
	protocol.sendPacket(socket, protocol.SCMD_ADDDEVICE2, packet)
}

satelliteServer.prototype.newDevice_inner = function (data, socket) {
	var self = this

	var internalId = self.findNewId()

	debug('add device: ' + socket.remoteAddress, data.serialNumber)

	// Use ip right now, since the pluginUUID is new on each boot and makes Companion
	// forget all settings for the device. (page and orientation)
	var id = 'satellite-' + data.serialNumber

	const existing = Object.entries(self.devices).find(([internalId, dev]) => dev.id === id && dev.socket === socket)
	if (existing) {
		// Reuse the existing, to avoid duplicates issues
		setImmediate(() => {
			system.emit('elgato_ready', id)
		})
		return existing[0]
	}

	self.devices[internalId] = {
		id: id,
		socket: socket,
	}

	elgatoDM.addDevice({ path: id, keysTotal: data.keysTotal, keysPerRow: data.keysPerRow }, 'satellite_device')

	setImmediate(() => {
		// Give satellite_device reference to socket
		system.emit(id + '_satellite_startup', socket, internalId)
	})

	return internalId
}

exports = module.exports = function (_system) {
	return new satelliteServer(_system)
}
