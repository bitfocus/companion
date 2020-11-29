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
var shortid = require('shortid');

class ServiceRestLegacy {

	constructor(registry) {
		this.registry = registry
		this.system = this.registry.system;

		this.running = {};

		this.system.on('rest_get', this.get.bind(this));
		this.system.on('rest',     this.post.bind(this));
		this.system.on('rest_put', this.put.bind(this));

		this.system.on('rest_poll', this.setPostPoll.bind(this));
		this.system.on('rest_poll_get', this.setgetPoll.bind(this));
		this.system.on('rest_poll_destroy', this.deletePollsByInstance.bind(this));
	}

	deletePollsByInstance(instance_id) {
		debug("Clearing poll intervals for",instance_id);

		if (this.running[instance_id] !== undefined) {
			for (var poll_id in this.running[instance_id]) {
				var poll = this.running[instance_id][poll_id];

				if (poll.timer !== undefined) {
					debug("Killing interval for",poll.instance,poll.url);
					clearInterval(poll.timer);
					delete this.running[instance_id][poll_id];
				}
			}
		}
	}

	get(url, cb, extra_headers, extra_args) {
		debug('making request:', url);

		var client = new Client(extra_args);

		var args = {
			headers: { "Content-Type": "application/json" }
		};

		if (extra_headers !== undefined) {
			for (var header in extra_headers) {
				args.headers[header] = extra_headers[header];
			}
		}

		try {
			client.get(url, args, (data, response) => {
				cb(null, { data: data, response: response });
			}).on('error', (error) => {
				debug('error response:', error);
				cb(true, { error: error });
			});
		}
		catch(e) {
			this.system.emit('log', 'rest', 'debug', 'REST GET error: ' + e);
		}
	}

	post(url, data, cb, extra_headers, extra_args) {
		debug('making request:', url, data);

		var client = new Client(extra_args);

		var args = {
			data: data,
			headers: { "Content-Type": "application/json" }
		};

		if (extra_headers !== undefined) {
			for (var header in extra_headers) {
				args.headers[header] = extra_headers[header];
			}
		}

		try {
			client.post(url, args, (data, response) => {
				cb(null, { data: data, response: response });
			}).on('error', (error) => {
				debug('error response:', error);
				cb(true, { error: error });
			});
		}
		catch(e) {
			this.system.emit('log', 'rest', 'debug', 'REST POST error: ' + e);
		}
	}

	put(url, data, cb, extra_headers, extra_args) {
		debug('making request:', url, data);

		var client = new Client(extra_args);

		var args = {
			data: data,
			headers: { "Content-Type": "application/json" }
		};

		if (extra_headers !== undefined) {
			for (var header in extra_headers) {
				args.headers[header] = extra_headers[header];
			}
		}

		try {
			client.put(url, args, (data, response) => {
				cb(null, { data: data, response: response });
			}).on('error', (error) => {
				debug('error response:', error);
				cb(true, { error: error });
			});
		}
		catch(e) {
			this.system.emit('log', 'rest', 'debug', 'REST PUT error: ' + e);
		}
	}

	setgetPoll(instance_id, interval, url, poll_obj_cb, result_cb) {
		var poll_id = shortid.generate();

		if (this.running[instance_id] === undefined) {
			this.running[instance_id] = {};
		}

		this.running[instance_id][poll_id] = {
			instance: instance_id,
			id: poll_id,
			type: 'get',
			interval: interval,
			url: url,
			waiting: false,
			result_cb: result_cb,
			timer: setInterval((instance_id, poll_id) => {
				var obj = this.running[instance_id][poll_id];
				if (obj.waiting === true) {
					debug("Skipping this cycle for",poll_id);
				}
				else {
					this.get(obj.url, (err, res) => {
						debug("got reply for",obj.id,obj.url);
						obj.waiting = false;
						obj.result_cb(err, res);
					});
				}
			}, interval)
		};

		poll_obj_cb(null, this.running[instance_id][poll_id]);

		console.log("Rest poll added", this.running);
	}

	setPostPoll(instance_id, interval, url, data, poll_obj_cb, result_cb) {
		var poll_id = shortid.generate();

		if (this.running[instance_id] === undefined) {
			this.running[instance_id] = {};
		}

		this.running[instance_id][poll_id] = {
			instance: instance_id,
			id: poll_id,
			interval: interval,
			url: url,
			type: 'post',
			waiting: false,
			data: data,
			result_cb: result_cb,
			timer: setInterval((instance_id, poll_id) => {
				var obj = this.running[instance_id][poll_id];
				if (obj.waiting === true) {
					debug("Skipping this cycle for",poll_id);
				}
				else {
					this.post(obj.url, obj.data, (err, res) => {
						debug("got reply for",obj.id,obj.url);
						obj.waiting = false;
						obj.result_cb(err, res);
					});
				}
			}, interval)
		};

		poll_obj_cb(null, this.running[instance_id][poll_id]);

		console.log("Rest poll added", this.running);
	}
}

exports = module.exports = ServiceRestLegacy;