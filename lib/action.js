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

var debug   = require('debug')('lib/action');
var shortid = require('shortid');
const { SendResult } = require('./resources/utils');

class action {

	constructor(system) {
		this.system = system;

		this.actions = {};
		this.bank_actions = {};
		this.bank_release_actions = {};
		this.bank_status = {};
		this.instance = {};
		this.actions_running = new Set();
		this.timers_running = new Map();

		this.system.emit('db_get', 'bank_actions', (res) => {
			if (res !== undefined) {
				this.bank_actions = res;
			}
		});

		this.system.emit('db_get', 'bank_release_actions', (res) => {
			if (res !== undefined) {
				this.bank_release_actions = res;
			}
		});

		// skipNext needed for 'bank_pressed' callback
		this.skipNext = {};
		this.pageStyles = ['pageup','pagenum','pagedown'];

		this.system.on('15to32', this.upgrade15to32.bind(this));

		this.system.on('action_abort_bank', this.abortSingleBank.bind(this)); 
		this.system.on('action_bank_status_get', this.getBankStatus.bind(this));
		this.system.on('action_delayed_abort', this.abortDelayedActions.bind(this));
		this.system.on('action_get_banks', this.getBankActions.bind(this));
		this.system.on('action_run', this.runAction.bind(this));
		this.system.on('action_running_get', this.getRunningActions.bind(this));
		this.system.on('action_save', this.saveActions.bind(this));
		this.system.on('action_subscribe_bank', this.subscribeBank.bind(this));
		this.system.on('action_unsubscribe_bank', this.unsubscribeBank.bind(this));
		this.system.on('actions_update', this.updateActions.bind(this));

		this.system.on('actions_for_instance', this.getInstanceActions.bind(this));

		this.system.on('bank_pressed', this.bankPressed.bind(this));
		this.system.on('bank_reset', this.resetBank.bind(this));

		this.system.on('instance', this.setInstance.bind(this));
		this.system.on('instance_actions', this.setInstanceActions.bind(this));
		this.system.on('instance_delete', this.deleteInstance.bind(this));
		this.system.on('instance_save', this.saveInstance.bind(this));
		this.system.on('instance_status_check_bank', this.checkBank.bind(this));
		this.system.on('instance_status_set', this.setInstanceStatus.bind(this));

		this.system.on('release_action_save', this.saveReleaseActions.bind(this));
		this.system.on('release_action_get_banks', this.getBankReleaseActions.bind(this));

		this.system.on('release_actions_for_instance', this.getInstanceReleaseActions.bind(this));

		this.system.emit('io_get', (io) => {
			this.io = io;

			this.system.on('io_connect', (client) => {

				client.on('get_actions', () => {
					client.emit('actions', this.actions);
				});

				client.on('bank_update_action_delay', this.updateBankActionDelay.bind(this));
				client.on('bank_update_action_option', this.updateBankActionOption.bind(this));
				client.on('bank_update_action_option_order', this.updateBankActionOrder.bind(this));

				client.on('bank_update_release_action_delay', this.updateBankReleaseActionDelay.bind(this));
				client.on('bank_release_action_update_option', this.updateBankReleaseActionOption.bind(this));
				client.on('bank_release_action_update_option_order', this.updateBankReleaseActionOrder.bind(this));

				client.on('bank_action_add', (page, bank, action, answer) => {
					this.addBankAction(page, bank, action);

					this.saveActions();
					SendResult(client, answer, 'bank_actions_get:result', page, bank, this.bank_actions[page][bank] );
					this.checkBank(page, bank);
				});

				client.on('bank_addReleaseAction', (page, bank, action, answer) => {
					this.addBankReleaseAction(page, bank, action);

					this.saveReleaseActions();
					SendResult(client, answer, 'bank_release_actions_get:result', page, bank, this.bank_release_actions[page][bank] );
					this.checkBank(page, bank);
				});

				client.on('bank_action_delete', (page, bank, id, answer) => {
					this.deleteBankAction(page, bank, id);

					this.saveActions();
					SendResult(client, answer, 'bank_actions_get:result', page, bank, this.bank_actions[page][bank] );
					this.checkBank(page, bank);
				});

				client.on('bank_release_action_delete', (page, bank, id, answer) => {
					this.deleteBankReleaseAction(page, bank, id);

					this.saveReleaseActions();
					SendResult(client, answer, 'bank_release_actions_get:result', page, bank, this.bank_release_actions[page][bank] );
					this.checkBank(page, bank);
				});


				client.on('bank_actions_get', (page, bank, answer) => {
					if (this.bank_actions[page] === undefined) this.bank_actions[page] = {};
					if (this.bank_actions[page][bank] === undefined) this.bank_actions[page][bank] = [];
					SendResult(client, answer, 'bank_actions_get:result', page, bank, this.bank_actions[page][bank] );
				});

				client.on('bank_release_actions_get', (page, bank, answer) => {
					if (this.bank_release_actions[page] === undefined) this.bank_release_actions[page] = {};
					if (this.bank_release_actions[page][bank] === undefined) this.bank_release_actions[page][bank] = [];
					SendResult(client, answer, 'bank_release_actions_get:result', page, bank, this.bank_release_actions[page][bank] );
				});
			});
		});
	}

