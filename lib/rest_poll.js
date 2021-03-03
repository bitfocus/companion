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

var debug = require('debug')('lib/rest_poll')
var shortid = require('shortid')

function rest_poll(system) {
	var self = this

	self.running = {}

	system.on('rest_poll', function (instance_id, interval, url, data, poll_obj_cb, result_cb) {
		var poll_id = shortid.generate()

		if (self.running[instance_id] === undefined) {
			self.running[instance_id] = {}
		}

		self.running[instance_id][poll_id] = {
			instance: instance_id,
			id: poll_id,
			interval: interval,
			url: url,
			type: 'post',
			waiting: false,
			data: data,
			result_cb: result_cb,
			timer: setInterval(
				function (instance_id, poll_id) {
					var obj = self.running[instance_id][poll_id]
					if (obj.waiting === true) {
						debug('Skipping this cycle for', poll_id)
					} else {
						system.emit('rest', obj.url, obj.data, function (err, res) {
							debug('got reply for', obj.id, obj.url)
							obj.waiting = false
							obj.result_cb(err, res)
						})
					}
				}.bind(null, instance_id, poll_id),
				interval
			),
		}

		poll_obj_cb(null, self.running[instance_id][poll_id])

		console.log('Rest poll added', self.running)
	})

	system.on('rest_poll_get', function (instance_id, interval, url, poll_obj_cb, result_cb) {
		var poll_id = shortid.generate()

		if (self.running[instance_id] === undefined) {
			self.running[instance_id] = {}
		}

		self.running[instance_id][poll_id] = {
			instance: instance_id,
			id: poll_id,
			type: 'get',
			interval: interval,
			url: url,
			waiting: false,
			result_cb: result_cb,
			timer: setInterval(
				function (instance_id, poll_id) {
					var obj = self.running[instance_id][poll_id]
					if (obj.waiting === true) {
						debug('Skipping this cycle for', poll_id)
					} else {
						system.emit('rest_get', obj.url, function (err, res) {
							debug('got reply for', obj.id, obj.url)
							obj.waiting = false
							obj.result_cb(err, res)
						})
					}
				}.bind(null, instance_id, poll_id),
				interval
			),
		}

		poll_obj_cb(null, self.running[instance_id][poll_id])

		console.log('Rest poll added', self.running)
	})

	system.on('rest_poll_destroy', function (instance_id) {
		debug('Clearing poll intervals for', instance_id)
		if (self.running[instance_id] !== undefined) {
			for (var poll_id in self.running[instance_id]) {
				var poll = self.running[instance_id][poll_id]
				if (poll.timer !== undefined) {
					debug('Killing interval for', poll.instance, poll.url)
					clearInterval(poll.timer)
					delete self.running[instance_id][poll_id]
				}
			}
		}
	})

	return self
}

exports = module.exports = function (system) {
	return new rest_poll(system)
}
