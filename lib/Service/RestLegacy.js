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

const debug    = require('debug')('lib/Service/RestLegacy');
const CoreBase = require('../Core/Base');
const Client   = require('node-rest-client').Client;
const shortid  = require('shortid');

class ServiceRestLegacy extends CoreBase {

	constructor(registry) {
		super(registry, 'rest');

		this.running = {};

		this.system.on('rest_get', this.get.bind(this));
		this.system.on('rest',     this.post.bind(this));
		this.system.on('rest_put', this.put.bind(this));

		this.system.on('rest_poll', this.setPostPoll.bind(this));
		this.system.on('rest_poll_get', this.setgetPoll.bind(this));
		this.system.on('rest_poll_destroy', this.deletePollsByInstance.bind(this));
	}

	deletePollsByInstance(instanceId) {
		debug("Clearing poll intervals for",instanceId);

		if (this.running[instanceId] !== undefined) {
			for (let pollId in this.running[instanceId]) {
				let poll = this.running[instanceId][pollId];

				if (poll.timer !== undefined) {
					debug("Killing interval for",poll.instance,poll.url);
					clearInterval(poll.timer);
					delete this.running[instanceId][pollId];
				}
			}
		}
	}

	get(url, cb, extraHeaders, extraArgs) {
		debug('making request:', url);

		const client = new Client(extraArgs);

		const args = {
			headers: { "Content-Type": "application/json" }
		};

		if (extraHeaders !== undefined) {
			for (let header in extraHeaders) {
				args.headers[header] = extraHeaders[header];
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
			this.log('debug', 'REST GET error: ' + e);
		}
	}

	post(url, data, cb, extraHeaders, extraArgs) {
		debug('making request:', url, data);

		const client = new Client(extraArgs);

		const args = {
			data: data,
			headers: { "Content-Type": "application/json" }
		};

		if (extraHeaders !== undefined) {
			for (let header in extraHeaders) {
				args.headers[header] = extraHeaders[header];
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
			this.log('debug', 'REST POST error: ' + e);
		}
	}

	put(url, data, cb, extraHeaders, extraArgs) {
		debug('making request:', url, data);

		const client = new Client(extraArgs);

		const args = {
			data: data,
			headers: { "Content-Type": "application/json" }
		};

		if (extraHeaders !== undefined) {
			for (let header in extraHeaders) {
				args.headers[header] = extraHeaders[header];
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
			this.log('debug', 'REST PUT error: ' + e);
		}
	}

	setgetPoll(instanceId, interval, url, pollObjCb, resultCb) {
		const pollId = shortid.generate();

		if (this.running[instanceId] === undefined) {
			this.running[instanceId] = {};
		}

		this.running[instanceId][pollId] = {
			instance: instanceId,
			id: pollId,
			type: 'get',
			interval: interval,
			url: url,
			waiting: false,
			resultCb: resultCb,
			timer: setInterval((instanceId, pollId) => {
				let obj = this.running[instanceId][pollId];
				if (obj.waiting === true) {
					debug("Skipping this cycle for",pollId);
				}
				else {
					this.get(obj.url, (err, res) => {
						debug("got reply for",obj.id,obj.url);
						obj.waiting = false;
						obj.resultCb(err, res);
					});
				}
			}, interval)
		};

		pollObjCb(null, this.running[instanceId][pollId]);

		console.log("Rest poll added", this.running);
	}

	setPostPoll(instanceId, interval, url, data, pollObjCb, resultCb) {
		const pollId = shortid.generate();

		if (this.running[instanceId] === undefined) {
			this.running[instanceId] = {};
		}

		this.running[instanceId][pollId] = {
			instance: instanceId,
			id: pollId,
			interval: interval,
			url: url,
			type: 'post',
			waiting: false,
			data: data,
			resultCb: resultCb,
			timer: setInterval((instanceId, pollId) => {
				let obj = this.running[instanceId][pollId];
				if (obj.waiting === true) {
					debug("Skipping this cycle for",pollId);
				}
				else {
					this.post(obj.url, obj.data, (err, res) => {
						debug("got reply for",obj.id,obj.url);
						obj.waiting = false;
						obj.resultCb(err, res);
					});
				}
			}, interval)
		};

		pollObjCb(null, this.running[instanceId][pollId]);

		console.log("Rest poll added", this.running);
	}
}

exports = module.exports = ServiceRestLegacy;