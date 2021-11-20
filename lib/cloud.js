/*
 * This file is part of the Companion project
 * Copyright (c) 2021 Bitfocus AS
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

const fetch = require('node-fetch')
const SCClient = require('socketcluster-client')
const { cloneDeep, isEqual } = require('lodash')
const { v4 } = require('uuid')
const { machineIdSync } = require('node-machine-id')

const REGION_TEMPLATE = {
	connected: false,
	enabled: false,
	host: '',
	name: '',
	pingResults: -1,
}

const REGIONS = {
	'oal-cluster': { host: 'oal-cluster.staging.bitfocus.io', name: 'Testing' },
	stockholm: { host: '127.0.0.1:8001', name: 'Europe' },
	virginia: { host: '127.0.0.1:8001', name: 'US' },
}

const CLOUD_URL =
	process.env.NODE_ENV === 'production' ? 'https://api.staging.bitfocus.io/v1' : 'http://127.0.0.1:8002/v1'

class Cloud {
	banks = []
	data = {
		token: '',
		user: '',
		connections: {},
	}
	debug = require('debug')('lib/cloud')
	companionId = 'N/A'
	knownIds = {}
	lastKnownIdCleanup = Date.now()
	regions
	sockets = {}
	state = {
		uuid: '',
		authenticated: false,
		authenticatedAs: '',
		ping: false,
		regions: {},
		tryUsername: '',
		tryPassword: '',
		tryNow: false,
		tryError: null,
	}

	constructor(system) {
		this.system = system
		this.regions = this.state.regions

		this.debug('constructor:io_get->request')
		this.system.emit('io_get', this.initializeIO.bind(this))

		this.system.emit('update_get', (update) => {
			this.state.uuid = machineIdSync({ original: true })
			this.companionId = update.payload?.id
			this.setState({ uuid: this.state.uuid })
		})

		this.system.emit('db_get', 'cloud', (db) => {
			if (db) {
				this.data = db
			}

			if (this.data.token) {
				this.handleCloudRefresh(this.data.token)
			}

			if (this.data.user) {
				this.setState({ authenticatedAs: this.data.user })
			}

			this.readConnections(this.data.connections)
		})

		// Refresh every 24 hours
		setInterval(this.handlePeriodicRefresh.bind(this), 3600e3 * 24)

		// Ping every second, if someone is watching
		setInterval(this.timerTick.bind(this), 1000)
	}

	clientConnect(client) {
		this.debug('clientConnect')
		client.on('cloud_state_get', this.handleCloudStateRequest.bind(this, client))
		client.on('cloud_state_set', this.handleCloudStateSet.bind(this, client))
		client.on('cloud_login', this.handleCloudLogin.bind(this, client))
		client.on('cloud_logout', this.handleCloudLogout.bind(this, client))
	}

	async clientGetBanks(args) {
		console.log('Client requested getBanks()')
		return this.banks
	}

	async clientPushBank(args) {
		console.log('Client requested pushBank(' + JSON.stringify(args) + ')')
		if (args.bank && args.page) {
			this.system.emit('bank_pressed', parseInt(args.page), parseInt(args.bank), true)
		}
		return true
	}

	async clientReleaseBank(args) {
		console.log('Client requested releaseBank(' + JSON.stringify(args) + ')')
		if (args.bank && args.page) {
			this.system.emit('bank_pressed', parseInt(args.page), parseInt(args.bank), false)
		}
		return true
	}

	async cloudConnect(region) {
		this.debug('Connecting')

		if (this.regions[region] !== undefined) {
			currentRegion = this.regions[region]

			this.sockets[region] = SCClient.create({
				hostname: currntRegion.host,
				secure: !currntRegion.host.match(/^127\./),
				autoReconnectOptions: {
					initialDelay: 1000, //milliseconds
					randomness: 500, //milliseconds
					multiplier: 1.5, //decimal
					maxDelay: 20000, //milliseconds
				},
			})
			;(async () => {
				while (this.sockets[region]) {
					let currentSocket = this.sockets[region]
					for await (let _event of currentSocket.listener('connect')) {
						// eslint-disable-line
						this.debug('Socket is connected')

						if (this.state.uuid === '') {
							console.error('Error fetching unique machine id')
							this.system.emit('log', 'cloud', 'error', 'Error logging into cloud: Error fetching unique machine id')
							return
						}

						try {
							const login = await currentSocket.invoke('cloudLogin', {
								token: this.data.token,
								uuid: this.state.uuid,
								companionId: this.companionId,
							})
							this.debug('Login ok: ', login)
						} catch (e) {
							console.error('Error logging into cloud socket: ', e)
							this.setState({ error: e.message })
							this.setRegionState(region, { connected: false })
							this.system.emit('log', 'cloud', 'error', 'Error logging into cloud: ' + e.message)
						}
					}
					await delay(1000)
					console.log('Are we still connected?')
				}
			})()
			;(async () => {
				while (this.sockets[region]) {
					let currentSocket = this.sockets[region]

					for await (let event of currentSocket.listener('authenticate')) {
						console.log(`[${region}] Connected OK!!`, this.state.uuid)

						// TODO: Remove when disconnected

						// In case a client is already listening
						this.setregionState(region, { connected: true })
						this.transmitFull(currentSocket)
					}
				}
			})()
			;(async () => {
				while (this.sockets[region]) {
					let currentSocket = this.sockets[region]

					for await (let event of currentSocket.listener('error')) {
						if (event.error.code === 4401) {
							// Disconnected by another process with the same id, let us disable this cloud intance,
							// to prevent connection looping
							this.system.emit(
								'log',
								'cloud',
								'error',
								'Disconnected from cloud by another instance from this computer, disabled cloud region ' + region
							)
							this.setRegionState(region, {
								enabled: false,
								connected: false,
								pingResults: -1,
							})
						} else {
							console.log(`DISCONNECT::::::::`, event)
							this.setRegionState(region, {
								connected: false,
								pingResults: -1,
							})
						}
					}
				}
			})()

			this.registerCompanionProcs(this.sockets[region], 'getBanks', this.clientGetBanks.bind(this))
			this.registerCompanionProcs(this.sockets[region], 'push', this.clientPushBank.bind(this))
			this.registerCompanionProcs(this.sockets[region], 'release', this.clientReleaseBank.bind(this))

			this.system.on('graphics_bank_invalidate', (page, bank) => this.updateBank(page, bank))

			setImmediate(() => {
				this.system.emit('db_get', 'bank', (banks) => {
					this.banks = cloneDeep(banks)
				})
			})
		}
	}

	destroy() {
		//Add disable state as well

		for (let region in this.regions) {
			this.destroyRegion(region)
		}
	}

	destroyRegion(region) {
		if (region !== undefined && this.regions[region] !== undefined && this.sockets[region] !== undefined) {
			this.sockets[region].disconnect()
			delete this.sockets[region]
			this.setRegionState(region, { connected: false, pingResults: -1 })
		}

		this.debug('destroy(%o)', region)
	}

	async handleCloudLogin(client, email, password) {
		let response
		try {
			response = await fetch(CLOUD_URL + '/auth/login', {
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
				},
				body: JSON.stringify({ email, password }),
				method: 'POST',
				mode: 'cors',
			})
		} catch (e) {
			console.error('Cloud error: ', e)
			this.setState({ authenticated: false, error: 'Cannot reach authentication/cloud-api server' })
			this.destroy()
			return
		}

		try {
			const responseObject = await response.json()
			console.log('Cloud result: ', responseObject)
			if (responseObject.token !== undefined) {
				this.data.token = responseObject.token
				this.data.user = email
				this.system.emit('db_set', 'cloud', this.data)
				this.setState({ authenticated: true, authenticatedAs: email, error: null })
			} else {
				this.setState({ authenticated: false, error: responseObject.message })
				this.destroy()
			}
		} catch (e) {
			console.error('Cloud error: ', e)
			this.setState({ authenticated: false, error: JSON.stringify(e) })
			this.destroy()
		}
	}

	handleCloudLogout(client) {
		this.data.user = ''
		this.data.token = ''
		this.data.connections = {}
		this.system.emit('db_set', 'cloud', this.data)
		this.setState({
			authenticated: false,
			authenticatedAs: '',
		})
		this.destroy()
	}

	async handleCloudRefresh(token) {
		let response
		try {
			response = await fetch(CLOUD_URL + '/refresh', {
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
					authorization: `Bearer ${token}`,
				},
				method: 'POST',
				mode: 'cors',
			})

			const result = await response.json()

			if (result.token) {
				this.data.token = result.token
				this.system.emit('db_set', 'cloud', this.data)
				this.setState({ authenticated: true, error: null })
			} else {
				this.setState({ authenticated: false, error: 'Cannot refresh login token, please login again.' })
			}
		} catch (e) {
			console.error('Cloud refresh error: ', e)
			this.setState({ authenticated: false, error: 'Cannot reach authentication/cloud-api server' })
			this.destroy()
			return
		}
	}

	handleCloudStateRequest(client) {
		this.debug('handleCloudStateRequest')
		client.emit('cloud_state', this.state)
	}

	handleCloudStateSet(client, newState) {
		this.debug('handleCloudStateSet', newState)
		this.setState({ ...newState }, client)
	}

	async handlePeriodicRefresh() {
		if (this.data.token) {
			await this.handleCloudRefresh(this.data.token)
		}
	}

	initializeIO(io) {
		this.debug('initializeIO')
		this.io = io
		this.io.on('connect', (client) => {
			this.debug('initializeClient:connect')
			this.clientConnect(client)
		})
	}

	mergeStyleForBank(page, bank) {
		let feedbackStyle = {}
		let style

		this.system.emit('get_bank', page, bank, (_style) => {
			style = cloneDeep(_style)
		})

		if (style.text) {
			this.system.emit('variable_parse', style.text, (str) => {
				style.text = str
			})
		}

		this.system.emit('feedback_get_style', page, bank, (style) => {
			if (style !== undefined) {
				feedbackStyle = { ...style }
			}
		})

		return {
			...style,
			...feedbackStyle,
			cloud: true,
		}
	}

	readConnections(connections) {
		if (connections && connections instanceof Array) {
			let update = {}
			for (let connection of connections) {
				update[connection + 'Enabled'] = true
			}
			this.setState(update)
		}
	}

	registerCompanionProcs(socket, name, callback) {
		if (typeof callback === 'function') {
			;(async () => {
				for await (let data of socket.subscribe(`companionProc:${this.state.uuid}:${name}`, { waitForAuth: true })) {
					if (this.knownIds[data.callerId]) {
						// Already handeled
						this.debug('Ignored redundant message %o', data.callerId)
						return
					}
					this.knownIds[data.callerId] = Date.now()

					this.debug('Received RPC for %o', name)
					try {
						const result = await callback(...data.args)
						socket.invokePublish('companionProcResult:' + data.callerId, { result: result })
						this.debug('rpc result: %o : %o', 'companionProcResult:' + data.callerId, result)
					} catch (e) {
						socket.invokePublish('companionProcResult:' + data.callerId, { error: e.message })
						this.debug('rpc error: %o', e.message)
					}

					// Clean up known ids once in a while
					const now = Date.now()
					if (now - this.lastKnownIdCleanup > 300000) {
						this.lastKnownIdCleanup = now
						for (let id in this.knownIds) {
							if (now - this.knownIds[id] > 300000) {
								delete this.knownIds[id]
							}
						}
					}
				}
			})()
		}
	}

	saveConnections() {
		for (let region of this.regions) {
			this.data.connections[region] = this.regions[region].enabled
		}
		this.system.emit('db_set', 'cloud', this.data)
	}

	setRegionState(region, draftState) {
		if (region !== undefined && this.regions[region] !== undefined) {
			let currentState = this.regions[region]

			const newState = {
				...currentState,
				...draftState,
			}

			//todo new io emit
			/*if (!isEqual(newState, currentState)) {
				this.io.emit('cloud_state', newState)
			}*/

			let abortState = false

			if (this.data.token) {
				if (currentState.enabled !== newState.enabled || (this.sockets[region] === undefined && newState.enabled)) {
					if (newState.enabled && this.state.authenticated) {
						this.cloudConnect(region)
						this.saveConnections()
					} else {
						this.state = newState
						this.destroyRegion(region)
						this.saveConnections()
						abortState = true
					}
				}
			}

			if (!abortState) {
				this.state = newState
			}
		}
	}

	setState(draftState) {
		const newState = {
			...this.state,
			...draftState,
		}

		if (!isEqual(newState, this.state)) {
			this.io.emit('cloud_state', newState)
			this.state = newState
		}
	}

	timerTick() {
		if (this.state.ping === true) {
			for (let socket in this.sockets) {
				if (this.sockets[socket]) {
					;(async () => {
						const startTime = Date.now()
						const result = await this.sockets[socket].invoke('ping', startTime)

						if (result && this.regions[socket].enabled) {
							this.setRegionState(socket, { pingResults: Date.now() - result })
						}
					})()
				}
			}
		}
	}

	async transmitFull(socket) {
		this.system.emit('gt_all_banks', 'bank', (banks) => {
			this.banks = cloneDeep(banks)

			for (let page in this.banks) {
				for (let bank in this.banks[page]) {
					this.banks[page][bank] = this.mergeStyleForBank(page, bank)
				}
			}

			socket.transmitPublish('companion-banks:' + this.state.uuid, {
				type: 'full',
				data: this.banks,
			})
		})
	}

	async updateBank(page, bank) {
		this.system.emit('db_get', 'bank', (banks) => {
			const updateId = v4()
			this.banks[page][bank] = cloneDeep(banks[page][bank])
			this.banks[page][bank] = this.mergeStyleForBank(page, bank)

			for (let region in regions) {
				if (this.sockets[region]) {
					this.sockets[region].transmitPublish('companion-banks:' + this.state.uuid, {
						updateId,
						type: 'single',
						page,
						bank,
						data: this.banks[page][bank],
					})
				}
			}
		})
	}
}

module.exports = (system) => new Cloud(system)