	abortDelayedActions() {

		debug("Aborting delayed actions");

		for (let timer of this.timers_running.keys()) {
			debug("clearing timer");
			clearTimeout(timer);
		}

		this.timers_running.clear()

		var actions_running = this.actions_running; //clone hack
		this.actions_running = new Set(); // clear the array

		for (let bid of actions_running.keys()) {
			const a = bid.split("_");
			this.system.emit('graphics_bank_invalidate', a[0], a[1]);
		}
	}

	abortSingleBank(page, bank, unlatch) {

		var bid = page + '_' + bank;
		var cleared = 0;

		this.actions_running.delete(bid);

		this.timers_running.forEach((timerId, timer) => {
			if (timerId === bid) {
				if (cleared == 0) {
					debug("Aborting button ",page,",",bank);
				}
				clearTimeout(timer);
				this.timers_running.delete(timer);
				cleared += 1;
			}
		})

		// if requested, reset and skip up-actions
		if (unlatch) {
			this.system.emit('graphics_indicate_push', page, bank, false);
		}

		if (cleared > 0) {
			this.system.emit('graphics_bank_invalidate', page, bank);
		}
	}

	addBankAction(page, bank, action) {
		if (this.bank_actions[page] === undefined) this.bank_actions[page] = {};
		if (this.bank_actions[page][bank] === undefined) this.bank_actions[page][bank] = [];
		var s = action.split(/:/);

		var act = {
			'id': shortid.generate(),
			'label': action,
			'instance': s[0],
			'action': s[1],
			'options': {}
		};

		if (!this.instance.store.db[act.instance]) {
			// Action is not valid
			return
		}

		if (this.actions[action] !== undefined) {
			var definition = this.actions[action];

			if (definition.options !== undefined && definition.options.length > 0) {
				for(var j in definition.options) {
					var opt = definition.options[j];
					act.options[opt.id] = opt.default;
				}
			}
		}

		this.bank_actions[page][bank].push(act);
		this.subscribeAction(act);
	}

	addBankReleaseAction(page, bank, action) {
		if (this.bank_release_actions[page] === undefined) this.bank_release_actions[page] = {};
		if (this.bank_release_actions[page][bank] === undefined) this.bank_release_actions[page][bank] = [];
		var s = action.split(/:/);

		var act = {
			'id': shortid.generate(),
			'label': action,
			'instance': s[0],
			'action': s[1],
			'options': {}
		};

		if (!this.instance.store.db[act.instance]) {
			// Action is not valid
			return
		}

		if (this.actions[action] !== undefined) {
			var definition = this.actions[action];

			if (definition.options !== undefined && definition.options.length > 0) {
				for(var j in definition.options) {
					var opt = definition.options[j];
					act.options[opt.id] = opt.default;
				}
			}
		}

		this.bank_release_actions[page][bank].push(act);
		this.subscribeAction(act);
	}

