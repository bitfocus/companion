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

var debug   = require('debug')('lib/Service/controller');

var ServiceApi        = require('./api');
var ServiceArtnet     = require('./artnet');
var ServiceEmberPlus  = require('./emberplus');
var ServiceOsc        = require('./osc');
var ServiceRestLegacy = require('./rest-legacy');
var ServiceRosstalk   = require('./rosstalk');
var ServiceSatellite  = require('./satellite');
var ServiceTcp        = require('./tcp');
var ServiceUdp        = require('./udp');
var ServiceWebSockets = require('./websockets');

class ServiceController {

	constructor(registry) {
		this.registry = registry;
		debug('launching service controller');

		this.osc              = new ServiceOsc(this.registry);
		this.api              = new ServiceApi(this.registry);
		this.tcp              = new ServiceTcp(this.registry, this.api);
		this.udp              = new ServiceUdp(this.registry, this.api);
		this.emberplus        = new ServiceEmberPlus(this.registry);
		this.artnet           = new ServiceArtnet(this.registry);
		this.rosstalk         = new ServiceRosstalk(this.registry);
		this.satellite        = new ServiceSatellite(this.registry);
		this.websockets       = new ServiceWebSockets(this.registry);
		this.rest             = new ServiceRestLegacy(this.registry);
	}
}

exports = module.exports = ServiceController