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

const _https = require('https')
const fs = require('fs')

class server_https {
	config
	currentState = false
	debug = require('debug')('lib/server_https')
	enableConfig = 'https_enabled'
	express
	initialized = false
	io
	port
	portConfig = 'https_port'
	system
	userconfig = {}

	constructor(system, express, io) {
		this.system = system
		this.express = express
		this.io = io

		this.system.emit('get_userconfig', (userconfig) => {
			for (let key in userconfig) {
				if (key.substring(0, 6) == 'https_') {
					this.userconfig[key] = userconfig[key]
				}
			}
		})

		this.system.on('set_userconfig_key', this.updateUserconfig.bind(this))

		this.system.emit('config_object', (config) => {
			this.config = config

			this.system.on('ip_rebind', () => {
				if (this.userconfig[this.enableConfig] == true) {
					this.disableModule()
					this.enableModule()
				}
			})

			//Delay service start just to let everything sync up
			setTimeout(() => this.init(), 5000)
		})
	}

	checkPortNumber() {
		this.port = this.userconfig[this.portConfig]
	}

	disableModule() {
		if (this.socket) {
			try {
				this.currentState = false
				this.socket.close()
				this.log('info', `Stopped listening on port ${this.port}`)
				delete this.socket
			} catch (e) {}
		}
	}

	enableModule() {
		if (this.initialized === true) {
			if (this.port === undefined) {
				this.checkPortNumber()
			}

			try {
				this.listen()
			} catch (e) {
				this.debug(`Error starting https server`, e)
			}
		}
	}

	handleSocketError(e) {
		let message

		switch (e.code) {
			case 'EADDRINUSE':
				message = `Port ${this.port} already in use.`
				break
			case 'EACCES':
				message = `Access to port ${this.port} denied.`
				break
			default:
				message = `Could not open service on port ${this.port}: ${e.code}`
		}

		this.log('error', message)
		this.disableModule()
	}

	init() {
		this.initialized = true

		if (this.userconfig[this.enableConfig] === true) {
			this.enableModule()
		}
	}

	listen() {
		if (this.socket === undefined) {
			if (this.userconfig.https_cert_type == 'external') {
				if (this.userconfig.https_ext_private_key != '' && this.userconfig.https_ext_certificate != '') {
					try {
						const privateKey = fs.readFileSync(this.userconfig.https_ext_private_key, 'utf8')
						this.log('debug', `Read private key file: ${this.userconfig.https_ext_private_key}`)
						this.debug(`Read private key file: ${this.userconfig.https_ext_private_key}`)

						const certificate = fs.readFileSync(this.userconfig.https_ext_certificate, 'utf8')
						this.log('debug', `Read certificate file: ${this.userconfig.https_ext_certificate}`)
						this.debug(`Read certificate file: ${this.userconfig.https_ext_certificate}`)

						const credentials = {
							key: privateKey,
							cert: certificate,
						}

						if (this.userconfig.https_ext_chain != '' && fs.existsSync(this.userconfig.https_ext_chain)) {
							try {
								const ca = fs.readFileSync(this.userconfig.https_ext_chain, 'utf8')
								this.log('debug', `Read chain file: ${this.userconfig.https_ext_chain}`)
								this.debug(`Read chain file: ${this.userconfig.https_ext_chain}`)
								credentials.ca = ca
							} catch (e) {
								this.log('warn', `Couldn't read chain field: ${e}`)
								this.debug(`Couldn't read chain field: ${e}`)
							}
						}

						this.startServer(credentials)
					} catch (e) {
						this.log('error', `Could not start: ${e}`)
						this.debug(`Could not start: ${e}`)
					}
				} else {
					this.log('error', `Could not start: Private Key and/or Certificate files not set`)
					this.debug(`Could not start: Private Key and/or Certificate files not set`)
				}
			} else {
				if (this.userconfig.https_self_cert_private != '' && this.userconfig.https_self_cert != '') {
					try {
						const credentials = {
							key: this.userconfig.https_self_cert_private,
							cert: this.userconfig.https_self_cert,
						}

						this.startServer(credentials)
					} catch (e) {
						this.log('error', `Could not start: ${e}`)
						this.debug(`Could not start: ${e}`)
					}
				} else {
					this.log('error', `Could not start: Incomplete or no self-signed certificate on file`)
					this.debug(`Could not start: Incomplete or no self-signed certificate on file`)
				}
			}
		}
	}

	log(level, message) {
		try {
			this.system.emit('log', 'https', level, message)
		} catch (e) {
			this.debug(`${level}: ${message}`)
		}
	}

	startServer(credentials) {
		try {
			this.socket = _https.createServer(credentials, this.express)
			this.socket.on('error', this.handleSocketError.bind(this)).listen(this.port, this.config.bind_ip)
			this.io.enableHttps(this.socket)

			this.socket.log = function () {
				let args = Array.prototype.slice.call(arguments)
				args.unshift('log', 'https')
				this.debug(args)
			}

			this.currentState = true
			this.log('info', `Listening at https://${this.config.bind_ip}:${this.port}`)
			this.debug(`Listening at https://${this.config.bind_ip}:${this.port}`)
		} catch (e) {
			this.log('error', `Couldn't bind to port ${this.port}`)
			this.debug(`Couldn't bind to port ${this.port}: ${e}`)
			delete this.socket
		}
	}

	updateUserconfig(key, value) {
		if (key.substring(0, 6) == 'https_') {
			this.userconfig[key] = value

			if (key == this.enableConfig) {
				if (this.currentState == false && value == true) {
					this.enableModule()
				} else if (this.currentState == true && value == false) {
					this.disableModule()
				}
			} else if (key == this.portConfig) {
				if (this.userconfig[this.enableConfig] == true) {
					this.disableModule()
					this.port = value
					this.enableModule()
				} else {
					this.port = value
				}
			} else {
				if (this.userconfig[this.enableConfig] == true) {
					this.disableModule()
					this.enableModule()
				}
			}
		}
	}
}

exports = module.exports = function (system, express, io) {
	return new server_https(system, express, io)
}