	bankPressed(page, bank, direction, deviceid) {
		var bank_config;

		this.system.emit('get_bank', page, bank, function(config) {
			bank_config = config;
		});

		if (bank_config.latch) {
			var pb = page + "_" + bank;

			if (deviceid == undefined) {
				// web buttons and osc don't set deviceid
				deviceid = "osc-web";
			}

			if (this.skipNext[pb] != undefined) {
				// ignore release after latching press
				// from this device
				if (this.skipNext[pb] == deviceid) {
					delete this.skipNext[pb];	// reduce memory creep
					return;
				}
			}

			let reject = false;
			this.system.emit('graphics_is_pushed', page, bank, function (pushed) {
				let isPushed = (1 == pushed? true : false);
				// button is being pressed but not yet latched
				// the next button-release from this device needs to be skipped
				// because the 'release' would immediately un-latch the button
				if (direction && !isPushed) {
					this.skipNext[pb] = deviceid;
				} else if (direction && pushed) {
					// button is latched, prevent duplicate down actions
					// the following 'release' will run the up actions
					reject = true;
				} else if (!(direction || pushed)) {
					// button is up, prevent duplicate up actions
					reject = true;
				}
			});

			if (reject) {
				//debug("Latch button duplicate " + (direction? "down":"up") )
				return;
			}
		}

		// magic page keys only respond to push so ignore the release
		// they also don't have a 'pushed' graphics indication
		// so process the action and return before trying to
		// indicate 'pushed'. Otherwise when the 'unpush' graphics
		// occurs, it will re-draw the old button on the new (wrong) page
		if (this.pageStyles.includes(bank_config.style)) {
			if (direction === true) {
				if (bank_config.style == 'pageup') {
					this.system.emit('device_page_up', deviceid);
				}
				else if (bank_config.style == 'pagenum') {
					this.system.emit('device_page_set', deviceid, 1);
				}
				else if (bank_config.style == 'pagedown') {
					this.system.emit('device_page_down', deviceid);
				}
			}
			// no actions allowed on page buttons so we're done
			return;

		}

		this.system.emit('graphics_indicate_push', page, bank, direction, deviceid);


		var obj = this.bank_actions;

		// find release actions if the direction is up
		if (direction === false) {
			obj = this.bank_release_actions;
		}

		if (obj[page] === undefined || obj[page][bank] === undefined || obj[page][bank].length === 0) {
			return;
		}

		debug('found actions');

		// Handle whether the delays are absolute or relative.
		var action_delay = 0;
		for (var n in obj[page][bank]) {
			var a = obj[page][bank][n];
			var this_delay = parseInt(a.delay === undefined || a.delay === '' ? 0 : a.delay);

			if (bank_config.relative_delay) {
				// Relative delay: each action's delay adds to the next.
				action_delay += this_delay;
			} else {
				// Absolute delay: each delay is its own.
				action_delay = this_delay;
			}

			// Create the property .effective_delay. Don't change the user's .delay property.
			a.effective_delay = action_delay;
		}

		const bankId = `${page}_${bank}`

		let has_delayed = false;
		for (var n in obj[page][bank]) {
			var a = obj[page][bank][n];
			var delay = a.effective_delay === undefined ? 0 : parseInt(a.effective_delay);
			delete a.effective_delay;

			debug("Running action", a);

			if (this.instance !== undefined && this.instance.store !== undefined && this.instance.store.db !== undefined) {
				if (this.instance.store.db[a.instance] !== undefined && this.instance.store.db[a.instance].enabled !== false) {

					// is this a timedelayed action?
					if (delay > 0) {

						has_delayed = true;

						(function(action, delay_time) {
							var timer = setTimeout(function() {
								this.runAction(action, { deviceid: deviceid, page: page, bank: bank });

								this.timers_running.delete(timer);

								// Stop timer-indication
								const hasAnotherTimer = Array.from(this.timers_running.values()).find(v => v === bankId)
								if (hasAnotherTimer === undefined) {
									this.actions_running.delete(bankId)
									this.system.emit('graphics_bank_invalidate', page, bank);
								}

							}, delay_time);

							this.timers_running.set(timer, bankId);
						})(a, delay);
					}

					// or is it immediate
					else {
						this.runAction(a, { deviceid: deviceid, page: page, bank: bank });
					}
				}
				else {
					debug("not running action for disabled instance");
				}
			}
			else {
				debug("wow, instance store didn't exist");
			}
		}

		if (has_delayed) {
			// Start timer-indication
			this.actions_running.add(bankId);

			this.system.emit('graphics_bank_invalidate', page, bank);
		}
	}

