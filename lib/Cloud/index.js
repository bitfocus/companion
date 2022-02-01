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
const { cloneDeep, isEqual } = require('lodash')
const { v4 } = require('uuid')
const { machineIdSync } = require('node-machine-id')
const CloudRegion = require('./Region')

const CLOUD_URL =
	process.env.NODE_ENV === 'production' ? 'https://api.bitfocus.io/v1' : 'https://api-staging.bitfocus.io/v1'

module.exports = (system) => new Cloud(system)

/**
 * The class that manages the Bitfocus Cloud functionality
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 */
class Cloud {
	/**
	 * A clone of the bank database
	 * @type {Object}
	 * @access public
	 * @static
	 */
	static Regions = {}
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
	debug = require('debug')('lib/Cloud')
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
		uuid: '',
		authenticating: false,
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

		this.system.emit('db_get', 'cloud_servers', (regions) => {
			if (regions !== undefined) {
				for (const id in regions) {
					let region = regions[id]
					if (region.id && region.label && region.hostname) {
						Cloud.Regions[region.id] = { host: region.hostname, name: region.label }
					}
				}
			}
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
		})

		this.handleCloudInfrastructureRefresh()

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
		//this.debug('clientConnect')
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
	 * Request the current infrastructure information
	 * @async
	 * @access protected
	 */
	async handleCloudInfrastructureRefresh() {
		let response

		try {
			response = await fetch(CLOUD_URL + '/infrastructure/companion', {
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
				},
				method: 'GET',
				mode: 'cors',
			})

			const result = await response.json()
			this.debug('Cloud setup: ', result)

			if (result.cloud && result.cloud.regions) {
				const regions = result.cloud.regions

				this.system.emit('db_set', 'cloud_servers', regions)

				Cloud.Regions = {}

				for (const id in regions) {
					let region = regions[id]

					if (region.id && region.label && region.hostname) {
						Cloud.Regions[region.id] = { host: region.hostname, name: region.label }
					}
				}

				// Find any substitutions
				const legacySubstitution = result.cloud.regionLegacySubstitution

				if (legacySubstitution !== undefined) {
					for (const oldId in legacySubstitution) {
						if (this.regions[oldId]) {
							this.regions[legacySubstitution[oldId]] = this.regions[oldId]
							delete this.regions[oldId]
						}

						if (this.data.connections[oldId]) {
							this.data.connections[legacySubstitution[oldId]] = this.data.connections[oldId]
							delete this.data.connections[oldId]
						}
					}
				}

				// Delete removed regions
				for (const id in this.regions) {
					if (Cloud.Regions[id] === undefined) {
						this.regions[id].destroy()
						delete this.regions[id]
					}
				}

				// Create new and update existing regions
				let newRegions = []
				try {
					if (Cloud.Regions) {
						for (const id in Cloud.Regions) {
							newRegions.push(id)
							if (this.regions[id] !== undefined) {
								this.regions[id].updateSetup(Cloud.Regions[id])
							} else {
								this.regions[id] = new CloudRegion(this, id, Cloud.Regions[id])
							}
						}
					}
				} catch (e) {
					this.debug(e.message)
				}

				this.setState({ regions: newRegions })
				this.readConnections(this.data.connections)
			}
		} catch (e) {
			this.debug('Cloud infrastructure error: ', e)
		}
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

		this.setState({ authenticating: true })
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
			this.setState({
				authenticated: false,
				authenticating: false,
				error: 'Cannot reach authentication/cloud-api server',
			})
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
				this.setState({ authenticated: true, authenticating: false, authenticatedAs: email, error: null })
				this.readConnections(this.data.connections)
			} else {
				this.setState({ authenticated: false, authenticating: false, error: responseObject.message })
				this.destroy()
			}
		} catch (e) {
			console.error('Cloud error: ', e)
			this.setState({ authenticated: false, authenticating: false, error: JSON.stringify(e) })
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
			authenticating: false,
		})

		for (const id in this.regions) {
			this.regions[id].setState({ enabled: false })
		}

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

		// For transparency, show the user that we're refreshing
		this.setState({ authenticating: true })
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
			this.debug('Cloud result: ', result)

			if (result.token) {
				this.data.token = result.token
				this.system.emit('db_set', 'cloud', this.data)
				this.setState({
					authenticated: true,
					authenticatedAs: result.customer?.email,
					authenticating: false,
					error: null,
				})
				this.readConnections(this.data.connections)
			} else {
				this.setState({
					authenticated: false,
					authenticating: false,
					error: 'Cannot refresh login token, please login again.',
				})
			}
		} catch (e) {
			console.error('Cloud refresh error: ', e)
			this.setState({
				authenticated: false,
				authenticating: false,
				error: 'Cannot reach authentication/cloud-api server',
			})
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
		this.debug(`handleCloudregionStateRequest: ${region}`)
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
		this.debug(`handleCloudRegionStateSet: ${region}`, newState)
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
			await this.handleCloudInfrastructureRefresh()
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
		this.system.on('io_connect', this.clientConnect.bind(this))
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
		this.debug('READ CONNECTIONS', connections)
		if (connections) {
			for (let region in connections) {
				this.debug(`Has region: ${region}`, region in this.regions)
				if (this.regions[region]) {
					this.regions[region].setState({ enabled: connections[region] })
				}
			}
		}
	}

	/**
	 * Save region enable state information
	 * @access public
	 */
	saveConnection(region, enabled) {
		if (this.data.connections === undefined) {
			this.data.connections = {}
		}

		this.data.connections[region] = enabled

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
			if (Cloud.Regions) {
				for (const id in Cloud.Regions) {
					this.state.regions.push(id)
					this.regions[id] = new CloudRegion(this, id, Cloud.Regions[id])
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
			if (this.regions[region]?.socketTransmit) {
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
}
