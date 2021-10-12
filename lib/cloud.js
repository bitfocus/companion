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
const SCClient = require("socketcluster-client")
const md5 = (str) => require('crypto').createHash('md5').update(str).digest('hex')
const _ = require('lodash')
const { v4 } = require('uuid')

const debug = require('debug')('lib/cloud')

const regions = {
	'stockholm': '127.0.0.1:8001',
	'virginia': '127.0.0.1:8001'
}

const CLOUD_LOGIN_URL = process.env.NODE_ENV === 'production' ? 'https://cloud.bitfocus.io/api/auth/login' : 'http://127.0.0.1:8002/v1/auth/login'
const CLOUD_HTTPS = false

class Cloud {
	constructor(system) {
		this.system = system
		this.banks = []
		this.uuid = 'N/A'
		this.sockets = {}
		this.knownIds = {}
		this.lastKnownIdCleanup = Date.now()

		this.state = {
			virginiaEnabled: false,
			stockholmEnabled: false,
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

		this.system.emit('update_get', (update) => {
			this.uuid = md5(update.payload?.id);
		})

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
		let response;
		try {
			response = await fetch(CLOUD_LOGIN_URL, {
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
				},
				body: JSON.stringify({ email, password }),
				method: 'POST',
				mode: 'cors',
			})
		} catch (e) {
			console.error("Cloud error: ", e);
			this.setState({ authenticated: false, error: 'Cannot reach authentication/cloud-api server' })
			this.destroy();
			return;
		}

		try {
			const responseObject = await response.json()
			console.log("Cloud result: ", responseObject);
			if (responseObject.token !== undefined) {
				this.token = responseObject.token;
				this.setState({ authenticated: true, error: null })
			} else {
				this.setState({ authenticated: false, error: responseObject.message })
				this.destroy();
			}
		} catch (e) {
			console.error("Cloud error: ", e);
			this.setState({ authenticated: false, error: JSON.stringify(e) })
			this.destroy();
		}
	}

	destroy(region) {
		if ((!region || region === 'stockholm') && this.sockets.stockholm) {
			this.sockets.stockholm.disconnect()
			delete this.sockets.stockholm
		}
		if ((!region || region === 'virginia') && this.sockets.virginia) {
			this.sockets.virginia.disconnect()
			delete this.sockets.virginia
		}

		debug("destroy(%o)", region)
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

		if ((this.state.virginiaEnabled !== newState.virginiaEnabled || this.state.authenticated !== newState.authenticated)) {
			if (newState.virginiaEnabled && newState.authenticated) {
				this.cloudConnect('virginia');
			} else {
				this.destroy('virginia');
			}
		}

		if ((this.state.stockholmEnabled !== newState.stockholmEnabled || this.state.authenticated !== newState.authenticated)) {
			if (newState.stockholmEnabled && newState.authenticated) {
				this.cloudConnect('stockholm');
			} else {
				this.destroy('stockholm');
			}
		}
		
		this.state = newState
	}

	mergeStyleForBank(page, bank) {
		let feedbackStyle = {};
		let style = this.banks[page][bank];

		if (style.text) {
			system.emit('variable_parse', style.text, (str) => {
				this.banks[page][bank].text = str;
			})
		}

		system.emit('feedback_get_style', page, bank, (style) => {
			if (style !== undefined) {
				feedbackStyle = { ...style };
			}
		});

		return {
			...this.banks[page][bank],
			...feedbackStyle
		};
	}

	async transmitFull(socket) {
		this.system.emit('db_get', 'bank', (banks) => {
			this.banks = _.cloneDeep(banks)

			for (let page in this.banks) {
				for (let bank in this.banks[page]) {
					this.banks[page][bank] = this.mergeStyleForBank(page, bank)
				}
			}

			currentSocket.transmitPublish('companion-banks:' + this.uuid, {
				type: 'full',
				data: this.banks
			});
		});	
	
	}

