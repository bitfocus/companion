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

const Client = require('node-rest-client').Client

exports = module.exports = function (system) {
	return new ServiceRest(system)
}

class ServiceRest {
	debug = require('debug')('lib/Service/Rest')

	constructor(system) {
		this.system = system

		this.system.on('rest_get', (url, cb, extra_headers, extra_args) => {
			this.debug('making request:', url)

			const client = new Client(extra_args)

			let args = {
				headers: { 'Content-Type': 'application/json' },
			}

			if (extra_headers !== undefined) {
				for (const header in extra_headers) {
					args.headers[header] = extra_headers[header]
				}
			}

			client
				.get(url, args, (data, response) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})

		this.system.on('rest', (url, data, cb, extra_headers, extra_args) => {
			this.debug('making request:', url, data)

			const client = new Client(extra_args)

			let args = {
				data: data,
				headers: { 'Content-Type': 'application/json' },
			}

			if (extra_headers !== undefined) {
				for (const header in extra_headers) {
					args.headers[header] = extra_headers[header]
				}
			}

			client
				.post(url, args, (data, response) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})

		this.system.on('rest_put', (url, data, cb, extra_headers, extra_args) => {
			this.debug('making request:', url, data)

			const client = new Client(extra_args)

			let args = {
				data: data,
				headers: { 'Content-Type': 'application/json' },
			}

			if (extra_headers !== undefined) {
				for (const header in extra_headers) {
					args.headers[header] = extra_headers[header]
				}
			}

			client
				.put(url, args, (data, response) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})

		this.system.on('rest_patch', (url, data, cb, extra_headers, extra_args) => {
			this.debug('making request:', url, data)

			const client = new Client(extra_args)

			let args = {
				data: data,
				headers: { 'Content-Type': 'application/json' },
			}

			if (extra_headers !== undefined) {
				for (const header in extra_headers) {
					args.headers[header] = extra_headers[header]
				}
			}

			client
				.patch(url, args, (data, response) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})

		this.system.on('rest_delete', (url, data, cb, extra_headers, extra_args) => {
			this.debug('making request:', url, data)

			const client = new Client(extra_args)

			let args = {
				data: data,
				headers: { 'Content-Type': 'application/json' },
			}

			if (extra_headers !== undefined) {
				for (const header in extra_headers) {
					args.headers[header] = extra_headers[header]
				}
			}

			client
				.delete(url, args, (data, response) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})
	}
}
