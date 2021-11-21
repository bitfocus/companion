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

const REGIONS = {
	'oal-cluster': { host: 'oal-cluster.staging.bitfocus.io', name: 'Testing' },
	stockholm: { host: '127.0.0.1:8001', name: 'Europe' },
	virginia: { host: '127.0.0.1:8001', name: 'US' },
}

const CLOUD_URL =
	process.env.NODE_ENV === 'production' ? 'https://api.staging.bitfocus.io/v1' : 'http://127.0.0.1:8002/v1'

/**
 * The class that manages the applications's cloud functionality database
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 */
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
	regions = {}
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

	destroy() {
		for (let region in this.regions) {
			try {
				this.regions[region].destroy()
			} catch (e) {
				this.debug(`couldn't destroy region ${region}: ${e.message}`)
			}
		}
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

		/** TODO: Check this out as a good new locale */
		this.system.on('graphics_bank_invalidate', (page, bank) => this.updateBank(page, bank))

		setImmediate(() => {
			this.system.emit('db_get', 'bank', (banks) => {
				this.banks = cloneDeep(banks)
			})
		})
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
		this.setState({ ...newState })
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

	mergeStyleForBank(style, page, bank) {
		let feedbackStyle = {}

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
			for (let region of connections) {
				if (this.regions[region])
				this.regions[region] = this.regions[region].setState({enabled: connections[region]})
			}
		}
	}

	saveConnections() {
		for (let region of this.regions) {
			this.data.connections[region] = this.regions[region].enabled
		}
		this.system.emit('db_set', 'cloud', this.data)
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

		let abortState = false

		if (this.data.token) {
			for (let region in this.regions) {
				currentRegion = this.regions[region]

				if (this.state.authenticated !== newState.authenticated) {
					if (currentRegion.state?.enabled && newState.authenticated) {
						currentRegion.cloudConnect()
					} else {
						this.state = newState
						currentRegion.destroy()
						abortState = true
					}
				}
			}
		}

		if (!abortState) {
			this.state = newState
		}
	}

	setupRegions() {
		if(REGIONS) {
			for (let region in REGIONS) {
				this.regions[region] = new Region(this, region, REGIONS[region])
			}
		}
	}

	timerTick() {
		if (this.state.ping === true) {
			for (let region in this.regions) {
				try {
					this.regions[region].timerTick()
				} catch (e) {}
			}
		}
	}

	async updateBank(page, bank) {
		this.system.emit('get_bank', page, bank, (style) => {
			const updateId = v4()
			style = cloneDeep(style)
			style = this.mergeStyleForBank(style, page, bank)

			for (let region in regions) {
				this.regions[region].socketTransmit('companion-banks:' + this.state.uuid, {
					updateId,
					type: 'single',
					page,
					bank,
					data: style,
				})
			}
		})
	}
}

/**
 * Functionality for a connection region for cloud control
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 */
class Region {
	host = ''
	id = ''
	name = ''
	state = {
		connected: false,
		enabled: false,
		pingResults: -1,
	}