	async cloudConnect(region) {
		debug('Connecting');
		this.sockets[region] = SCClient.create({
			hostname: regions[region],
			secure: CLOUD_HTTPS,
			autoReconnectOptions: {
				initialDelay: 1000, //milliseconds
				randomness: 500, //milliseconds
				multiplier: 1.5, //decimal
				maxDelay: 20000 //milliseconds
			}
		});

		(async () => {
			while (this.sockets[region]) {
				let currentSocket = this.sockets[region];
				for await (let _event of currentSocket.listener("connect")) {  // eslint-disable-line
					debug('Socket is connected')

					if (this.uuid === 'N/A') {
						console.error('Error fetching unique machine id');
						this.system.emit('log', 'cloud', 'error', 'Error logging into cloud: Error fetching unique machine id');
						return;
					}

					try {
						const login = await currentSocket.invoke('cloudLogin', { token: this.token, uuid: this.uuid });
						debug("Login ok: ", login);
					} catch (e) {
						console.error('Error logging into cloud socket: ', e);
						this.system.emit('log', 'cloud', 'error', 'Error logging into cloud: ' + e.message);
					}
				}
				await delay(1000);
				console.log("Are we still connected?");
			}
		})();

		(async () => {
			while (this.sockets[region]) {
				let currentSocket = this.sockets[region];

				for await (let event of currentSocket.listener('authenticate')) {
					console.log(`[${region}] Connected OK!!`, this.uuid);

					// TODO: Remove when disconnected

					// In case a client is already listening
					this.transmitFull();
				}
			}
		})();

		this.registerCompanionProcs(this.sockets[region], 'getBanks', (...args) => this.clientGetBanks(...args));
		this.registerCompanionProcs(this.sockets[region], 'push', (...args) => this.clientPushBank(...args));
		this.registerCompanionProcs(this.sockets[region], 'release', (...args) => this.clientReleaseBank(...args));

		this.system.on('graphics_bank_invalidate', (page, bank) => this.updateBank(page, bank));

		setImmediate(() => {
			this.system.emit('db_get', 'bank', (banks) => {
				this.banks = _.cloneDeep(banks)
			});
		});
	}

	async clientGetBanks(args) {
		console.log("Client requested getBanks()");
		return this.banks;
	}

	async clientPushBank(args) {
		console.log("Client requested pushBank(" + JSON.stringify(args) + ")");
		if (args.bank && args.page) {
			this.system.emit('bank_pressed', parseInt(args.page), parseInt(args.bank), true)
		}
		return true;
	}

	async clientReleaseBank(args) {
		console.log("Client requested releaseBank(" + JSON.stringify(args) + ")");
		if (args.bank && args.page) {
			this.system.emit('bank_pressed', parseInt(args.page), parseInt(args.bank), false)
		}
		return true;
	}

	registerCompanionProcs(socket, name, callback) {
		if (typeof callback === 'function') {
			(async () => {
				for await (let data of socket.subscribe(`companionProc:${this.uuid}:${name}`, { waitForAuth: true })) {
					if (this.knownIds[data.callerId]) {
						// Already handeled
						debug('Ignored redundant message %o', data.callerId)
						return;
					}
					this.knownIds[data.callerId] = Date.now()

					debug('Received RPC for %o', name);
					try {
						const result = await callback(...data.args);
						socket.invokePublish('companionProcResult:' + data.callerId, { result: result });
						debug('rpc result: %o : %o', 'companionProcResult:' + data.callerId, result);
					} catch (e) {
						socket.invokePublish('companionProcResult:' + data.callerId, { error: e.message });
						debug('rpc error: %o', e.message);
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
			})();	
		}
	}

	async updateBank(page, bank) {
		this.system.emit('db_get', 'bank', (banks) => {
			const updateId = v4();
			this.banks[page][bank] = _.cloneDeep(banks[page][bank]);
			this.banks[page][bank] = this.mergeStyleForBank(page, bank);

			for (let region in regions) {
				if (this.sockets[region]) {
					this.sockets[region].transmitPublish('companion-banks:' + this.uuid, {
						updateId,
						type: 'single',
						page,
						bank,
						data: this.banks[page][bank]
					});
				}
			}
		});
	}
}

module.exports = (system) => new Cloud(system)
