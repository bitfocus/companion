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

const shortid = require('shortid')

exports = module.exports = function (system) {
	return new ServiceRestPoll(system)
}

class ServiceRestPoll {
	debug = require('debug')('lib/Service/RestPoll')

	constructor(system) {
		this.system = system
		this.running = {}

		this.system.on('rest_poll', (instance_id, interval, url, data, poll_obj_cb, result_cb) => {
			const poll_id = shortid.generate()

			if (this.running[instance_id] === undefined) {
				this.running[instance_id] = {}
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
					let obj = this.running[instance_id][poll_id]
					if (obj.waiting === true) {
						this.debug('Skipping this cycle for', poll_id)
					} else {
						this.system.emit('rest', obj.url, obj.data, (err, res) => {
							this.debug('got reply for', obj.id, obj.url)
							obj.waiting = false
							obj.result_cb(err, res)
						})
					}
				}, interval),
			}

			poll_obj_cb(null, this.running[instance_id][poll_id])

			console.log('Rest poll added', this.running)
		})

		this.system.on('rest_poll_get', (instance_id, interval, url, poll_obj_cb, result_cb) => {
			const poll_id = shortid.generate()

			if (this.running[instance_id] === undefined) {
				this.running[instance_id] = {}
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
					let obj = this.running[instance_id][poll_id]
					if (obj.waiting === true) {
						this.debug('Skipping this cycle for', poll_id)
					} else {
						this.system.emit('rest_get', obj.url, (err, res) => {
							this.debug('got reply for', obj.id, obj.url)
							obj.waiting = false
							obj.result_cb(err, res)
						})
					}
				}, interval),
			}

			poll_obj_cb(null, this.running[instance_id][poll_id])

			console.log('Rest poll added', this.running)
		})

		this.system.on('rest_poll_destroy', (instance_id) => {
			this.debug('Clearing poll intervals for', instance_id)
			if (this.running[instance_id] !== undefined) {
				for (const poll_id in this.running[instance_id]) {
					let poll = this.running[instance_id][poll_id]
					if (poll.timer !== undefined) {
						this.debug('Killing interval for', poll.instance, poll.url)
						clearInterval(poll.timer)
						delete this.running[instance_id][poll_id]
					}
				}
			}
		})
	}
}
