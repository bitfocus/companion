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

var system;
var debug   = require('debug')('lib/action');
var shortid = require('shortid');

function action(system) {
	var self = this;

	self.system = system;
	self.actions = {};
	self.bank_actions = {};
	self.bank_release_actions = {};
	self.bank_status = {};
	self.instance = {};
	self.actions_running = [];
	self.timers_running = [];

	self.system.emit('db_get', 'bank_actions', function(res) {
		if (res !== undefined) {
			self.bank_actions = res;
		}
	});

	self.system.emit('db_get', 'bank_release_actions', function(res) {
		if (res !== undefined) {
			self.bank_release_actions = res;
		}
	});

	self.system.on('15to32', function () {
		// Convert config from 15 to 32 keys format
		for (var page in self.config) {
			for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				if (self.bank_actions[page][bank] === undefined) {
					self.bank_actions[page][bank] = [];
				}
				if (self.bank_release_actions[page][bank] === undefined) {
					self.bank_release_actions[page][bank] = [];
				}
			}
		}
	});

	self.system.on('instance', function(obj) {
		debug('got instance');
		self.instance = obj;
	});

	self.system.on('action_save', function() {
		self.system.emit('db_set', 'bank_actions', self.bank_actions);
		self.system.emit('db_set', 'bank_release_actions', self.bank_release_actions);
		self.system.emit('db_save');
		debug('saving');
	});

	self.system.on('release_action_save', function() {
		self.system.emit('db_set', 'bank_release_actions', self.bank_release_actions);
		self.system.emit('db_save');
		debug('saving');
	});


	self.system.on('instance_save', function() {
		setImmediate(function() {
			self.io.emit('actions', self.actions);
			self.io.emit('release_actions', self.release_actions);
		});
	});

	self.system.on('instance_delete', function (id) {
		for (var page in self.bank_actions) {
			for (var bank in self.bank_actions[page]) {
				if (self.bank_actions[page][bank] !== undefined) {
					for (var i = 0; i < self.bank_actions[page][bank].length ; ++i) {
						var action = self.bank_actions[page][bank][i];

						if (action.instance == id) {
							debug('Deleting action ' + i + ' from button ' + page + '.' + bank);
							self.bank_actions[page][bank].splice(i, 1);
							self.system.emit('instance_status_check_bank', page, bank);
							i--;
						}
					}
				}
			}
		}

		for (var page in self.bank_release_actions) {
			for (var bank in self.bank_release_actions[page]) {
				if (self.bank_release_actions[page][bank] !== undefined) {
					for (var i = 0; i < self.bank_release_actions[page][bank].length ; ++i) {
						var action = self.bank_release_actions[page][bank][i];
						if (action.instance == id) {
							debug('Deleting release action ' + i + ' from button ' + page + '.' + bank);
							self.bank_release_actions[page][bank].splice(i, 1);
							self.system.emit('instance_status_check_bank', page, bank);
							i--;
						}
					}
				}
			}
		}

	});

	self.system.on('action_get_banks', function (cb) {
		cb(self.bank_actions);
	});

	self.system.on('release_action_get_banks', function (cb) {
		cb(self.bank_release_actions);
	});

	self.system.on('actions_for_instance', function (instance_id, cb) {
		var actions = [];
		for (var page in self.bank_actions) {
			for (var bank in self.bank_actions[page]) {
				for (var i in self.bank_actions[page][bank]) {
					var action = self.bank_actions[page][bank][i];
					if (action.instance == instance_id) {
						actions.push(action);
					}
				}
			}
		}
		cb(actions);
	});

	self.system.on('release_actions_for_instance', function (instance_id, cb) {
		var actions = [];
		for (var page in self.bank_release_actions) {
			for (var bank in self.bank_release_actions[page]) {
				for (var i in self.bank_release_actions[page][bank]) {
					var action = self.bank_release_actions[page][bank][i];
					if (action.instance == instance_id) {
						actions.push(action);
					}
				}
			}
		}
		cb(actions);

	});

	function checkBank(page, bank) {
		var status = 0;

		if (self.bank_actions[page] === undefined || self.bank_actions[page][bank] === undefined) {
			return;
		}
		for (var i = 0; i < self.bank_actions[page][bank].length ; ++i) {
			var action = self.bank_actions[page][bank][i];
			system.emit('instance_status_get', action.instance, function (instance_status) {
				if (instance_status !== undefined && status < instance_status[0]) {
					status = instance_status[0];
				}
			});
		}

		if (status != self.bank_status[page + '_' + bank]) {
			self.bank_status[page + '_' + bank] = status;
			self.system.emit('action_bank_status_set', page, bank, status);
		}

	}

	self.system.on('action_bank_status_get', function (page, bank, cb) {
		cb(self.bank_status[page + '_' + bank]);
	});

	self.system.on('instance_status_check_bank', function (page, bank) {
		checkBank(page, bank);
	});

	self.system.on('instance_status_set', function(instance, level, msg) {

		for (var page in self.bank_actions) {
			if (self.bank_actions[page] !== undefined) {
				for (var bank in self.bank_actions[page]) {
					if (self.bank_actions[page][bank] !== undefined) {
						for (var i = 0; i < self.bank_actions[page][bank].length; ++i) {
							var action = self.bank_actions[page][bank][i];
							if (action.instance == instance) {
								checkBank(page, bank);
							}
						}
					}
				}
			}
		}

		for (var page in self.bank_release_actions) {
			for (var bank in self.bank_release_actions[page]) {
				if (self.bank_release_actions[page] !== undefined && self.bank_release_actions[page][bank] !== undefined) {
					for (var i = 0; i < self.bank_release_actions[page][bank].length; ++i) {
						var action = self.bank_release_actions[page][bank][i];
						if (action.instance == instance) {
							checkBank(page, bank);
						}
					}
				}
			}
		}

	});

	self.system.on('action_running_get', function (page, bank, cb) {
		cb(self.actions_running.indexOf(page + '_' + bank) !== -1);
	});

	// If a user wants to panic-abort all timers running
	self.system.on('action_delayed_abort', function() {

		debug("Aborting delayed actions");

		while(self.timers_running.length > 0) {
			debug("clearing timer");
			clearTimeout( self.timers_running.shift() );
		}

		var actions_running = self.actions_running.slice(0); //clone hack
		self.actions_running = []; // clear the array

		for (var bid in actions_running) {
			var a = actions_running[bid].split("_");
			self.system.emit('graphics_bank_invalidate', a[0], a[1]);
		}

	});

	self.system.on('bank_pressed', function(page, bank, direction, deviceid) {
		var bank_config;

		system.emit('get_bank', page, bank, function(config) {
			bank_config = config;
		});

		if (bank_config.latch) {
			if (direction == false) {
				return;
			}

			system.emit('graphics_is_pushed', page, bank, function (pushed) {
				direction = !pushed;
			});
		}

		system.emit('graphics_indicate_push', page, bank, direction, deviceid);

		if (bank_config.style == 'pageup' && direction) {
			self.system.emit('device_page_up', deviceid);
			return;
		}
		else if (bank_config.style == 'pagenum' && direction) {
			self.system.emit('device_page_set', deviceid, 1);
			return;
		}
		else if (bank_config.style == 'pagedown' && direction) {
			self.system.emit('device_page_down', deviceid);
			return;
		}


		var obj = self.bank_actions;

		// find release actions if the direction is up
		if (direction === false) {
			obj = self.bank_release_actions;
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

		var maxtime = 0;
		var maxidx = -1;

		for (var n in obj[page][bank]) {
			var a = obj[page][bank][n];
			if (a.effective_delay !== undefined && parseInt(a.effective_delay) > maxtime) {
				maxtime = parseInt(a.effective_delay);
				maxidx = n;
			}
		}

		// Start timer-indication
		if (maxtime > 0) {
			self.actions_running.push(page + '_' + bank);
		}

		var has_delayed = false;
		for (var n in obj[page][bank]) {
			var a = obj[page][bank][n];
			var delay = parseInt(a.effective_delay === undefined ? 0 : a.effective_delay);
			delete a.effective_delay;

			debug("Running action", a);

			if (self.instance !== undefined && self.instance.store !== undefined && self.instance.store.db !== undefined) {
				if (self.instance.store.db[a.instance] !== undefined && self.instance.store.db[a.instance].enabled !== false) {

					// is this a timedelayed action?
					if (delay > 0) {

						has_delayed = true;

						(function(action, delay_time, n) {
							var timer = setTimeout(function() {
								self.system.emit('action_run', action, { deviceid: deviceid, page: page, bank: bank });

								// Stop timer-indication
								if (maxtime > 0 && maxidx == n) {
									var idx;
									if ((idx = self.actions_running.indexOf(page + '_' + bank)) !== -1) {
										self.actions_running.splice(idx, 1);
										self.system.emit('graphics_bank_invalidate', page, bank);
									}
								}

								// Remove myself from running timers
								var idx = self.timers_running.indexOf(timer);
								if (idx !== -1) {
									self.timers_running.splice(idx, 1);
								}

							}, delay_time);

							self.timers_running.push(timer);

						})(a, delay, n);
					}

					// or is it immediate
					else {
						self.system.emit('action_run', a, { deviceid: deviceid, page: page, bank: bank });
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
			self.system.emit('graphics_bank_invalidate', page, bank);
		}
	});

	self.system.emit('io_get', function(io) {
		self.io = io;
		self.system.on('io_connect', function(client) {

			client.on('get_actions', function() {
				client.emit('actions', self.actions);
			});

			client.on('release_actions_get', function() {
				client.emit('release_actions', self.release_actions);
			});

			client.on('bank_update_action_delay', function(page,bank,action,value) {
				var bp = self.bank_actions[page][bank];
				if (bp !== undefined) {
					for (var n in bp) {
						var obj = bp[n];
						if (obj !== undefined && obj.id === action) {
							self.bank_actions[page][bank][n].delay = value;
							self.system.emit('action_save');
						}
					}
				}
			});

			client.on('bank_update_release_action_delay', function(page,bank,action,value) {
				var bp = self.bank_release_actions[page][bank];
				if (bp !== undefined) {
					for (var n in bp) {
						var obj = bp[n];
						if (obj !== undefined && obj.id === action) {
							self.bank_release_actions[page][bank][n].delay = value;
							self.system.emit('release_action_save');
						}
					}
				}
			});

			client.on('bank_update_action_option', function(page,bank,action,option,value) {
				debug('bank_update_action_option', page,bank,action,option,value);
				var bp = self.bank_actions[page][bank];
				if (bp !== undefined) {
					for (var n in bp) {
						var obj = bp[n];
						if (obj !== undefined && obj.id === action) {
							if (obj.options === undefined) {
								self.bank_actions[page][bank][n].options = {};
							}
							self.bank_actions[page][bank][n].options[option] = value;
							self.system.emit('action_save');
						}
					}
				}
			});

			client.on('bank_release_action_update_option', function(page,bank,action,option,value) {
				debug('bank_release_action_update_option', page,bank,action,option,value);
				var bp = self.bank_release_actions[page][bank];
				if (bp !== undefined) {
					for (var n in bp) {
						var obj = bp[n];
						if (obj !== undefined && obj.id === action) {
							if (obj.options === undefined) {
								self.bank_release_actions[page][bank][n].options = {};
							}
							self.bank_release_actions[page][bank][n].options[option] = value;
							self.system.emit('release_action_save');
						}
					}
				}
			});

			client.on('bank_action_add', function(page,bank,action) {
				if (self.bank_actions[page] === undefined) self.bank_actions[page] = {};
				if (self.bank_actions[page][bank] === undefined) self.bank_actions[page][bank] = [];
				var s = action.split(/:/);

				self.bank_actions[page][bank].push({
					'id': shortid.generate(),
					'label': action,
					'instance': s[0],
					'action': s[1]
				});


				system.emit('action_save');
				client.emit('bank_actions_get:result', page, bank, self.bank_actions[page][bank] );
				system.emit('instance_status_check_bank', page, bank);
			});

			client.on('bank_addReleaseAction', function(page,bank,action) {
				if (self.bank_release_actions[page] === undefined) self.bank_release_actions[page] = {};
				if (self.bank_release_actions[page][bank] === undefined) self.bank_release_actions[page][bank] = [];
				var s = action.split(/:/);

				self.bank_release_actions[page][bank].push({
					'id': shortid.generate(),
					'label': action,
					'instance': s[0],
					'action': s[1]
				});


				system.emit('release_action_save');
				client.emit('bank_release_actions_get:result', page, bank, self.bank_release_actions[page][bank] );
				system.emit('instance_status_check_bank', page, bank);
			});

			client.on('bank_action_delete', function(page, bank, id) {
				var ba = self.bank_actions[page][bank];

				for (var n in ba) {
					if (ba[n].id == id) {
						delete self.bank_actions[page][bank][n];
						break;
					}
				}

				var cleanup = [];

				for (var n in ba) {
					if (ba[n] !== null) {
						cleanup.push(ba[n]);
					}
				}

				self.bank_actions[page][bank] = cleanup;

				system.emit('action_save');
				client.emit('bank_actions_get:result', page, bank, self.bank_actions[page][bank] );
				system.emit('instance_status_check_bank', page, bank);
			});

			client.on('bank_release_action_delete', function(page, bank, id) {
				var ba = self.bank_release_actions[page][bank];

				for (var n in ba) {
					if (ba[n].id == id) {
						delete self.bank_release_actions[page][bank][n];
						break;
					}
				}

				var cleanup = [];

				for (var n in ba) {
					if (ba[n] !== null) {
						cleanup.push(ba[n]);
					}
				}

				self.bank_release_actions[page][bank] = cleanup;

				system.emit('release_action_save');
				client.emit('bank_release_actions_get:result', page, bank, self.bank_release_actions[page][bank] );
				system.emit('instance_status_check_bank', page, bank);
			});


			client.on('bank_actions_get', function(page, bank) {
				if (self.bank_actions[page] === undefined) self.bank_actions[page] = {};
				if (self.bank_actions[page][bank] === undefined) self.bank_actions[page][bank] = [];
				client.emit('bank_actions_get:result', page, bank, self.bank_actions[page][bank] );
			});

			client.on('bank_release_actions_get', function(page, bank) {
				if (self.bank_release_actions[page] === undefined) self.bank_release_actions[page] = {};
				if (self.bank_release_actions[page][bank] === undefined) self.bank_release_actions[page][bank] = [];
				client.emit('bank_release_actions_get:result', page, bank, self.bank_release_actions[page][bank] );
			});

			client.on('bank_update_action_option_order', function(page, bank, old_index, new_index) {
				var bp = self.bank_actions[page][bank];
				if (bp !== undefined) {
					bp.splice(new_index, 0, bp.splice(old_index, 1)[0]);
					self.system.emit('action_save');
				}
			});

			client.on('bank_release_action_update_option_order', function(page, bank, old_index, new_index) {
				var bp = self.bank_release_actions[page][bank];
				if (bp !== undefined) {
					bp.splice(new_index, 0, bp.splice(old_index, 1)[0]);
					self.system.emit('release_action_save');
				}
			});

		});
	});

	self.system.on('instance_delete', function(id) {
		for (var n in self.actions) {
			var x = n.split(/:/);
			if (x[0] == id) {
				delete self.actions[n];
			}
		}
		self.system.emit('actions_update');
		for (var n in self.release_actions) {
			var x = n.split(/:/);
			if (x[0] == id) {
				delete self.release_actions[n];
			}
		}
		self.system.emit('release_actions_update');
	});

	self.system.on('bank_reset', function (page, bank) {

		if (self.bank_actions[page] === undefined) {
			self.bank_actions[page] = {};
		}
		self.bank_actions[page][bank] = [];

		if (self.bank_release_actions[page] === undefined) {
			self.bank_release_actions[page] = {};
		}
		self.bank_release_actions[page][bank] = [];

		debug("bank_reset()", page, bank, self.bank_actions[page][bank]);

		self.system.emit('action_save');

	});

	self.system.on('actions_update', function() {
		debug('actions_update:', self.actions);
		self.io.emit('actions', self.actions);
	});

	self.system.on('release_actions_update', function() {
		debug('release_actions_update:', self.release_actions);
		self.io.emit('release_actions', self.release_actions);
	});

	self.system.on('instance_actions', function(id, actions) {
		for (var n in actions) {
			var a = actions[n];
			self.actions[id+':'+n] = a;
			debug('adding action', id+':'+n);
		}
		self.io.emit('actions', self.actions);
	});

	self.system.on('instance_release_actions', function(id, actions) {
		for (var n in actions) {
			var a = actions[n];
			self.release_actions[id+':'+n] = a;
			debug('adding release_action', id+':'+n);
		}
		self.io.emit('release_actions', self.release_actions);
	});

	return self;
}

action.prototype.func = function () {
	var self = this;
};

exports = module.exports = function (system) {
	return new action(system);
};
