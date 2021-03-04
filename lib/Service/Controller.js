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

const debug = require('debug')('lib/Service/Controller')

const ServiceApi = require('./Api')
const ServiceArtnet = require('./Artnet')
const ServiceEmberPlus = require('./EmberPlus')
const ServiceOsc = require('./Osc')
const ServiceRestLegacy = require('./RestLegacy')
const ServiceRosstalk = require('./Rosstalk')
const ServiceSatellite = require('./Satellite')
const ServiceTcp = require('./Tcp')
const ServiceUdp = require('./Udp')
const ServiceWebSockets = require('./WebSockets')

class ServiceController {
	constructor(registry) {
		this.registry = registry
		debug('launching service controller')

		this.osc = new ServiceOsc(this.registry)
		this.api = new ServiceApi(this.registry)
		this.tcp = new ServiceTcp(this.registry, this.api)
		this.udp = new ServiceUdp(this.registry, this.api)
		this.emberplus = new ServiceEmberPlus(this.registry)
		this.artnet = new ServiceArtnet(this.registry)
		this.rosstalk = new ServiceRosstalk(this.registry)
		this.satellite = new ServiceSatellite(this.registry)
		this.websockets = new ServiceWebSockets(this.registry)
		this.rest = new ServiceRestLegacy(this.registry)
	}
}

exports = module.exports = ServiceController