	checkBank(page, bank) {
		var status = 0;

		if (this.bank_actions[page] === undefined || this.bank_actions[page][bank] === undefined) {
			return;
		}

		for (var i = 0; i < this.bank_actions[page][bank].length ; ++i) {
			var action = this.bank_actions[page][bank][i];
			this.system.emit('instance_status_get', action.instance, function (instance_status) {
				if (instance_status !== undefined && status < instance_status[0]) {
					status = instance_status[0];
				}
			});
		}

		if (status != this.bank_status[page + '_' + bank]) {
			this.bank_status[page + '_' + bank] = status;
			this.system.emit('action_bank_status_set', page, bank, status);
		}
	}

	cleanupActionsList(actions) {
		const res = {}

		for (var page in actions) {
			res[page] = {}
			for (var bank in actions[page]) {
				res[page][bank] = []

				if (actions[page][bank] !== undefined) {
					for (var i = 0; i < actions[page][bank].length ; ++i) {
						const action = actions[page][bank][i]
						if (action && this.instance.store.db[action.instance]) {
							res[page][bank].push(action)
						}
					}
				}
			}
		}

		return res
	}

	deleteBankAction(page, bank, id) {
		var ba = this.bank_actions[page][bank];

		for (var n in ba) {
			if (ba[n].id == id) {
				this.unsubscribeAction(this.bank_actions[page][bank][n])
				delete this.bank_actions[page][bank][n];
				break;
			}
		}

		var cleanup = [];

		for (var n in ba) {
			if (ba[n] !== null) {
				cleanup.push(ba[n]);
			}
		}

		this.bank_actions[page][bank] = cleanup;
	}

	deleteBankReleaseAction(page, bank, id) {
		var ba = this.bank_release_actions[page][bank];

		for (var n in ba) {
			if (ba[n].id == id) {
				this.unsubscribeAction(this.bank_release_actions[page][bank][n])
				delete this.bank_release_actions[page][bank][n];
				break;
			}
		}

		var cleanup = [];

		for (var n in ba) {
			if (ba[n] !== null) {
				cleanup.push(ba[n]);
			}
		}

		this.bank_release_actions[page][bank] = cleanup;
	}

