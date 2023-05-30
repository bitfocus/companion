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

import SCClient from 'socketcluster-client'
import { isEqual } from 'lodash-es'
import { delay } from '../Resources/Util.js'
import { CreateBankControlId } from '../Shared/ControlId.js'
import LogController from '../Log/Controller.js'

/**
 * Functionality for a connection region for cloud control
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 */
class CloudRegion {
	/**
	 * The logger for this class
	 * @type {ReturnType<typeof LogController.createLogger>}
	 * @access protected
	 */
	logger
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
	 * @type {CloudRegionState}
	 * @access public
	 */
	state = {
		connected: false,
		enabled: false,
		loginRetry: -1,
		error: '',
		id: '',
		name: '',
		pingResults: -1,
		cloudActive: false,
	}

	/**
	 * Setup a Bitfocus Cloud region
	 * @param {Cloud} cloud - the cloud controller
	 * @param {string} id - this unique ID
	 * @param {Object} data - setup data for the region
	 */
	constructor(cloud, id, data) {
		this.cloud = cloud
		this.io = cloud.io
		this.log = cloud.log
		this.logger = LogController.createLogger(`Cloud/${id}`)

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
			throw 'Name not defined'
		}
	}

	/**
	 * Process a <code>getBanks</code> call from a remote client
	 * @async
	 * @param {*} args - incoming arguments
	 * @returns {Object} the bank database
	 * @access protected
	 */
	async clientGetBanks(args) {
		this.logger.silly('Client requested getBanks()')
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
		this.logger.silly(`Client requested pushBank(${JSON.stringify(args)})`)
		if (args.bank && args.page) {
			this.cloud.registry?.controls?.pressControl(
				CreateBankControlId(parseInt(args.page), parseInt(args.bank)),
				true,
				'cloud'
			)
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
		this.logger.silly(`Client requested releaseBank(${JSON.stringify(args)})`)
		if (args.bank && args.page) {
			this.cloud.registry?.controls?.pressControl(
				CreateBankControlId(parseInt(args.page), parseInt(args.bank)),
				false,
				'cloud'
			)
		}
		return true
	}

	/**
	 * Authenticate companion server client
	 *
	 * NB: This function does not throw errors
	 * @async
	 * @access protected
	 */
	async clientAuthenticate() {
		try {
			const login = await this.socket.invoke('cloudLogin', {
				token: this.cloud.data.token,
				uuid: this.cloud.state.uuid,
				companionId: this.cloud.companionId,
				version: this.cloud.registry.appBuild,
			})
			this.logger.debug('Login ok')

			this.setState({ connected: true, error: '' })
			try {
				await this.transmitFull()
			} catch (e) {
				if (this.isEnabled) {
					this.logger.error(`Error transmitting full state: ${e.message}`)
				}
			}
		} catch (e) {
			if (this.isEnabled) {
				this.logger.error(`Error logging into cloud: ${e.message}, retrying`)
				this.setState({ connected: false, error: e.message, loginRetry: 5 })
			}
		}
	}

	/**
	 * Connect to the cloud service
	 * @async
	 * @access protected
	 */
	async cloudConnect() {
		this.logger.debug('Connecting')

		if (this.socket !== undefined) {
			this.destroy()
		}

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
					this.logger.debug('Socket is connected')

					if (this.cloud.state.uuid === '') {
						this.logger.error('Error logging into cloud: Error fetching unique machine id')
						return
					}

					this.clientAuthenticate()
				}
				await delay(1000)
				//this.logger.silly('Are we still connected?')
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('authenticate')) {
					// In case a client is already listening
					if (this.socket.authState !== 'authenticated') {
						this.logger.error(`Connection lost authentication, retrying`)
						this.setState({ connected: false, error: 'Authentication issues, retrying', loginRetry: 5 })
					}
				}
			}
		})()
		;(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('error')) {
					if (event.error.code === 4401) {
						// Disconnected by another process with the same id, let us disable this cloud intance,
						// to prevent connection looping
						this.logger.error(
							`Disconnected from cloud by another instance from this computer, disabled cloud region ${this.state.name}`
						)
						this.setState({
							enabled: false,
							connected: false,
							pingResults: -1,
							error: 'Disconnected from cloud by another instance from this computer',
						})
					} else {
						//console.log(`DISCONNECT::::::::`, event)
						this.setState({
							connected: false,
							pingResults: -1,
							error: '',
						})
					}
				}
			}
		})()

		this.registerCompanionProcs(this.socket, 'allbanks', this.clientGetBanks.bind(this))
		this.registerCompanionProcs(this.socket, 'push', this.clientPushBank.bind(this))
		this.registerCompanionProcs(this.socket, 'release', this.clientReleaseBank.bind(this))
		this.registerCompanionProcs(this.socket, 'ping', this.clientPing.bind(this))
	}

	/**
	 * Process a <code>ping</code> call from a remote client
	 * @async
	 * @returns {true} ping was successful
	 * @access protected
	 */
	clientPing() {
		return true
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

		this.logger.silly(`destroy(${this.id})`)
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
						//this.logger.debug('Ignored redundant message %o', data.callerId)
						continue
					}
					this.cloud.knownIds[data.callerId] = Date.now()

					this.logger.silly(`Received RPC for ${name}`)
					try {
						const result = await callback(...data.args)
						await socket.invokePublish('companionProcResult:' + data.callerId, { result: result })
						this.logger.silly(`rpc result: companionProcResult:${data.callerId} : ${result}`)
					} catch (e) {
						if (this.isEnabled) {
							try {
								await socket.invokePublish('companionProcResult:' + data.callerId, { error: e.message })
							} catch (e) {}
						}
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
	 * @param {Partial<CloudRegionState>} draftState - the updated state(s)
	 * @access protected
	 */
	setState(draftState) {
		const newState = {
			...this.state,
			...draftState,
		}

		if ((!newState.enabled || !newState.cloudActive) && draftState.error) {
			// Don't save error when disabled
			delete newState.error
		}

		let abortState = false

		if (this.cloud.data.token) {
			if (this.state.enabled != newState.enabled) {
				this.cloud.saveConnection(this.id, newState.enabled)
			}

			if (this.state.cloudActive && !newState.cloudActive) {
				// Disabled cloud
				if (this.state.enabled && this.cloud.state.authenticated) {
					this.state = newState
					this.io.emit('cloud_region_state', this.id, newState)
					this.destroy()
					abortState = true // already set state
				}
			} else if (!this.state.cloudActive && newState.cloudActive) {
				// Enabled cloud
				if (newState.enabled && this.cloud.state.authenticated) {
					this.cloudConnect()
				}
			}
		}

		if (!abortState) {
			if (!isEqual(newState, this.state)) {
				this.io.emit('cloud_region_state', this.id, newState)
			}

			this.state = newState
		}
	}

	/**
	 * Transmit information to the cloud service
	 * @param  {...any} args
	 * @access public
	 */
	async socketTransmit(...args) {
		if (this.socket !== undefined) {
			try {
				await this.socket.transmitPublish(...args)
			} catch (e) {
				this.logger.debug(`couldn't transmit to ${this.state.name}`)
			}
		}
	}

	/**
	 * Are we enabled and cloud is active?
	 * @returns {boolean} true if enabled and cloud is active
	 */
	get isEnabled() {
		return this.state.enabled && this.state.cloudActive
	}

	/**
	 * Send a ping to the cloud service
	 * @access public
	 */
	timerTick() {
		if (this.socket !== undefined) {
			;(async () => {
				if (this.isEnabled && this.state.loginRetry >= 0) {
					this.setState({ loginRetry: this.state.loginRetry - 1 })
					if (this.state.loginRetry === -1) {
						this.clientAuthenticate()
					}
				}
				try {
					if (this.isEnabled && this.socket.state == this.socket.OPEN) {
						const startTime = Date.now()
						const result = await this.socket.invoke('ping', startTime)

						if (result && this.isEnabled) {
							this.setState({ pingResults: Date.now() - result })
						}
					}
				} catch (e) {
					// Handle error
					if (this.state.isEnabled) {
						this.setState({ error: e.message })
						this.logger.silly(`couldn't ping ${this.state.name}: ${e.message}`)
					}
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
		await this.socket.transmitPublish('companion-banks:' + this.cloud.state.uuid, {
			type: 'full',
			data: this.cloud.getBanks(),
		})
	}

	/**
	 * Update the region
	 * @param {Object} data - setup data for the region
	 */
	updateSetup(data) {
		if (data.name) {
			this.setState({ name: data.name })
		}

		if (data.host && this.host !== data.host) {
			this.destroy()
			this.host = data.host

			if (this.cloud.state.authenticated && this.isEnabled) {
				this.cloudConnect()
			}
		}
	}
}

export default CloudRegion

/**
 * @typedef {Object} CloudRegionState
 *
 * @property {boolean} connected - is the cloud service connected
 * @property {boolean} enabled - is the region enabled
 * @property {number} loginRetry - number of ticks before retrying login
 * @property {string} error - error message
 * @property {string} id - region id
 * @property {string} name - region name
 * @property {number} pingResults - ping result
 * @property {boolean} cloudActive - is the cloud service active
 */
