const fs = require('fs');
const debug = require('debug')('lib/bitfocus-cloud');
const SCClient = require("socketcluster-client");
const shortid = require('shortid');
const { delay } = require('./resources/timer');

class BitfocusCloudError extends Error {
	constructor(name, message) {
		super(message);
		this.name = name;
	}
}

class BitfocusCloud {
	/**
	 * @param {EventEmitter} _system
	 */
	constructor(_system) {
		/** @type {EventEmitter} */
		this.system = _system;
		this.banks = [];
		this.timeout = 5000;

		this.clientId = '123-123-123-124';

		debug('Constructing');
		this.connect();
	}

	async connect() {
		debug('Connecting');
		this.socket = SCClient.create({
			hostname: '127.0.0.1',
			port: 8001,
			secure: false,
			autoReconnectOptions: {
				initialDelay: 1000, //milliseconds
				randomness: 500, //milliseconds
				multiplier: 1.5, //decimal
				maxDelay: 20000 //milliseconds
			}
		});

		(async () => {
			while (1) {
				for await (let _event of this.socket.listener("connect")) {  // eslint-disable-line
					debug('Socket is connected')

					this.system.emit('db_get', 'bank', (banks) => {
						this.banks = banks;
			
						this.socket.transmitPublish('companion-banks:' + this.clientId, {
							type: 'full',
							data: banks
						});
					});

				}
				await delay(1000);
			}
		})();

		this.registerClientProcs('getBanks', (args, remoteId) => this.clientGetBanks(args, remoteId));

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
				for await (let data of this.socket.subscribe(`clientProc:${this.clientId}:${name}`)) {
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

	async clientCommand(clientId, name, ...args) {
		const id = shortid.generate();
		const replyChannel = 'clientProcResult:' + id;

		return new Promise((resolve, reject) => {
			setTimeout(() => {
				reject(new BitfocusCloudError('call_timeout', 'ClientCommand timeout for ' + name));
				this.socket.unsubscribe(replyChannel);
				this.socket.closeChannel(replyChannel);
			}, this.timeout);
	
			(async () => {
				for await (let data of this.socket.subscribe(replyChannel)) {
					if (data.error) {
						reject(new Error('rpc error: ' + data.error));
					} else {
						resolve(data.result);
					}

					this.socket.unsubscribe(replyChannel);
					this.socket.closeChannel(replyChannel);
				}
			})();

			this.socket.transmitPublish(`clientProc:${clientId}:${name}`, { replyChannel, args, callerId: this.clientId });
		});
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

module.exports = (system) => new BitfocusCloud(system)