	deleteInstance(id) {

		for (var n in this.actions) {
			var x = n.split(/:/);
			if (x[0] == id) {
				delete this.actions[n];
			}
		}

		this.updateActions();

		for (var page in this.bank_actions) {
			for (var bank in this.bank_actions[page]) {
				if (this.bank_actions[page][bank] !== undefined) {
					for (var i = 0; i < this.bank_actions[page][bank].length ; ++i) {
						var action = this.bank_actions[page][bank][i];

						if (action.instance == id) {
							debug('Deleting action ' + i + ' from button ' + page + '.' + bank);
							this.unsubscribeAction(this.bank_actions[page][bank][i])
							this.bank_actions[page][bank].splice(i, 1);
							this.checkBank(page, bank);
							i--;
						}
					}
				}
			}
		}

		for (var page in this.bank_release_actions) {
			for (var bank in this.bank_release_actions[page]) {
				if (this.bank_release_actions[page][bank] !== undefined) {
					for (var i = 0; i < this.bank_release_actions[page][bank].length ; ++i) {
						var action = this.bank_release_actions[page][bank][i];
						if (action.instance == id) {
							debug('Deleting release action ' + i + ' from button ' + page + '.' + bank);
							this.unsubscribeAction(this.bank_release_actions[page][bank][i])
							this.bank_release_actions[page][bank].splice(i, 1);
							this.checkBank(page, bank);
							i--;
						}
					}
				}
			}
		}
	}

	getBankActions(cb) {
		if (cb !== undefined && typeof cb == 'function') {
			cb(this.bank_actions);
		}
	}

	getBankReleaseActions(cb) {
		if (cb !== undefined && typeof cb == 'function') {
			cb(this.bank_release_actions);
		}
	}

	getBankStatus(page, bank, cb) {
		if (cb !== undefined && typeof cb == 'function') {
			cb(this.bank_status[page + '_' + bank]);
		}
	}

	getInstanceActions(instance_id, cb) {

		if (cb !== undefined && typeof cb == 'function') {
			var actions = [];

			for (var page in this.bank_actions) {
				for (var bank in this.bank_actions[page]) {
					for (var i in this.bank_actions[page][bank]) {
						var action = this.bank_actions[page][bank][i];
						if (action.instance == instance_id) {
							actions.push(action);
						}
					}
				}
			}

			cb(actions);
		}
	}

	getInstanceReleaseActions(instance_id, cb) {

		if (cb !== undefined && typeof cb == 'function') {
			var actions = [];

			for (var page in this.bank_release_actions) {
				for (var bank in this.bank_release_actions[page]) {
					for (var i in this.bank_release_actions[page][bank]) {
						var action = this.bank_release_actions[page][bank][i];
						if (action.instance == instance_id) {
							actions.push(action);
						}
					}
				}
			}

			cb(actions);
		}
	}

	getRunningActions(page, bank, cb) {
		if (cb !== undefined && typeof cb == 'function') {
			cb(this.actions_running.has(`${page}_${bank}`));
		}
	}

	resetBank(page, bank) {
		this.unsubscribeBank(page, bank);

		if (this.bank_actions[page] === undefined) {
			this.bank_actions[page] = {};
		}
		this.bank_actions[page][bank] = [];

		if (this.bank_release_actions[page] === undefined) {
			this.bank_release_actions[page] = {};
		}
		this.bank_release_actions[page][bank] = [];

		debug("bank_reset()", page, bank, this.bank_actions[page][bank]);

		this.saveActions();
	}

	runAction(action, extras) {

		if (this.instance !== undefined && this.instance.store !== undefined && this.instance.store.db !== undefined) {
			this.system.emit('instance_get', action.instance, (instance) => {
				if (this.instance.store.db[action.instance] !== undefined && this.instance.store.db[action.instance].enabled !== false) {
					const definition = this.actions[`${action.instance}:${action.action}`]

					try {
						// Ask instance to execute action
						if (definition !== undefined && definition.callback !== undefined && typeof definition.callback == 'function') {
							definition.callback(action, extras);
						} else if (instance !== undefined && typeof instance.action == 'function') {
							/*
							  https://github.com/bitfocus/companion/issues/1117
							  https://sentry.bitfocus.io/organizations/bitfocus/issues/11/?project=8

							  the line above was "fixed" by the 'instance !== undefined' to 
							  avoid surprise features/bugs.. 
							  I don't have a clue what's going on here.. Help wanted. -WV
							  Sentry tells us that 33 users got this 236 times over 11 days
							*/
							instance.action(action, extras);
						} else {
							debug('ERROR: instance does not have an action() function:', instance);
						}
					}
					catch(e) {
						this.system.emit('log', 'instance('+instance.label+')', 'warn', 'Error executing action: ' + e.message);
					}
				}
				else {
					debug("trying to run action on a deleted instance.", action)
				}
			})
		}
	}

