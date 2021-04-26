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
const fetch = require('node-fetch')
const SCClient = require("socketcluster-client")
const { v4 } = require('uuid')

const debug = require('debug')('lib/cloud')

const CLOUD_URL = '127.0.0.1:8001'
const CLOUD_HTTPS = false

class Cloud {
	constructor(system) {
		this.system = system
		this.banks = []

		this.state = {
			enabled: false,
			tryUsername: '',
			tryPassword: '',
			tryNow: false,
			tryError: null,
			authenticated: false,
			connected_primary: false,
			connected_secondary: false,
			ok_primary: false,
			ok_secondary: false,
			secret: 'secret',
			gui: 'gui',
			token: ''
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
		client.on('cloud_login', (email, password) => this.handleCloudLogin(client, email, password))
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

	async handleCloudLogin(client, email, password) {

		// TODO: more logic
		let preFailed = false
		const response = await fetch('https://cloud.bitfocus.io/api/auth/login', {
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
			},
			referrer: 'http://127.0.0.1:4000/',
			referrerPolicy: 'strict-origin-when-cross-origin',
			body: JSON.stringify({ email, password }),
			method: 'POST',
			mode: 'cors',
		}).catch((e) => {
			this.setState({ authenticated: false, error: 'Cannot reach authentication/cloud-api server' })
			this.destroy();
			preFailed = true
		})

		try {
			const responseObject = await response.json()
			if (responseObject.token !== undefined) {
				this.token = responseObject.token;
				this.setState({ authenticated: true, error: null })
			} else {
				this.setState({ authenticated: false, error: responseObject.message })
				this.destroy();
			}
		} catch (e) {
			this.setState({ authenticated: false, error: JSON.stringify(e) })
			this.destroy();
		}
	}

	destroy() {
		if (this.socket) {
			this.socket.disconnect()
			delete this.socket
		}

		debug("destroy")
	}

	handleCloudLogout(client) {
		// TODO: more logic
		this.setState({ authenticated: false })
		this.destroy()
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

		if ((this.state.enabled !== newState.enabled || this.state.authenticated !== newState.authenticated) && newState.enabled && newState.authenticated) {
			this.cloudConnect();
		}

		this.state = newState
	}

	async cloudConnect() {
		debug('Connecting');
		this.socket = SCClient.create({
			hostname: CLOUD_URL,
			secure: CLOUD_HTTPS,
			autoReconnectOptions: {
				initialDelay: 1000, //milliseconds
				randomness: 500, //milliseconds
				multiplier: 1.5, //decimal
				maxDelay: 20000 //milliseconds
			}
		});

		(async () => {
			while (this.socket) {
				for await (let _event of this.socket.listener("connect")) {  // eslint-disable-line
					debug('Socket is connected')

					try {
						const login = await this.socket.invoke('cloudLogin', this.token);
						console.log("Login ok: ", login);
						this.clientId = 'f9dea790-13ea-4240-8dcc-a0749ca7a368';//v4();
					} catch (e) {
						console.error('Error logging into cloud socket: ', e);
					}
				}
				await delay(1000);
			}
		})();

		(async () => {
			while (this.socket) {
				for await (let event of this.socket.listener('authenticate')) {
					console.log("OK!!", this.clientId);

					// TODO: Remove when disconnected
					this.registerClientProcs('getBanks', (args, remoteId) => this.clientGetBanks(args, remoteId));

					if (event.authToken) {
						this.system.emit('db_get', 'bank', (banks) => {
							this.banks = banks;
				
							this.socket.transmitPublish('companion-banks:' + this.clientId, {
								type: 'full',
								data: banks
							});
						});	
					}
				}
			}
		})();

		this.system.on('graphics_bank_invalidate', (page, bank) => this.updateBank(page, bank));

		setImmediate(() => {
			this.system.emit('db_get', 'bank', (banks) => {
				this.banks = banks;
			});
		});
	}

	async clientGetBanks(args, remoteId) {
		console.log("Client " + remoteId + " requested getBanks()");
		return this.banks;
	}

	registerClientProcs(name, callback) {
		if (typeof callback === 'function') {
			(async () => {
				for await (let data of this.socket.subscribe(`clientProc:${this.clientId}:${name}`, { waitForAuth: true })) {
					try {
						const result = await callback(data.args, data.callerId);
						this.socket.transmitPublish(data.replyChannel, { result: result });
					} catch (e) {
						this.socket.transmitPublish(data.replyChannel, { error: e.message });
					}
				}
			})();	
		}
	}

	async updateBank(page, bank) {
		this.system.emit('db_get', 'bank', (banks) => {
			this.banks = banks;

			this.socket.transmitPublish('companion-banks:' + this.clientId, {
				type: 'single',
				page,
				bank,
				data: banks[page][bank]
			});
		});
	}
}

module.exports = (system) => new Cloud(system)
