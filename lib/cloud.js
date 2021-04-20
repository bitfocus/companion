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

const { client } = require('websocket')

const debug = require('debug')('lib/cloud')

class Cloud {
	constructor(system) {
		this.system = system

		this.state = {
			enabled: false,
			tryUsername: '',
			tryPassword: '',
			tryNow: false,
			tryError: null,
			authenticated: false,
			secret: 'secret',
			gui: 'gui',
		}

		debug('constructor:io_get->request')

		this.system.emit('io_get', (io) => {
			debug('constructor:io_get->response')
			this.initializeIO(io)
		})

		/*
		setInterval( () => {
			this.setState({ enabled: !this.state.enabled })
		}, 3000)*/

	}

	initializeIO(io) {
		debug('initializeIO')
		this.io = io
		this.io.on('connect', (client) => {
			debug('initializeClient:connect')
			this.initializeClient(client)
		})
	}

	initializeClient(client) {
		debug('initializeClient')
		client.on('cloud_state_get', () => this.handleCloudStateRequest(client))
		client.on('cloud_state_set', (newState) => this.handleCloudStateSet(client, newState))
		client.on('cloud_login', (username, password) => this.handleCloudLogin(client, username, password))
		client.on('cloud_logout', () => this.handleCloudLogout(client))
	}

	handleCloudStateRequest(client) {
		debug('handleCloudStateRequest')
		client.emit('cloud_state', this.state)
	}

	handleCloudStateSet(client, newState) {
		debug('handleCloudStateRequest', newState)
		this.setState({ ...newState }, client)
	}

	handleCloudLogin(client, username, password) {
		// TODO: more logic
		console.log("TRY", username, password)
		this.setState({ authenticated: true })
	}

	handleCloudLogout(client) {
		// TODO: more logic
		this.setState({ authenticated: false })
	}

	setState(draftState, sourceClient = null) {
		const newState = {
			...this.state,
			...draftState,
		}

		if (JSON.stringify(newState) !== JSON.stringify(this.state)) {
			if (sourceClient !== null) {
				sourceClient.broadcast.emit('cloud_state', newState)
			} else {
				this.io.emit('cloud_state', newState)
			}
		}

		this.state = newState
	}
}

module.exports = (system) => new Cloud(system)