	constructor(cloud, id, data) {
		this.could = cloud
		this.system = cloud.system
		this.io = cloud.io
		this.debug = cloud.debug

		this.id = id
		
		if (data.host) {
			this.host = data.host
		}

		if (data.name) {
			this.name = data.name
		}
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

	async cloudConnect() {
		this.debug('Connecting')

		this.socket = SCClient.create({
			hostname: this.host,
			secure: !this.host.match(/^127\./),
			autoReconnectOptions: {
				initialDelay: 1000, //milliseconds
				randomness: 500, //milliseconds
				multiplier: 1.5, //decimal
				maxDelay: 20000, //milliseconds
			},
		})
		;(async () => {
			while (this.socket) {
				for await (let _event of this.socket.listener('connect')) {
					// eslint-disable-line
					this.debug('Socket is connected')

					if (this.cloud.state.uuid === '') {
						console.error('Error fetching unique machine id')
						this.system.emit('log', 'cloud', 'error', 'Error logging into cloud: Error fetching unique machine id')
						return
					}

					try {
						const login = await this.socket.invoke('cloudLogin', {
							token: this.could.data.token,
							uuid: this.cloud.state.uuid,
							companionId: this.cloud.companionId,
						})
						this.debug('Login ok: ', login)
					} catch (e) {
						console.error('Error logging into cloud socket: ', e)
						this.cloud.setState({ error: e.message })
						this.setState({ connected: false })
						this.system.emit('log', 'cloud', 'error', 'Error logging into cloud: ' + e.message)
					}
				}
				await delay(1000)
				console.log('Are we still connected?')
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('authenticate')) {
					console.log(`[${this.id}] Connected OK!!`, this.state.uuid)

					// TODO: Remove when disconnected

					// In case a client is already listening
					this.setState({ connected: true })
					this.transmitFull()
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('error')) {
					if (event.error.code === 4401) {
						// Disconnected by another process with the same id, let us disable this cloud intance,
						// to prevent connection looping
						this.system.emit(
							'log',
							'cloud',
							'error',
							`Disconnected from cloud by another instance from this computer, disabled cloud region ${this.name}`
						)
						this.setState({
							enabled: false,
							connected: false,
							pingResults: -1,
						})
					} else {
						console.log(`DISCONNECT::::::::`, event)
						this.setState({
							connected: false,
							pingResults: -1,
						})
					}
				}
			}
		})()

		this.registerCompanionProcs(this.socket, 'getBanks', this.clientGetBanks.bind(this))
		this.registerCompanionProcs(this.socket, 'push', this.clientPushBank.bind(this))
		this.registerCompanionProcs(this.socket, 'release', this.clientReleaseBank.bind(this))
	}

	destroy() {
		/* TODO: add disable procedure */
		if (this.socket !== undefined) {
			this.socket.disconnect()
			delete this.socket
			this.setState({ connected: false, pingResults: -1 })
		}

		this.debug('destroy(%o)', this.id)
	}

	registerCompanionProcs(socket, name, callback) {
		if (typeof callback === 'function') {
			;(async () => {
				for await (let data of socket.subscribe(`companionProc:${this.cloud.state.uuid}:${name}`, {
					waitForAuth: true,
				})) {
					if (this.cloud.knownIds[data.callerId]) {
						// Already handeled
						this.debug('Ignored redundant message %o', data.callerId)
						return
					}
					this.cloud.knownIds[data.callerId] = Date.now()

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
					if (now - this.cloud.lastKnownIdCleanup > 300000) {
						this.cloud.lastKnownIdCleanup = now
						for (let id in this.cloud.knownIds) {
							if (now - this.cloud.knownIds[id] > 300000) {
								delete this.cloud.knownIds[id]
							}
						}
					}
				}
			})()
		}
	}

	setState(draftState) {
		const newState = {
			...currentState,
			...draftState,
		}

		// TODO: new io emit
		/*if (!isEqual(newState, currentState)) {
				this.io.emit('cloud_state', newState)
			}*/

		let abortState = false

		if (this.data.token) {
			if (currentState.enabled !== newState.enabled || (this.socket === undefined && newState.enabled)) {
				if (newState.enabled && this.cloud.state.authenticated) {
					this.cloudConnect()
				} else {
					this.state = newState
					this.destroy()
					abortState = true
				}

				this.cloud.saveConnections()
			}
		}

		if (!abortState) {
			this.state = newState
		}
	}

	socketTransmit(...args) {
		if (this.socket !== undefined) {
			try {
				this.socket.transmitPublish(...args)
			} catch (e) {
				this.debug(`couldn't transmit to ${this.name}`)
			}
		}
	}

	timerTick() {
		if (this.socket !== undefined) {
			;(async () => {
				const startTime = Date.now()
				const result = await this.socket.invoke('ping', startTime)

				if (result && this.enabled) {
					this.setState({ pingResults: Date.now() - result })
				}
			})()
		}
	}

	async transmitFull() {
		this.system.emit('get_all_banks', 'bank', (banks) => {
			this.banks = cloneDeep(banks)

			for (let page in this.banks) {
				for (let bank in this.banks[page]) {
					this.banks[page][bank] = this.cloud.mergeStyleForBank(this.banks[page][bank], page, bank)
				}
			}

			this.socket.transmitPublish('companion-banks:' + this.cloud.state.uuid, {
				type: 'full',
				data: this.banks,
			})
		})
	}
}

module.exports = (system) => new Cloud(system)