	saveActions() {
		this.system.emit('db_set', 'bank_actions', this.bank_actions);
		this.system.emit('db_set', 'bank_release_actions', this.bank_release_actions);
		this.system.emit('db_save');
		debug('saving');
	}

	saveInstance() {
		setImmediate(() => {
			this.io.emit('actions', this.actions);
		});
	}

	saveReleaseActions() {
		this.system.emit('db_set', 'bank_release_actions', this.bank_release_actions);
		this.system.emit('db_save');
		debug('saving');
	}

	setInstance(obj) {
		debug('got instance');
		this.instance = obj;

		// ensure all actions are valid
		this.bank_actions = this.cleanupActionsList(this.bank_actions)
		this.bank_release_actions = this.cleanupActionsList(this.bank_release_actions)

		this.system.emit('db_set', 'bank_actions', this.bank_actions);
		this.system.emit('db_set', 'bank_release_actions', this.bank_release_actions);
		this.system.emit('db_save');
	}

	setInstanceActions(id, actions) {
		let newActions = {};
		// actions[instance_id:action]
		for (var m in this.actions) {
			var idActionSplit = m.split(':');
			// only add other id actions.
			if (idActionSplit[0] != id) {
				newActions[m] = this.actions[m];
			}
		}
		// overwrite old action array with cleared one
		this.actions = newActions;

		for (var n in actions) {
			var a = actions[n];
			this.actions[id+':'+n] = a;
			debug('adding action', id+':'+n);
		}
		this.io.emit('actions', this.actions);
	}

	setInstanceStatus(instance, level, msg) {

		for (var page in this.bank_actions) {
			if (this.bank_actions[page] !== undefined) {
				for (var bank in this.bank_actions[page]) {
					if (this.bank_actions[page][bank] !== undefined) {
						for (var i = 0; i < this.bank_actions[page][bank].length; ++i) {
							var action = this.bank_actions[page][bank][i];
							if (action.instance == instance) {
								this.checkBank(page, bank);
							}
						}
					}
				}
			}
		}

		for (var page in this.bank_release_actions) {
			for (var bank in this.bank_release_actions[page]) {
				if (this.bank_release_actions[page] !== undefined && this.bank_release_actions[page][bank] !== undefined) {
					for (var i = 0; i < this.bank_release_actions[page][bank].length; ++i) {
						var action = this.bank_release_actions[page][bank][i];
						if (action.instance == instance) {
							this.checkBank(page, bank);
						}
					}
				}
			}
		}
	}

