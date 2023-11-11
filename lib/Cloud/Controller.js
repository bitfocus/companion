import { isEqual } from 'lodash-es'
import CoreBase from '../Core/Base.js'
import CloudRegion from './Region.js'
import got from 'got'
import { v4 } from 'uuid'
import { xyToOldBankIndex } from '../Shared/ControlId.js'

const CLOUD_URL = 'https://api.bitfocus.io/v1'

/**
 * The class that manages the Bitfocus Cloud functionality
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.3.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */

class CloudController extends CoreBase {
	/**
	 * A clist of known cloud regions
	 * @type {{[region: string]: { host: string, name: string }}}
	 * @access public
	 * @static
	 */
	static availableRegions = {}
	/**
	 * The cloud data store
	 * @type {{token: string, user: string, connections: {[region: string]: boolean}, cloudActive: boolean}}}
	 * @access protected
	 */
	data = {
		token: '',
		user: '',
		connections: {},
		cloudActive: false,
	}
	/**
	 * The current comapnion ID
	 * @type {string}
	 * @access public
	 */
	companionId = 'N/A'
	/**
	 * Array of known client IDs, with their last seen time
	 * @type {Map<string, number>}
	 * @access public
	 */
	knownIds = new Map()
	/**
	 * Time of last client ID cleanup
	 * @type {number}
	 * @access public
	 */
	lastKnownIdCleanup = Date.now()
	/**
	 * The initialized region handlers
	 * @type {{[region: string]: CloudRegion}}
	 * @access protected
	 */
	regionInstances = {}
	/**
	 * The state object for the UI
	 * @type {CloudControllerState}
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
		error: null,
		cloudActive: false,
		canActivate: false,
	}

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 * @param {import('../Data/CloudDatabase.js').default} clouddb
	 * @param {import('../Data/Cache.js').default} cache
	 */
	constructor(registry, clouddb, cache) {
		super(registry, 'cloud', 'Cloud/Controller')

		this.clouddb = clouddb
		this.cache = cache

		this.companionId = registry.appInfo.machineId
		const uuid = this.clouddb.getKey('uuid', undefined)
		this.setState({ uuid })

		const regions = this.cache.getKey('cloud_servers', undefined)

		if (regions !== undefined) {
			for (const region of regions) {
				if (region.id && region.label && region.hostname) {
					CloudController.availableRegions[region.id] = { host: region.hostname, name: region.label }
				}
			}
		}

		this.setupRegions()

		this.data = this.clouddb.getKey('auth', {
			token: '',
			user: '',
			connections: {},
			cloudActive: false,
		})

		if (this.data.token) {
			this.handleCloudRefresh(this.data.token)
		}

		if (this.data.user) {
			this.setState({ authenticatedAs: this.data.user })
		}

		this.handleCloudInfrastructureRefresh()

		// Refresh every 24 hours
		setInterval(this.handlePeriodicRefresh.bind(this), 3600e3 * 24)

		// Ping every second, if someone is watching
		setInterval(this.timerTick.bind(this), 1000)

		this.graphics.on('button_drawn', this.updateBank.bind(this))

		this.updateAllBanks()
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('cloud_state_get', this.handleCloudStateRequest.bind(this, client))
		client.on('cloud_state_set', this.handleCloudStateSet.bind(this, client))
		client.on('cloud_region_state_get', this.handleCloudRegionStateRequest.bind(this, client))
		client.on('cloud_region_state_set', this.handleCloudRegionStateSet.bind(this, client))
		client.on('cloud_login', this.handleCloudLogin.bind(this, client))
		client.on('cloud_logout', this.handleCloudLogout.bind(this, client))
		client.on('cloud_regenerate_uuid', this.handleCloudRegenerateUUID.bind(this, client))
	}

	/**
	 * Disconnect and cleanup all the regions
	 * @access public
	 */
	destroy() {
		for (let region in this.regionInstances) {
			try {
				this.regionInstances[region].destroy()
			} catch (/** @type {any} */ e) {
				this.logger.silly(`couldn't destroy region ${region}: ${e.message}`)
			}
		}
	}

