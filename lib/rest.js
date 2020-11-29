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

class REST {

	constructor(instanceId) {
		this.instanceId = instanceId
		this.running    = {};
	}

	deletePolls() {
		debug("Clearing REST polls", this.instanceId);

		for (var pollId in this.running) {
			var poll = this.running[pollId];

			if (poll.timer !== undefined) {
				debug("Killing interval for ",poll.url);
				clearInterval(poll.timer);
				delete this.running[pollId];
			}
		}
	}

	static get(url, cb, extraHeaders, extraArgs) {
		debug('making request:', url);

		var client = new Client(extraArgs);

		var args = {
			headers: { "Content-Type": "application/json" }
		};

		if (extraHeaders !== undefined) {
			for (var header in extraHeaders) {
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
			this.system.emit('log', 'rest', 'debug', 'REST GET error: ' + e);
		}
	}

	static post(url, data, cb, extraHeaders, extraArgs) {
		debug('making request:', url, data);

		var client = new Client(extraArgs);

		var args = {
			data: data,
			headers: { "Content-Type": "application/json" }
		};

		if (extraHeaders !== undefined) {
			for (var header in extraHeaders) {
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
			this.system.emit('log', 'rest', 'debug', 'REST POST error: ' + e);
		}
	}

	static put(url, data, cb, extraHeaders, extraArgs) {
		debug('making request:', url, data);

		var client = new Client(extraArgs);

		var args = {
			data: data,
			headers: { "Content-Type": "application/json" }
		};

		if (extraHeaders !== undefined) {
			for (var header in extraHeaders) {
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
			this.system.emit('log', 'rest', 'debug', 'REST PUT error: ' + e);
		}
	}

	setgetPoll(interval, url, pollObjCb, resultCb) {
		var pollId = shortid.generate();

		this.running[pollId] = {
			instance: this.instanceId,
			id: pollId,
			type: 'get',
			interval: interval,
			url: url,
			waiting: false,
			resultCb: resultCb,
			timer: setInterval((pollId) => {
				var obj = this.running[pollId];
				if (obj.waiting === true) {
					debug("Skipping this cycle for",pollId);
				}
				else {
					REST.get(obj.url, (err, res) => {
						debug("got reply for",obj.id,obj.url);
						obj.waiting = false;
						obj.resultCb(err, res);
					});
				}
			}, interval)
		};

		pollObjCb(null, this.running[pollId]);

		console.log("Rest poll added", this.running);
	}

	setPostPoll(interval, url, data, pollObjCb, resultCb) {
		var pollId = shortid.generate();

		this.running[pollId] = {
			instance: this.instanceId,
			id: pollId,
			interval: interval,
			url: url,
			type: 'post',
			waiting: false,
			data: data,
			resultCb: resultCb,
			timer: setInterval((pollId) => {
				var obj = this.running[pollId];
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

		pollObjCb(null, this.running[pollId]);

		console.log("Rest poll added", this.running);
	}
}

exports = module.exports = REST;