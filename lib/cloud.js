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
	process.env.NODE_ENV === 'production' ? 'https://api-staging.bitfocus.io/v1' : 'http://127.0.0.1:8002/v1'

/**
 * The class that manages the Bitfocus Cloud functionality
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.2.0
 */
class Cloud {
	/**
	 * A clone of the bank database
	 * @type {Array}
	 * @access protected
	 */
	banks = []
	/**
	 * The cloud data store
	 * @type {Object[]}
	 * @access protected
	 */
	data = {
		token: '',
		user: '',
		connections: {},
	}
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('lib/cloud')
	/**
	 * The current comapnion ID
	 * @type {string}
	 * @access public
	 */
	companionId = 'N/A'
	/**
	 * Array of known client IDs
	 * @type {Object[]}
	 * @access public
	 */
	knownIds = {}
	/**
	 * Time of last client ID cleanup
	 * @type {number}
	 * @access public
	 */
	lastKnownIdCleanup = Date.now()
	/**
	 * The initialized region handlers
	 * @type {Object[]}
	 * @access protected
	 */
	regions = {}
	/**
	 * The state object for the UI
	 * @type {Object[]}
	 * @access public
	 */
	state = {
		connected: '',
		uuid: '',
		authenticated: false,
		authenticatedAs: '',
		ping: false,
		regions: [],
		tryUsername: '',
		tryPassword: '',
		tryNow: false,
		tryError: null,
	}

