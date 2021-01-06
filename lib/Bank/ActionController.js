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

const debug           = require('debug')('lib/Bank/ActionController');
const CoreBase        = require('../Core/Base');
const BankActionItems = require('./ActionItems');

/**
 * Class used by the {@link BankController} to manage and allow execution of actions
 * 
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 1.0.4
 */
class BankActionController extends CoreBase {

	/** @type {string[]} */
	static pageStyles = ['pageup','pagenum','pagedown'];
	/** @type {BankActionItems} */
	actions;
	/** @type {Set} */
	actionsRunning;
	/** @type {Object.<string, number>} */
	bankStatus;
	/** @type {BankActionDefinition[]} */
	definitions;
	/** @type {Object.<string, string>} */
	skipNext;
	/** @type {BankActionItems} */
	releaseActions;
	/** @type {Map} */
	timersRunning

	constructor(registry) {
		super(registry, 'action');

		this.actions        = new BankActionItems(registry, this, 'action',         'bank_actions');
		this.releaseActions = new BankActionItems(registry, this, 'release_action', 'bank_release_actions');

		this.definitions    = {};
		this.bankStatus     = {};
		this.actionsRunning = [];
		this.timersRunning  = [];
		// skipNext needed for 'bank_pressed' callback
		this.skipNext       = {};

		// Permanent //
		this.system.on('action_delayed_abort', this.abortDelayedActions.bind(this));
		this.system.on('action_run', this.runAction.bind(this));
		this.system.on('bank_pressed', this.bankPressed.bind(this));
		this.system.on('instance_actions', this.setInstanceDefinitions.bind(this));

		this.system.on('actions_for_instance', (id, cb) => {
			if (cb !== undefined && typeof cb == 'function') {
				cb(this.getInstanceActions(id));
			}
		});
		this.system.on('release_actions_for_instance', (id, cb) => {
			if (cb !== undefined && typeof cb == 'function') {
				cb(this.getInstanceReleaseActions(id));
			}
		});

		// Temporary //
		this.system.on('instance_delete', this.deleteInstance.bind(this));
		this.system.on('instance_status_set', this.checkInstanceStatus.bind(this));
	}

	abortDelayedActions() {

		debug("Aborting delayed actions");

		while(this.timersRunning.length > 0) {
			debug("clearing timer");
			clearTimeout( this.timersRunning.shift() );
		}

		let actionsRunning = this.actionsRunning.slice(0); //clone hack
		this.actionsRunning = []; // clear the array

		for (let bid in actionsRunning) {
			let a = actionsRunning[bid].split("_");
			this.graphics().invalidateBank(a[0], a[1]);
		}
	}