	/**
	 * Get the current bank database
	 * @returns {Object} the bank database
	 * @access public
	 */
	getBanks() {
		const retval = []

		for (const control of this.controls.getAllControls().values()) {
			if (control.type !== 'button') continue
			const drawStyle = control.getDrawStyle()
			if (!drawStyle || drawStyle.style !== 'button') continue

			// Don't expose a cloud control
			if (drawStyle.cloud) continue

			const location = this.page.getLocationOfControlId(control.controlId)
			if (!location) continue

			const bank = xyToOldBankIndex(location.column, location.row)
			if (bank === null) continue

			retval.push({
				page: location.pageNumber,
				// TODO - handle locations normaly
				bank: bank,
				data: {
					...control.toJSON(false).style,
					pushed: control.supportsPushed && control.pushed,
					actions_running: control.supportsActions && control.has_actions_running,
					bank_status: control.supportsStyle && control.button_status,
					style: 'button',
				},
			})
		}

		return retval
	}

	/**
	 * Request the current infrastructure information
	 * @async
	 * @access protected
	 */
	async handleCloudInfrastructureRefresh() {
		try {
			const response = await got.get(CLOUD_URL + '/infrastructure/cloud/regions', {
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
				},
				searchParams: {
					...(process.env.NODE_ENV !== 'production' ? { testing: 'true' } : {}),
				},
				responseType: 'json',
			})

			const result = response.body
			this.logger.silly('Cloud setup: ', result)

			if (result.regions) {
				const regions = result.regions

				this.cache.setKey('cloud_servers', regions)

				CloudController.availableRegions = {}

				for (const region of regions) {
					if (region.id && region.label && region.hostname) {
						CloudController.availableRegions[region.id] = { host: region.hostname, name: region.label }
					}
				}

				// Find any substitutions
				const legacySubstitution = result.regionLegacySubstitution

				if (legacySubstitution !== undefined) {
					for (const oldId in legacySubstitution) {
						if (this.regionInstances[oldId]) {
							this.regionInstances[legacySubstitution[oldId]] = this.regionInstances[oldId]
							delete this.regionInstances[oldId]
						}

						if (this.data.connections[oldId]) {
							this.data.connections[legacySubstitution[oldId]] = this.data.connections[oldId]
							delete this.data.connections[oldId]
						}
					}
				}

				// Delete removed regions
				for (const id in this.regionInstances) {
					if (CloudController.availableRegions[id] === undefined) {
						this.regionInstances[id].destroy()
						delete this.regionInstances[id]
					}
				}

				// Create new and update existing regions
				let newRegions = []
				try {
					if (CloudController.availableRegions) {
						for (const id in CloudController.availableRegions) {
							newRegions.push(id)
							if (this.regionInstances[id] !== undefined) {
								this.regionInstances[id].updateSetup(CloudController.availableRegions[id])
							} else {
								this.regionInstances[id] = new CloudRegion(this, id, CloudController.availableRegions[id])
							}
						}
					}
				} catch (/** @type {any} */ e) {
					this.logger.silly(e.message)
				}

				this.setState({ regions: newRegions })
				this.readConnections(this.data.connections)
			}
		} catch (e) {
			this.logger.silly('Cloud infrastructure error: ', e)
		}
	}

	/**
	 * Change UUID of this companion instance
	 * @async
	 * @param {import('../UI/Handler.js').ClientSocket} _client - the client connection
	 * @access protected
	 */
	async handleCloudRegenerateUUID(_client) {
		const newUuid = v4()
		this.setState({ uuid: newUuid })
		this.clouddb.setKey('uuid', newUuid)

		this.setState({ cloudActive: false })
		await new Promise((resolve) => setTimeout(resolve, 1000))
		this.setState({ cloudActive: true })
	}

	/**
	 * Process a login request from the UI
	 * @async
	 * @param {import('../UI/Handler.js').ClientSocket} _client - the client connection
	 * @param {string} email - the login email
	 * @param {string} password - the login password
	 * @access protected
	 */
	async handleCloudLogin(_client, email, password) {
		let response

		this.setState({ error: null, authenticating: true })
		try {
			response = await got.post(CLOUD_URL + '/auth/login', {
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
				},
				json: { email, password },
				responseType: 'json',
			})
		} catch (/** @type {any} */ e) {
			if (e.response?.statusCode >= 400 && e.response?.statusCode < 500) {
				this.setState({
					authenticated: false,
					authenticating: false,
					error: e.response?.body?.message || 'Invalid email or password',
				})
			} else {
				this.setState({
					authenticated: false,
					authenticating: false,
					error: 'Could not connect to the cloud',
				})
			}
			this.destroy()
			return
		}

		try {
			const responseObject = response.body
			this.logger.silly('Cloud result: ', responseObject)
			if (responseObject.token !== undefined) {
				this.data.token = responseObject.token
				this.data.user = email
				this.clouddb.setKey('auth', this.data)
				this.setState({ authenticated: true, authenticating: false, authenticatedAs: email, error: null })
				this.readConnections(this.data.connections)
			} else {
				this.setState({ authenticated: false, authenticating: false, error: responseObject.message })
				this.destroy()
			}
		} catch (/** @type {any} */ e) {
			this.logger.error(`Cloud error: ${e.message}`)
			this.setState({ authenticated: false, authenticating: false, error: JSON.stringify(e) })
			this.destroy()
		}
	}

	/**
	 * Process a logout request for the UI
	 * @param {import('../UI/Handler.js').ClientSocket} _client - the client connection
	 */
	handleCloudLogout(_client) {
		this.data.user = ''
		this.data.token = ''
		this.data.connections = {}
		this.data.cloudActive = false
		this.clouddb.setKey('auth', this.data)

		this.setState({
			authenticated: false,
			authenticatedAs: '',
			authenticating: false,
			cloudActive: false,
		})

		for (const id in this.regionInstances) {
			this.regionInstances[id].setState({ enabled: false })
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
		// For transparency, show the user that we're refreshing
		this.setState({ authenticating: true })
		try {
			const response = await got.post(CLOUD_URL + '/refresh', {
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
					authorization: `Bearer ${token}`,
				},
				responseType: 'json',
			})

			const result = response.body
			this.logger.silly('Cloud result: ', result)

			if (result.token) {
				this.data.token = result.token
				this.clouddb.setKey('auth', this.data)
				this.setState({
					authenticated: true,
					authenticatedAs: result.customer?.email,
					authenticating: false,
					error: null,
					cloudActive: this.data.cloudActive,
				})
				this.readConnections(this.data.connections)
			} else {
				this.setState({
					authenticated: false,
					authenticating: false,
					error: 'Cannot refresh login token, please login again.',
				})
			}
		} catch (/** @type {any} */ e) {
			this.logger.error(`Cloud refresh error: ${e.message}`)
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
	 * Process and return a state request from the UI
	 * @param {import('../UI/Handler.js').ClientSocket} client - the cloud connection
	 * @access protected
	 */
	handleCloudStateRequest(client) {
		this.logger.silly('handleCloudStateRequest')
		client.emit('cloud_state', this.state)
	}

	/**
	 * Process an updated state from the UI
	 * @param {import('../UI/Handler.js').ClientSocket} _client - the cloud connection
	 * @param {Partial<CloudControllerState>} newState - the new state
	 * @access protected
	 */
	handleCloudStateSet(_client, newState) {
		this.logger.silly('handleCloudStateSet', newState)
		this.setState({ ...newState })
	}

	/**
	 * Process and send a region state request from the UI
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client connection
	 * @param {string} region - the region to process
	 * @access protected
	 */
	handleCloudRegionStateRequest(client, region) {
		this.logger.silly(`handleCloudregionStateRequest: ${region}`)
		if (this.regionInstances[region] !== undefined) {
			client.emit('cloud_region_state', region, this.regionInstances[region].state)
		}
	}

	/**
	 * Process an updated region state from the UI
	 * @param {import('../UI/Handler.js').ClientSocket} _client - the client connection
	 * @param {string} region - the region to process
	 * @param {Object} newState - the new state
	 * @access protected
	 */
	handleCloudRegionStateSet(_client, region, newState) {
		this.logger.silly(`handleCloudRegionStateSet: ${region}`, newState)
		if (this.regionInstances[region] !== undefined) {
			this.regionInstances[region].setState({ ...newState, cloudActive: this.state.cloudActive })
		}
		const activeRegions = Object.values(this.regionInstances).filter((r) => r.state.enabled).length
		this.setState({ canActivate: activeRegions >= 2 })
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
	 * Send enable information from the DB to the regions
	 * @param {{[region: string]: boolean}} connections - the region enable information
	 * @access protected
	 */
	readConnections(connections) {
		this.logger.silly('READ CONNECTIONS', connections)
		if (connections) {
			for (let region in connections) {
				this.logger.silly(`Has region: ${region}`, region in this.regionInstances)
				if (this.regionInstances[region]) {
					this.regionInstances[region].setState({ enabled: connections[region], cloudActive: this.state.cloudActive })
				}
			}
			const activeRegions = Object.values(this.regionInstances).filter((r) => r.state.enabled).length
			this.setState({ canActivate: activeRegions >= 2 })
		}
	}

	/**
	 * Save region enable state information
	 * @access public
	 * @param {string} region
	 * @param {boolean} enabled
	 */
	saveConnection(region, enabled) {
		if (this.data.connections === undefined) {
			this.data.connections = {}
		}

		this.data.connections[region] = enabled

		this.clouddb.setKey('auth', this.data)
	}

	/**
	 * Merge and transmit new state information
	 * @param {Partial<CloudControllerState>} draftState - the updated state(s)
	 * @access protected
	 */
	setState(draftState) {
		const oldState = { ...this.state }
		const newState = {
			...this.state,
			...draftState,
		}

		if (draftState.cloudActive && !oldState.canActivate) {
			// If canActivate is false, we can't activate cloud
			newState.cloudActive = oldState.cloudActive
		}

		if (!isEqual(newState, this.state)) {
			this.io.emit('cloud_state', newState)
			this.state = newState
		}

		if (oldState.cloudActive !== newState.cloudActive) {
			this.data.cloudActive = newState.cloudActive
			this.clouddb.setKey('auth', this.data)

			if (newState.authenticated) {
				for (let region in this.regionInstances) {
					this.regionInstances[region].setState({ cloudActive: newState.cloudActive })
				}

				// Was authenticated when cloudActive was changed, so we can skip the next check in setState
				return
			}
		}

		if (this.data.token) {
			for (let region in this.regionInstances) {
				let currentRegion = this.regionInstances[region]

				if (oldState.authenticated !== newState.authenticated) {
					if (currentRegion.state?.enabled && newState.authenticated && newState.cloudActive) {
						// Force reload of the cloudActive state in region
						currentRegion.setState({ cloudActive: false })
						currentRegion.setState({ cloudActive: this.data.cloudActive })
					} else {
						currentRegion.destroy()
					}
				}
			}
		}
	}

	/**
	 * Initialize all the regions
	 * @access protected
	 */
	setupRegions() {
		try {
			if (CloudController.availableRegions) {
				/** @type {string[]} */
				const regions = []

				for (const id in CloudController.availableRegions) {
					regions.push(id)
					this.regionInstances[id] = new CloudRegion(this, id, CloudController.availableRegions[id])
				}

				this.setState({
					regions,
				})
			}
		} catch (/** @type {any} */ e) {
			this.logger.silly(e.message)
		}
	}

	/**
	 * If needed, ping all the regions
	 * @access protected
	 */
	timerTick() {
		if (this.state.ping === true) {
			for (let region in this.regionInstances) {
				try {
					this.regionInstances[region].timerTick()
				} catch (e) {}
			}
		}
	}

	/**
	 * Get copies of all the current bank styles
	 * @access protected
	 */
	updateAllBanks() {
		const updateId = v4()
		const data = this.getBanks()
		for (let region in this.regionInstances) {
			if (!!this.regionInstances[region]?.socketTransmit) {
				this.regionInstances[region].socketTransmit('companion-banks:' + this.state.uuid, {
					updateId,
					type: 'full',
					data,
				})
			}
		}
	}

	/**
	 * Store and transmit an updated bank style
	 * @param {import('../Resources/Util.js').ControlLocation} location - the location of the control
	 * @param {import('../Graphics/ImageResult.js').ImageResult} render
	 * @access protected
	 */
	updateBank(location, render) {
		const bank = xyToOldBankIndex(location.column, location.row)
		if (typeof render.style === 'object' && !render.style.cloud && bank) {
			const updateId = v4()
			for (let region in this.regionInstances) {
				if (!!this.regionInstances[region]?.socketTransmit) {
					this.regionInstances[region].socketTransmit('companion-banks:' + this.state.uuid, {
						updateId,
						type: 'single',
						page: location.pageNumber,
						bank,
						data: render.style,
					})
				}
			}
		}
	}
}

export default CloudController

/**
 * @typedef {Object} CloudControllerState
 *
 * @property {string} uuid - the machine UUID
 * @property {boolean} authenticating - is the cloud authenticating
 * @property {boolean} authenticated - is the cloud authenticated
 * @property {string} authenticatedAs - the cloud username
 * @property {boolean} ping - is someone watching the cloud pings
 * @property {string[]} regions - the cloud regions
 * @property {string} tryUsername - the username to try
 * @property {string} tryPassword - the password to try
 * @property {null|string} error - the error message
 * @property {boolean} cloudActive - is the cloud active
 * @property {boolean} canActivate - can the cloud be activated
 */
