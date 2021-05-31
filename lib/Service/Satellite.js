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

const debug = require('debug')('Service/Satellite')
const ServiceTcpBase = require('./TcpBase')
const Protocol = require('../Resources/SatelliteProtocol')

class ServiceSatellite extends ServiceTcpBase {
	constructor(registry) {
		super(registry, 'satellite')

		this.devices = {}
		this.receiveBuffer = Buffer.from('')

		this.port = 37133

		this.init()
	}

	findNewId() {
		let i = 1

		do {
			if (this.devices[i] === undefined) {
				return i
			}
		} while (i++)
	}

	findPackets(client) {
		let header = Protocol.readHeader(client.buffer)

		// not enough data
		if (header === false) {
			return
		}

		// out of sync
		if (header === -1) {
			debug('Out of sync, trying to find next valid packet')
			// Try to find next start of packet
			client.buffer = client.buffer.slice(1)

			// Loop until it is found or we are out of buffer-data
			this.findPackets(client)
			return
		}

		if (header.length + 6 <= client.buffer.length) {
			this.parsePacket(client, header)
			client.buffer = client.buffer.slice(header.length + 6)

			this.findPackets(client)
		}
	}

	handleButton(packet, client) {
		let obj = Protocol.SCMD_BUTTON_PARSER.parse(packet)

		if (this.devices[obj.deviceId] !== undefined) {
			this.system.emit(this.devices[obj.deviceId].id + '_button', obj.keyIndex, obj.state == 1)
		}
	}

	handleVersion(packet, client) {
		let abort = () => {
			client.end()

			for (let key in this.devices) {
				if (this.devices[key].client === client) {
					this.devices.removeDevice(this.devices[key].id)
					this.system.removeAllListeners(this.devices[key].id + '_button')
					delete this.devices[key]
				}
			}

			client.removeAllListeners('data')
			client.removeAllListeners('close')
		}

		let obj = Protocol.SCMD_VERSION_PARSER.parse(packet)

		if (obj.versionMajor > Protocol.SUPPORTED_MAJOR) {
			debug('Too new version on satellite device')
			return abort()
		}

		if (obj.versionMajor == Protocol.SUPPORTED_MAJOR && obj.versionMinior > Protocol.SUPPORTED_MINIOR) {
			debug('Too new version on satellite device')
			return abort()
		}

		obj.versionMajor = Protocol.SUPPORTED_MAJOR
		obj.versionMinior = Protocol.SUPPORTED_MINIOR

		let buffer = Protocol.SCMD_VERSION_PARSER.serialize(obj)
		Protocol.sendPacket(client, Protocol.SCMD_VERSION, buffer)
	}

	initClient(client) {
		client.buffer = Buffer.from('')

		client.on('close', () => {
			for (let key in this.devices) {
				if (this.devices[key].client === client) {
					this.devices.removeDevice(this.devices[key].id)
					this.system.removeAllListeners(this.devices[key].id + '_button')
					delete this.devices[key]
				}
			}

			client.removeAllListeners('data')
			client.removeAllListeners('close')
		})
	}

	newDevice(packet, client) {
		let data = Protocol.SCMD_ADDDEVICE_PARSER.parse(packet)

		const internalId = this.newDeviceInner(data, client)

		// Rewrite packet, and send back as ack
		data.deviceId = internalId
		Protocol.SCMD_ADDDEVICE_PARSER.serialize(data, packet)
		Protocol.sendPacket(client, Protocol.SCMD_ADDDEVICE, packet)
	}

	newDevice2(packet, client) {
		let data = Protocol.SCMD_ADDDEVICE2_PARSER.parse(packet)

		const internalId = this.newDeviceInner(data, client)

		// Rewrite packet, and send back as ack
		data.deviceId = internalId
		Protocol.SCMD_ADDDEVICE2_PARSER.serialize(data, packet)
		Protocol.sendPacket(client, Protocol.SCMD_ADDDEVICE2, packet)
	}

	newDeviceInner(data, client) {
		const internalId = this.findNewId()

		debug('add device: ' + client.remoteAddress, data.serialNumber)

		// Use ip right now, since the pluginUUID is new on each boot and makes Companion
		// forget all settings for the device. (page and orientation)
		const id = 'satellite-' + data.serialNumber

		const existing = Object.entries(this.devices).find(([internalId, dev]) => dev.id === id && dev.client === client)

		if (existing) {
			// Reuse the existing, to avoid duplicates issues
			setImmediate(() => {
				this.system.emit('device_ready', id)
			})
			return existing[0]
		}

		this.devices[internalId] = {
			id: id,
			client: client,
		}

		this.devices.addDevice(
			{ path: id, keysTotal: data.keysTotal, keysPerRow: data.keysPerRow },
			'DeviceSoftwareSatellite'
		)

		setImmediate(() => {
			// Give satellite_device reference to client
			this.system.emit(id + '_satellite_startup', client, internalId)
		})

		return internalId
	}

	parsePacket(client, header) {
		const crc = Protocol.calcCRC(client.buffer.slice(5, 5 + header.length))

		if (crc != client.buffer[5 + header.length]) {
			debug('CRC Error in received packet from ' + client.name)
			return
		}

		let packet = client.buffer.slice(5, 5 + header.length)

		switch (header.command) {
			case Protocol.SCMD_PING:
				Protocol.sendPacket(client, Protocol.SCMD_PONG, [])
				break
			case Protocol.SCMD_VERSION:
				this.handleVersion(packet, client)
				break
			case Protocol.SCMD_ADDDEVICE:
				this.newDevice(packet, client)
				break
			case Protocol.SCMD_ADDDEVICE2:
				this.newDevice2(packet, client)
				break
			case Protocol.SCMD_REMOVEDEVICE:
				this.removeDevice(packet, client)
				break
			case Protocol.SCMD_BUTTON:
				this.handleButton(packet, client)
				break
			default:
				debug('Unknown command in packet: ' + header.command)
		}
	}

	processIncomming(client, data) {
		client.buffer = Buffer.concat([client.buffer, data])

		this.findPackets(client)
	}

	removeDevice(packet, client) {
		let data = Protocol.SCMD_REMOVEDEVICE_PARSER.parse(packet)

		if (this.devices[data.deviceId] !== undefined) {
			this.system.removeAllListeners(this.devices[data.deviceId].id + '_button')
			this.devices.removeDevice(this.devices[data.deviceId].id)
			delete this.devices[data.deviceId]
			delete client.device
		}

		Protocol.sendPacket(client, Protocol.SCMD_REMOVEDEVICE, packet)
	}
}

exports = module.exports = ServiceSatellite
