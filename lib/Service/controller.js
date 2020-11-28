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

var ApiServer        = require('./api');
var ArtnetServer     = require('./artnet');
var EmberPlusServer  = require('./emberplus');
var OscServer        = require('./osc');
var RosstalkServer   = require('./rosstalk');
var SatelliteServer  = require('./Satellite/server');
var TcpServer        = require('./tcp');
var UdpServer        = require('./udp');
var WebSocketsApi    = require('./ws_api');

class Registry {

	constructor(registry) {
		this.registry = registry;
		debug('launching service controller');

		this.osc              = new OscServer(this.registry);
		this.server_api       = new ApiServer(this.registry);
		this.server_tcp       = new TcpServer(this.registry);
		this.server_udp       = new UdpServer(this.registry);
		this.server_emberplus = new EmberPlusServer(this.registry);
		this.artnet           = new ArtnetServer(this.registry);
		this.rosstalk         = new RosstalkServer(this.registry);
		this.satellite        = new SatelliteServer(this.registry);
		this.ws_api           = new WebSocketsApi(this.registry);
	}
}

exports = module.exports = Registry