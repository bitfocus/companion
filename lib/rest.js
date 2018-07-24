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

var debug   = require('debug')('lib/rest');
var Client  = require('node-rest-client').Client;

function rest(system) {
	var self = this;
	self.system = system;

	system.on('rest_get', function(url, cb) {

		debug('making request:', url);

		var client = new Client();

		var args = {
				headers: { "Content-Type": "application/json" }
		};

		client.get(url, function (data, response) {
			debug('success response:', data, response);
			cb(null, { data: data, response: response });
		}).on('error', function(error) {
			debug('error response:', error);
			cb(true, { error: error });
		});

	});

	system.on('rest', function(url, data, cb) {

		debug('making request:', url, data);

		var client = new Client();

		var args = {
				data: data,
				headers: { "Content-Type": "application/json" }
		};

		client.post(url, args, function (data, response) {
			debug('success response:', data, response);
			cb(null, { data: data, response: response });
		}).on('error', function(error) {
			debug('error response:', error);
			cb(true, { error: error });
		});

	});

	return self;
}

exports = module.exports = function (system) {
	return new rest(system);
};
