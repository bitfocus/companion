import createDebug from 'debug'
import EventEmitter from 'events'
import shortid from 'shortid'
// @ts-ignore
import { Client } from 'node-rest-client'

interface RestPoll {
	instance: string
	id: string
	interval: number
	url: string
	type: string
	waiting: boolean
	data: any
	result_cb: Function
	timer: NodeJS.Timer
}

export class ServiceRest {
	readonly debug: createDebug.Debugger

	#running = new Map<string, RestPoll>()

	constructor(fakeSystem: EventEmitter, moduleName: string) {
		this.debug = createDebug(`legacy/${moduleName}/rest`)

		fakeSystem.on('rest_get', (url, cb, extra_headers, extra_args) => {
			this.debug('making request:', url)

			const client = new Client(extra_args)

			const args = {
				headers: {
					'Content-Type': 'application/json',
					...extra_headers,
				},
			}

			client
				.get(url, args, (data: any, response: any) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error: any) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})

		fakeSystem.on('rest', (url, data, cb, extra_headers, extra_args) => {
			this.debug('making request:', url, data)

			const client = new Client(extra_args)

			const args = {
				data: data,
				headers: {
					'Content-Type': 'application/json',
					...extra_headers,
				},
			}

			client
				.post(url, args, (data: any, response: any) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error: any) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})

		fakeSystem.on('rest_put', (url, data, cb, extra_headers, extra_args) => {
			this.debug('making request:', url, data)

			const client = new Client(extra_args)

			const args = {
				data: data,
				headers: {
					'Content-Type': 'application/json',
					...extra_headers,
				},
			}

			client
				.put(url, args, (data: any, response: any) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error: any) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})

		fakeSystem.on('rest_patch', (url, data, cb, extra_headers, extra_args) => {
			this.debug('making request:', url, data)

			const client = new Client(extra_args)

			const args = {
				data: data,
				headers: {
					'Content-Type': 'application/json',
					...extra_headers,
				},
			}

			client
				.patch(url, args, (data: any, response: any) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error: any) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})

		fakeSystem.on('rest_delete', (url, data, cb, extra_headers, extra_args) => {
			this.debug('making request:', url, data)

			const client = new Client(extra_args)

			const args = {
				data: data,
				headers: {
					'Content-Type': 'application/json',
					...extra_headers,
				},
			}

			client
				.delete(url, args, (data: any, response: any) => {
					cb(null, { data: data, response: response })
				})
				.on('error', (error: any) => {
					this.debug('error response:', error)
					cb(true, { error: error })
				})
		})

		fakeSystem.on('rest_poll', (instance_id, interval, url, data, poll_obj_cb, result_cb) => {
			const poll_id = shortid.generate()

			const timer = setInterval(() => {
				const obj = this.#running.get(poll_id)
				if (!obj || obj.waiting === true) {
					this.debug('Skipping this cycle for', poll_id)
				} else {
					fakeSystem.emit('rest', obj.url, obj.data, (err: any, res: any) => {
						this.debug('got reply for', obj.id, obj.url)
						obj.waiting = false
						obj.result_cb(err, res)
					})
				}
			}, interval)

			const pollObj: RestPoll = {
				instance: instance_id,
				id: poll_id,
				interval: interval,
				url: url,
				type: 'post',
				waiting: false,
				data: data,
				result_cb: result_cb,
				timer: timer,
			}

			this.#running.set(poll_id, pollObj)

			poll_obj_cb(null, pollObj)

			this.debug('Rest poll added', poll_id)
		})

		fakeSystem.on('rest_poll_get', (instance_id, interval, url, poll_obj_cb, result_cb) => {
			const poll_id = shortid.generate()

			const timer = setInterval(() => {
				const obj = this.#running.get(poll_id)
				if (!obj || obj.waiting === true) {
					this.debug('Skipping this cycle for', poll_id)
				} else {
					fakeSystem.emit('rest_get', obj.url, (err: any, res: any) => {
						this.debug('got reply for', obj.id, obj.url)
						obj.waiting = false
						obj.result_cb(err, res)
					})
				}
			}, interval)

			const pollObj: RestPoll = {
				instance: instance_id,
				id: poll_id,
				type: 'get',
				interval: interval,
				url: url,
				data: undefined,
				waiting: false,
				result_cb: result_cb,
				timer: timer,
			}
			this.#running.set(poll_id, pollObj)

			poll_obj_cb(null, pollObj)

			this.debug('Rest poll added', poll_id)
		})

		fakeSystem.on('rest_poll_destroy', (instance_id) => {
			this.destroy()
		})
	}

	destroy(): void {
		this.debug('Clearing poll intervals')
		for (const [poll_id, poll] of this.#running.entries()) {
			if (poll.timer !== undefined) {
				this.debug('Killing interval for', poll.instance, poll.url)
				clearInterval(poll.timer)
				this.#running.delete(poll_id)
			}
		}
	}
}