	/**
	 * Setup the Bitfocus Cloud service controller
	 * @param {EventEmitter} system - the application's event emitter
	 */
	constructor(system) {
		this.system = system

		this.debug('constructor:io_get->request')
		this.system.emit('io_get', this.initializeIO.bind(this))

		this.system.emit('update_get', (update) => {
			this.state.uuid = machineIdSync({ original: true })
			this.companionId = update.payload?.id
			this.setState({ uuid: this.state.uuid })
		})

		this.setupRegions()

		this.system.emit('db_get', 'cloud', (db) => {
			if (db) {
				this.data = {
					...this.db,
					...db,
				}
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

		this.system.on('graphics_bank_redrawn', this.updateBank.bind(this))

		this.updateAllBanks()
	}

	/**
	 * Setup a client's calls
	 * @param {Socket} client - the client connection
	 * @access protected
	 */
	clientConnect(client) {
		this.debug('clientConnect')
		client.on('cloud_state_get', this.handleCloudStateRequest.bind(this, client))
		client.on('cloud_state_set', this.handleCloudStateSet.bind(this, client))
		client.on('cloud_region_state_get', this.handleCloudRegionStateRequest.bind(this, client))
		client.on('cloud_region_state_set', this.handleCloudRegionStateSet.bind(this, client))
		client.on('cloud_login', this.handleCloudLogin.bind(this, client))
		client.on('cloud_logout', this.handleCloudLogout.bind(this, client))
	}

	/**
	 * Disconnect and cleanup all the regions
	 * @access public
	 */
	destroy() {
		for (let region in this.regions) {
			try {
				this.regions[region].destroy()
			} catch (e) {
				this.debug(`couldn't destroy region ${region}: ${e.message}`)
			}
		}
	}

	/**
	 * Get the current bank database
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a reference
	 * @returns {Object} the bank database
	 * @access public
	 */
	getBanks(clone = false) {
		let out

		if (this.banks !== undefined) {
			if (clone === true) {
				out = cloneDeep(this.banks)
			} else {
				out = this.banks
			}
		}

		return out
	}

	/**
	 * Process a login request from the UI
	 * @async
	 * @param {Socket} client - the client connection
	 * @param {string} email - the login email
	 * @param {string} password - the login password
	 * @access protected
	 */
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

	/**
	 * Process a logout request for the UI
	 * @param {Socket} client - the client connection
	 */
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

	/**
	 * Request an updated token from the cloud service
	 * @async
	 * @param {string} token - the current session token
	 * @access protected
	 */
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

	/**
	 * Process and send a state request from the UI
	 * @param {Socket} client - the cloud connection
	 * @access protected
	 */
	handleCloudStateRequest(client) {
		this.debug('handleCloudStateRequest')
		client.emit('cloud_state', this.state)
	}

	/**
	 * Process an updated state from the UI
	 * @param {Socket} client - the cloud connection
	 * @param {Object[]} newState - the new state
	 * @access protected
	 */
	handleCloudStateSet(client, newState) {
		this.debug('handleCloudStateSet', newState)
		this.setState({ ...newState })
	}

	/**
	 * Process and send a region state request from the UI
	 * @param {Socket} client - the client connection
	 * @param {string} region - the region to process
	 * @access protected
	 */
	handleCloudRegionStateRequest(client, region) {
		this.debug('handleCloudStateRequest')
		if (this.regions[region] !== undefined) {
			client.emit('cloud_region_state', region, this.regions[region].state)
		}
	}

	/**
	 * Process an updated region state from the UI
	 * @param {Socket} client - the client connection
	 * @param {string} region - the region to process
	 * @param {Object[]} newState - the new state
	 * @access protected
	 */
	handleCloudRegionStateSet(client, region, newState) {
		this.debug('handleCloudStateSet', newState)
		if (this.regions[region] !== undefined) {
			this.regions[region].setState({ ...newState })
		}
	}

	/**
	 * If a token exists, refresh it
	 * @async
	 * @access protected
	 */
	async handlePeriodicRefresh() {
		if (this.data.token) {
			await this.handleCloudRefresh(this.data.token)
		}
	}

	/**
	 * Setup the UI socket handler
	 * @param {IO} io - the UI socket handler
	 * @access protected
	 */
	initializeIO(io) {
		this.debug('initializeIO')
		this.io = io
		this.io.on('connect', this.clientConnect.bind(this))
	}

	/**
	 * Merge feedback style and parse variables for a bank style
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {Object[]} style - the base style
	 * @returns {Object[]} the processed style
	 */
	mergeStyleForBank(page, bank, style) {
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

	/**
	 * Send enable information from the DB to the regions
	 * @param {Array} connections - the region enable information
	 * @access protected
	 */
	readConnections(connections) {
		if (connections && connections instanceof Array) {
			let update = {}
			for (let region of connections) {
				if (this.regions[region]) {
					this.regions[region] = this.regions[region].setState({ enabled: connections[region] })
				}
			}
		}
	}

	/**
	 * Save region enable state information
	 * @access public
	 */
	saveConnections() {
		if (this.data.connections === undefined) {
			this.data.connections = {}
		}

		for (let region in this.regions) {
			this.data.connections[region] = this.regions[region].state.enabled
		}
		this.system.emit('db_set', 'cloud', this.data)
	}

	/**
	 * Merge and transmit new state information
	 * @param {Object[]} draftState - the updated state(s)
	 * @access protected
	 */
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
				let currentRegion = this.regions[region]

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

	/**
	 * Initialize all the regions
	 * @access protected
	 */
	setupRegions() {
		try {
			if (REGIONS) {
				for (let region in REGIONS) {
					this.state.regions.push(region)
					this.regions[region] = new Region(this, region, REGIONS[region])
				}
			}
		} catch (e) {
			this.debug(e.message)
		}
	}

	/**
	 * If needed, ping all the regions
	 * @access protected
	 */
	timerTick() {
		if (this.state.ping === true) {
			for (let region in this.regions) {
				try {
					this.regions[region].timerTick()
				} catch (e) {}
			}
		}
	}

	/**
	 * Get copies of all the current bank styles
	 * @access protected
	 */
	updateAllBanks() {
		this.system.emit('get_all_banks', (banks) => {
			this.banks = cloneDeep(banks)

			for (let page in this.banks) {
				for (let bank in this.banks[page]) {
					this.banks[page][bank] = this.mergeStyleForBank(page, bank, this.banks[page][bank])
				}
			}
		})
	}

	/**
	 * Store and transmit an updated bank style
	 * @async
	 * @param {number} page - the page number
	 * @param {number} bank - the bank number
	 * @param {Object[]} style - the new style
	 * @access protected
	 */
	async updateBank(page, bank, style) {
		const updateId = v4()
		this.banks[page][bank] = style

		for (let region in this.regions) {
			this.regions[region].socketTransmit('companion-banks:' + this.state.uuid, {
				updateId,
				type: 'single',
				page,
				bank,
				data: style,
			})
		}
	}
}

/**
 * Functionality for a connection region for cloud control
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.2.0
 */
class Region {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug
	/**
	 * The host of the remote server
	 * @type {string}
	 * @access protected
	 */
	host = ''
	/**
	 * The unique ID of this region
	 * @type {string}
	 * @access protected
	 */
	id = ''
	/**
	 * The state object for the UI
	 * @type {Object[]}
	 * @access public
	 */
	state = {
		connected: false,
		enabled: false,
		error: '',
		id: '',
		name: '',
		pingResults: -1,
	}

	/**
	 * Setup a Bitfocus Cloud region
	 * @param {Cloud} cloud - the cloud controller
	 * @param {string} id - this unique ID
	 * @param {Object[]} data - setup data for the region
	 */
	constructor(cloud, id, data) {
		this.cloud = cloud
		this.system = cloud.system
		this.io = cloud.io
		this.debug = require('debug')(`lib/cloud/${id}`)

		this.id = id
		this.state.id = id

		if (data.host) {
			this.host = data.host
		} else {
			throw 'Host not defined'
		}

		if (data.name) {
			this.state.name = data.name
		} else {
			throw 'Name note defined'
		}
	}

	/**
	 * Process a <code>getBanks</code> call from a remote client
	 * @async
	 * @param {*} args - incoming arguments
	 * @returns {Object[]} the bank database
	 * @access protected
	 */
	async clientGetBanks(args) {
		console.log('Client requested getBanks()')
		return this.cloud.getBanks()
	}

	/**
	 * Process a <code>pushBank</code> call from a remote client
	 * @async
	 * @param {*} args - incoming arguments
	 * @returns {boolean} <code>true</code>
	 * @access protected
	 */
	async clientPushBank(args) {
		console.log('Client requested pushBank(' + JSON.stringify(args) + ')')
		if (args.bank && args.page) {
			this.system.emit('bank_pressed', parseInt(args.page), parseInt(args.bank), true)
		}
		return true
	}

	/**
	 * Process a <code>releaseBank</code> call from a remote client
	 * @async
	 * @param {*} args
	 * @returns {boolean} <code>true</code>
	 * @access protected
	 */
	async clientReleaseBank(args) {
		console.log('Client requested releaseBank(' + JSON.stringify(args) + ')')
		if (args.bank && args.page) {
			this.system.emit('bank_pressed', parseInt(args.page), parseInt(args.bank), false)
		}
		return true
	}

	/**
	 * Connect to the cloud service
	 * @async
	 * @access protected
	 */
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
							token: this.cloud.data.token,
							uuid: this.cloud.state.uuid,
							companionId: this.cloud.companionId,
						})
						this.debug('Login ok: ', login)
					} catch (e) {
						console.error('Error logging into cloud socket: ', e)
						this.setState({ connected: false, error: e.message })
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
					this.setState({ connected: true, error: '' })
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
							`Disconnected from cloud by another instance from this computer, disabled cloud region ${this.state.name}`
						)
						this.setState({
							enabled: false,
							connected: false,
							pingResults: -1,
							error: 'Disconnected from cloud by another instance from this computer',
						})
					} else {
						console.log(`DISCONNECT::::::::`, event)
						this.setState({
							connected: false,
							pingResults: -1,
							error: '',
						})
					}
				}
			}
		})()

		this.registerCompanionProcs(this.socket, 'getBanks', this.clientGetBanks.bind(this))
		this.registerCompanionProcs(this.socket, 'push', this.clientPushBank.bind(this))
		this.registerCompanionProcs(this.socket, 'release', this.clientReleaseBank.bind(this))
	}

	/**
	 * Disconnect the cloud socket and cleanup
	 * @access public
	 */
	destroy() {
		/* TODO: add disable procedure */
		if (this.socket !== undefined) {
			this.socket.disconnect()
			delete this.socket
			this.setState({ connected: false, pingResults: -1, error: '' })
		}

		this.debug('destroy(%o)', this.id)
	}

	/**
	 * Associate a callback with a remote call
	 * @param {Socket} socket - the cloud connection
	 * @param {string} name - name of the remote call to trigger processing
	 * @param {function} callback - function to process the remote data
	 * @access protected
	 */
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

	/**
	 * Merge and transmit new state information
	 * @param {Object[]} draftState - the updated state(s)
	 * @access protected
	 */
	setState(draftState) {
		const newState = {
			...this.state,
			...draftState,
		}

		if (!isEqual(newState, this.state)) {
			this.io.emit('cloud_region_state', this.id, newState)
		}

		let abortState = false

		if (this.cloud.data.token) {
			if (this.state.enabled !== newState.enabled || (this.socket === undefined && newState.enabled)) {
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

	/**
	 * Transmit information to the cloud service
	 * @param  {...any} args
	 * @access public
	 */
	socketTransmit(...args) {
		if (this.socket !== undefined) {
			try {
				this.socket.transmitPublish(...args)
			} catch (e) {
				this.debug(`couldn't transmit to ${this.state.name}`)
			}
		}
	}

	/**
	 * Send a ping to the cloud service
	 * @access public
	 */
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

	/**
	 * Send the full bank database to the cloud service
	 * @async
	 * @access protected
	 */
	async transmitFull() {
		this.socket.transmitPublish('companion-banks:' + this.cloud.state.uuid, {
			type: 'full',
			data: this.cloud.getBanks(),
		})
	}
}

module.exports = (system) => new Cloud(system)
