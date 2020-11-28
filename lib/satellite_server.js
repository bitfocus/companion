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
var debug    = require('debug')('lib/satellite_server');
var net      = require('net');
var protocol = require('./satellite_protocol');

class satellite_server {

	constructor(system) {

		this.ready = true;
		this.system = system;
		this.clients = [];
		this.devices = {};

		this.elgatoDM = require('./elgato_dm')(system);

		this.server = net.createServer((socket) => {
			socket.name = socket.remoteAddress + ":" + socket.remotePort;

			this.initSocket(socket);
		});
		this.server.on('error', (e) => {
			debug("listen-socket error: ", e);
		});

		try {
			this.server.listen(37133);
		}
		catch (e) {
			debug('ERROR opening port 37133 for companion satellite devices');
		}
	}

	findNewId() {
		var i = 1;

		do {
			if (this.devices[i] === undefined) {
				return i;
			}
		} while (i++);
	}

	findPackets(socket) {
		var header = protocol.readHeader(socket.buffer);

		// not enough data
		if (header === false) {
			return;
		}

		// out of sync
		if (header === -1) {
			debug('Out of sync, trying to find next valid packet');
			// Try to find next start of packet
			socket.buffer = socket.buffer.slice(1);

			// Loop until it is found or we are out of buffer-data
			this.findPackets(socket);
			return;
		}

		if (header.length + 6 <= socket.buffer.length) {
			this.parsePacket(socket, header);
			socket.buffer = socket.buffer.slice(header.length + 6);

			this.findPackets(socket);
		}
	}

	handleButton(packet, socket) {
		var obj = protocol.SCMD_BUTTON_PARSER.parse(packet);

		if (this.devices[obj.deviceId] !== undefined) {
			this.system.emit(this.devices[obj.deviceId].id + '_button', obj.keyIndex, obj.state == 1);
		}
	}

	handleVersion(packet, socket) {

		let abort = () => {
			socket.end();

			for (var key in this.devices) {
				if (this.devices[key].socket === socket) {
					this.elgatoDM.removeDevice(this.devices[key].id);
					this.system.removeAllListeners(this.devices[key].id + '_button');
					delete this.devices[key];
				}
			}

			socket.removeAllListeners('data');
			socket.removeAllListeners('close');
		}

		var obj = protocol.SCMD_VERSION_PARSER.parse(packet);

		if (obj.versionMajor > protocol.SUPPORTED_MAJOR) {
			debug('Too new version on satellite device');
			return abort();
		}

		if (obj.versionMajor == protocol.SUPPORTED_MAJOR && obj.versionMinior > protocol.SUPPORTED_MINIOR) {
			debug('Too new version on satellite device');
			return abort();
		}

		obj.versionMajor = protocol.SUPPORTED_MAJOR;
		obj.versionMinior = protocol.SUPPORTED_MINIOR;

		var buffer = protocol.SCMD_VERSION_PARSER.serialize(obj);
		protocol.sendPacket(socket, protocol.SCMD_VERSION, buffer);
	}

	initSocket(socket) {
		debug('new connection from ' + socket.name);

		socket.buffer = new Buffer('');

		socket.on('data', (data) => {
			socket.buffer = Buffer.concat([ socket.buffer, data ]);

			this.findPackets(socket);
		});

		socket.on('error', (e) => {
			debug('socket error:', e);
		});

		socket.on('close', () => {
			for (var key in this.devices) {
				if (this.devices[key].socket === socket) {
					this.elgatoDM.removeDevice(this.devices[key].id);
					this.system.removeAllListeners(this.devices[key].id + '_button');
					delete this.devices[key];
				}
			}

			socket.removeAllListeners('data');
			socket.removeAllListeners('close');
		});
	}

	newDevice(packet, socket) {
		var data = protocol.SCMD_ADDDEVICE_PARSER.parse(packet);

		var internalId = this.newDevice_inner(data, socket)

		// Rewrite packet, and send back as ack
		data.deviceId = internalId;
		protocol.SCMD_ADDDEVICE_PARSER.serialize(data, packet);
		protocol.sendPacket(socket, protocol.SCMD_ADDDEVICE, packet);
	}

	newDevice2(packet, socket) {
		var data = protocol.SCMD_ADDDEVICE2_PARSER.parse(packet);

		var internalId = this.newDevice_inner(data, socket)

		// Rewrite packet, and send back as ack
		data.deviceId = internalId;
		protocol.SCMD_ADDDEVICE2_PARSER.serialize(data, packet);
		protocol.sendPacket(socket, protocol.SCMD_ADDDEVICE2, packet);
	}


	newDevice_inner(data, socket) {
		var internalId = this.findNewId();

		debug('add device: ' + socket.remoteAddress, data.serialNumber);

		// Use ip right now, since the pluginUUID is new on each boot and makes Companion
		// forget all settings for the device. (page and orientation)
		var id = 'satellite-' + data.serialNumber;

		const existing = Object.entries(this.devices).find(([internalId, dev]) => dev.id === id && dev.socket === socket)

		if (existing) {
			// Reuse the existing, to avoid duplicates issues
			setImmediate(() => {
				this.system.emit('elgato_ready', id);
			})
			return existing[0]
		}

		this.devices[internalId] = {
			id: id,
			socket: socket
		};

		this.elgatoDM.addDevice({ path: id, keysTotal: data.keysTotal, keysPerRow: data.keysPerRow }, 'satellite_device');

		setImmediate(() => {
			// Give satellite_device reference to socket
			this.system.emit(id + '_satellite_startup', socket, internalId);
		})

		return internalId
	}

	parsePacket(socket, header) {
		var crc = protocol.calcCRC(socket.buffer.slice(5, 5 + header.length));

		if (crc != socket.buffer[5 + header.length]) {
			debug('CRC Error in received packet from ' + socket.name);
			return;
		}

		var packet = socket.buffer.slice(5, 5 + header.length);

		switch (header.command) {
			case protocol.SCMD_PING:
				protocol.sendPacket(socket, protocol.SCMD_PONG, []);
				break;
			case protocol.SCMD_VERSION:
				this.handleVersion(packet, socket);
				break;
			case protocol.SCMD_ADDDEVICE:
				this.newDevice(packet, socket);
				break;
			case protocol.SCMD_ADDDEVICE2:
				this.newDevice2(packet, socket);
				break;
			case protocol.SCMD_REMOVEDEVICE:
				this.removeDevice(packet, socket);
				break;
			case protocol.SCMD_BUTTON:
				this.handleButton(packet, socket);
				break;
			default:
				debug('Unknown command in packet: ' + header.command);
		}
	}

	removeDevice(packet, socket) {
		var data = protocol.SCMD_REMOVEDEVICE_PARSER.parse(packet);

		if (this.devices[data.deviceId] !== undefined) {
			this.system.removeAllListeners(this.devices[data.deviceId].id + '_button');
			this.elgatoDM.removeDevice(this.devices[data.deviceId].id);
			delete this.devices[data.deviceId];
			delete socket.device;
		}

		protocol.sendPacket(socket, protocol.SCMD_REMOVEDEVICE, packet);
	}
}

exports = module.exports = function (system) {
	return new satellite_server(system);
};