	subscribeAction(action) {
		console.log(action)

		if (action !== undefined && action.action !== undefined && action.instance !== undefined) {
			const actionId = `${action.instance}:${action.action}`
			if (this.actions[actionId] !== undefined) {
				let definition = this.actions[actionId];
				// Run the subscribe function if needed
				if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
					definition.subscribe(action);
				}
			}
		}
	}

	subscribeBank(page, bank) {

		if (this.bank_actions[page] !== undefined && this.bank_actions[page][bank] !== undefined) {
			// find all instance-ids in actions for bank
			for (var i in this.bank_actions[page][bank]) {
				this.subscribeAction(this.bank_actions[page][bank][i]);
			}
		}
		if (this.bank_release_actions[page] !== undefined && this.bank_release_actions[page][bank] !== undefined) {
			// find all instance-ids in release_actions for bank
			for (var i in this.bank_release_actions[page][bank]) {
				this.subscribeAction(this.bank_release_actions[page][bank][i]);
			}
		}
	}

	unsubscribeAction(action) {

		if (action !== undefined && action.action !== undefined && action.instance !== undefined) {
			const actionId = `${action.instance}:${action.action}`
			if (this.actions[actionId] !== undefined) {
				let definition = this.actions[actionId];
				// Run the unsubscribe function if needed
				if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
					definition.unsubscribe(action);
				}
			}
		}
	}

	unsubscribeBank(page, bank) {

		if (this.bank_actions[page] !== undefined && this.bank_actions[page][bank] !== undefined) {
			// find all instance-ids in actions for bank
			for (var i in this.bank_actions[page][bank]) {
				this.unsubscribeAction(this.bank_actions[page][bank][i]);
			}
		}
		if (this.bank_release_actions[page] !== undefined && this.bank_release_actions[page][bank] !== undefined) {
			// find all instance-ids in release_actions for bank
			for (var i in this.bank_release_actions[page][bank]) {
				this.unsubscribeAction(this.bank_release_actions[page][bank][i]);
			}
		}
	}

	updateActions() {
		debug('actions_update:', this.actions);
		this.io.emit('actions', this.actions);
	}

	updateBankActionDelay(page,bank,action,value) {
		var bp = this.bank_actions[page][bank];

		if (bp !== undefined) {
			for (var n in bp) {
				var obj = bp[n];
				if (obj !== undefined && obj.id === action) {
					this.bank_actions[page][bank][n].delay = value;
					this.saveActions();
				}
			}
		}
	}

	updateBankActionOption(page,bank,action,option,value) {
		debug('bank_update_action_option', page,bank,action,option,value);
		var bp = this.bank_actions[page][bank];

		if (bp !== undefined) {
			for (var n in bp) {
				var obj = bp[n];
				if (obj !== undefined && obj.id === action) {
					this.unsubscribeAction(obj);
					if (obj.options === undefined) {
						obj.options = {};
					}
					obj.options[option] = value;
					this.subscribeAction(obj);
					this.saveActions();
				}
			}
		}
	}

	updateBankActionOrder(page, bank, old_index, new_index) {
		var bp = this.bank_actions[page][bank];

		if (bp !== undefined) {
			bp.splice(new_index, 0, bp.splice(old_index, 1)[0]);
			this.saveActions();
		}
	}

	updateBankReleaseActionDelay(page,bank,action,value) {
		var bp = this.bank_release_actions[page][bank];

		if (bp !== undefined) {
			for (var n in bp) {
				var obj = bp[n];
				if (obj !== undefined && obj.id === action) {
					this.bank_release_actions[page][bank][n].delay = value;
					this.saveReleaseActions();
				}
			}
		}
	}

	updateBankReleaseActionOption(page,bank,action,option,value) {
		debug('bank_release_action_update_option', page,bank,action,option,value);
		var bp = this.bank_release_actions[page][bank];

		if (bp !== undefined) {
			for (var n in bp) {
				var obj = bp[n];
				if (obj !== undefined && obj.id === action) {
					this.unsubscribeAction(obj);
					if (obj.options === undefined) {
						obj.options = {};
					}
					obj.options[option] = value;
					this.subscribeAction(obj);
					this.saveReleaseActions();
				}
			}
		}
	}

	updateBankReleaseActionOrder(page, bank, old_index, new_index) {
		var bp = this.bank_release_actions[page][bank];

		if (bp !== undefined) {
			bp.splice(new_index, 0, bp.splice(old_index, 1)[0]);
			this.saveReleaseActions();
		}
	}

	upgrade15to32() {
		// Convert config from 15 to 32 keys format
		for (var page in this.config) {
			for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				if (this.bank_actions[page][bank] === undefined) {
					this.bank_actions[page][bank] = [];
				}
				if (this.bank_release_actions[page][bank] === undefined) {
					this.bank_release_actions[page][bank] = [];
				}
			}
		}
	}
}

exports = module.exports = function (system) {
	return new action(system);
};