	bankPressed(page, bank, direction, deviceid) {
		let bankConfig = this.bank().getBank(page, bank);

		if (bankConfig.latch) {
			let pb = page + "_" + bank;

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
		if (BankActionController.pageStyles.includes(bankConfig.style)) {
			if (direction === true) {
				if (bankConfig.style == 'pageup') {
					this.system.emit('device_page_up', deviceid);
				}
				else if (bankConfig.style == 'pagenum') {
					this.system.emit('device_page_set', deviceid, 1);
				}
				else if (bankConfig.style == 'pagedown') {
					this.system.emit('device_page_down', deviceid);
				}
			}
			// no actions allowed on page buttons so we're done
			return;
		}

		this.system.emit('graphics_indicate_push', page, bank, direction, deviceid);


		let obj;

		// find release actions if the direction is up
		if (direction === false) {
			obj = this.releaseActions.getBank(page, bank);
		}
		else {
			obj = this.actions.getBank(page, bank)
		}

		if (obj === undefined || obj.length === 0) {
			return;
		}

		debug('found actions');

		// Handle whether the delays are absolute or relative.
		let actionDelay = 0;
		for (let n in obj) {
			let a = obj[n];
			let thisDelay = parseInt(a.delay === undefined || a.delay === '' ? 0 : a.delay);

			if (bankConfig.relative_delay) {
				// Relative delay: each action's delay adds to the next.
				actionDelay += thisDelay;
			} else {
				// Absolute delay: each delay is its own.
				actionDelay = thisDelay;
			}

			// Create the property .effectiveDelay. Don't change the user's .delay property.
			a.effectiveDelay = actionDelay;
		}

		let maxtime = 0;
		let maxidx = -1;

		for (let n in obj) {
			let a = obj[n];
			if (a.effectiveDelay !== undefined && parseInt(a.effectiveDelay) > maxtime) {
				maxtime = parseInt(a.effectiveDelay);
				maxidx = n;
			}
		}

		// Start timer-indication
		if (maxtime > 0) {
			this.actionsRunning.push(page + '_' + bank);
		}

		let hasDelayed = false;
		for (let n in obj) {
			let a = obj[n];
			let delay = parseInt(a.effectiveDelay === undefined ? 0 : a.effectiveDelay);
			delete a.effectiveDelay;

			debug("Running action", a);

			if (this.instance().isInstanceEnabled(a.instance)) {

				// is this a timedelayed action?
				if (delay > 0) {

					hasDelayed = true;

					(function(action, delayTime, n) {
						let timer = setTimeout(function() {
							this.runAction(action, { deviceid: deviceid, page: page, bank: bank });

							// Stop timer-indication
							if (maxtime > 0 && maxidx == n) {
								let idx;
								if ((idx = this.actionsRunning.indexOf(page + '_' + bank)) !== -1) {
									this.actionsRunning.splice(idx, 1);
									this.graphics().invalidateBank(page, bank);
								}
							}

							// Remove mythis from running timers
							let idx = this.timersRunning.indexOf(timer);
							if (idx !== -1) {
								this.timersRunning.splice(idx, 1);
							}

						}, delayTime);

						this.timersRunning.push(timer);

					})(a, delay, n);
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

		if (hasDelayed) {
			this.graphics().invalidateBank(page, bank);
		}
	}

	checkBanks(pageBankArray) {

		if (pageBankArray.length > 0) {
			for(let s in pageBankArray) {
				let bp = s.split('_');
				this.checkBankStatus(bp[0], bp[1]);
			}
		}
	}

	checkBankStatus(page, bank, invalidate = true) {
		let status = 0;

		status = this.actions.checkBankStatus(page, bank, status);
		status = this.releaseActions.checkBankStatus(page, bank, status);

		if (status != this.bankStatus[page + '_' + bank]) {
			this.bankStatus[page + '_' + bank] = status;

			if (invalidate === true) {
				this.graphics().invalidateBank(page, bank);
			}
		}
	}

	checkInstanceStatus(instance, level, msg) {
		let checkQueue = [];
		checkQueue = this.actions.checkInstanceStatus(instance, checkQueue);
		checkQueue = this.releaseActions.checkInstanceStatus(instance, checkQueue);

		this.checkBanks(checkQueue);
	}

	clientConnect(client) {
		client.on('get_actions', () => {
			client.emit('actions', this.getUiDefinitions());
		});

		client.on('bank_update_action_delay',        this.actions.updateItemDelay.bind(this.actions));
		client.on('bank_update_action_option',       this.actions.updateItemOption.bind(this.actions));
		client.on('bank_update_action_option_order', this.actions.updateItemOrder.bind(this.actions));

		client.on('bank_action_add',    this.actions.addItemByClient.bind(    this.actions, client, 'bank_actions_get:result'));
		client.on('bank_action_delete', this.actions.deleteItemByClient.bind( this.actions, client, 'bank_actions_get:result'));
		client.on('bank_actions_get',   this.actions.getBankByClient.bind(    this.actions, client, 'bank_actions_get:result'));

		client.on('bank_update_release_action_delay',        this.releaseActions.updateItemDelay.bind(this.releaseActions));
		client.on('bank_release_action_update_option',       this.releaseActions.updateItemOption.bind(this.releaseActions));
		client.on('bank_release_action_update_option_order', this.releaseActions.updateItemOrder.bind(this.releaseActions));

		client.on('bank_addReleaseAction',      this.releaseActions.addItemByClient.bind(    this.releaseActions, client, 'bank_release_actions_get:result'));
		client.on('bank_release_action_delete', this.releaseActions.deleteItemByClient.bind( this.releaseActions, client, 'bank_release_actions_get:result'));
		client.on('bank_release_actions_get',   this.releaseActions.getBankByClient.bind(    this.releaseActions, client, 'bank_release_actions_get:result'));
	}

	deleteInstance(id) {

		delete this.definitions[id];

		this.updateDefinitions();

		let checkQueue = [];
		checkQueue = this.actions.deleteInstance(id, checkQueue);
		checkQueue = this.releaseActions.deleteInstance(id, checkQueue);

		this.checkBanks(checkQueue);
	}

	getActions(clone = false) {
		this.actions.getAll(clone);
	}

	getBankActions(page, bank, clone = false) {
		return this.actions.getBank(page, bank, clone);
	}

	getBankStatus(page, bank) {
		this.bankStatus[page + '_' + bank];
	}

	getBankReleaseActions(page, bank, clone = false) {
		return this.releaseActions.getBank(page, bank, clone);
	}

	getInstanceActions(instanceId) {
		this.actions.getInstanceItems(instanceId);
	}

	getInstanceReleaseActions(instanceId) {
		this.releaseActions.getInstanceItems(instanceId);
	}

	getReleaseActions(clone = false) {
		this.releaseActions.getAll(clone);
	}

	getRunningActions(page, bank) {
		return (this.actionsRunning.indexOf(page + '_' + bank) !== -1);
	}

	getUiDefinitions() { //for UI backwards compatibility
		let out = [];

		for (let n in this.definitions) {
			let a = this.definitions[n];
			out[id+':'+n] = a;
		}

		return out;
	}

	importBank(page, bank, actions, releaseActions) {
		this.actions.importBank(page, bank, actions);
		this.releaseActions.importBank(page, bank, releaseActions);
		this.checkBankStatus(page, bank, false);
	}

	resetBank(page, bank) {
		this.actions.resetBank(page, bank);
		this.releaseActions.resetBank(page, bank);
	}

	runAction(action, extras) {

		if (action !== undefiend && action.instance !== undefined && this.definitions[action.instance]) {
			let instance = this.instance().getInstance(action.instance);

			if (instance !== undefined) {
				const definition = this.definitions[action.instance][action.type];
				action.action = action.type; // backwards compatibility

				try {
					// Ask instance to execute action
					if (definition !== undefined && definition.callback !== undefined && typeof definition.callback == 'function') {
						definition.callback(action, extras);
					} else if (typeof instance.action == 'function') {
						instance.action(action, extras);
					} else {
						debug('ERROR: instance does not have an action() function:', instance);
					}
				}
				catch(e) {
					this.registry.log.add('instance('+instance.label+')', 'warn', 'Error executing action: ' + e.message);
				}
			}
		}
	}

	saveActions() {
		this.actions.save();
	}

	saveReleaseActions() {
		this.releaseActions.save();
	}

	setInstanceDefinitions(id, actions) {
		this.definitions[id] = actions;
		this.updateDefinitions();
	}

	subscribeBank(page, bank) {
		this.actions.subscribeBank(page, bank);
		this.releaseActions.subscribeBank(page, bank);
	}

	unsubscribeBank(page, bank) {
		this.actions.unsubscribeBank(page, bank);
		this.releaseActions.unsubscribeBank(page, bank);
	}

	updateDefinitions() {
		this.actions.setDefinitions(this.definitions);
		this.releaseActions.setDefinitions(this.definitions);
		debug('actions_update:', this.definitions);
		this.io().emit('actions', this.getUiDefinitions());
	}
}

exports = module.exports = BankActionController;