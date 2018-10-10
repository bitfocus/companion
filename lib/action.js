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

	self.system.on('bank-pressed', function(page, bank, direction, deviceid) {
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

		debug('trying to run bank',page,bank,direction);

		var obj = self.bank_actions;

		// find release actions if the direction is up
		if (direction === false) {
			obj = self.bank_release_actions;
		}

		if (obj[page] === undefined) return;
		if (obj[page][bank] === undefined) return;
		if (obj[page][bank].length === 0) return;

		debug('found actions');

		var maxtime = 0;
		var maxidx = -1;

		for (var n in obj[page][bank]) {
			var a = obj[page][bank][n];
			if (a.delay !== undefined && parseInt(a.delay) > maxtime) {
				maxtime = parseInt(a.delay);
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

			var delay = parseInt(a.delay === undefined ? 0 : a.delay);

			console.log("ACTION RUN--------:", a);

			if (self.instance !== undefined && self.instance.store !== undefined && self.instance.store.db !== undefined) {
				if (self.instance.store.db[a.instance] !== undefined && self.instance.store.db[a.instance].enabled !== false) {

					// is this a timedelayed action?
					if (delay > 0) {
						has_delayed = true;
						(function(action, delay_time, n) {
							setTimeout(function() {
								self.system.emit('action_run', action, { deviceid: deviceid, page: page, bank: bank });

								// Stop timer-indication
								if (maxtime > 0 && maxidx == n) {
									var idx;
									if ((idx = self.actions_running.indexOf(page + '_' + bank)) !== -1) {
										self.actions_running.splice(idx, 1);
										self.system.emit('graphics_invalidate_bank', page, bank);
									}
								}
							}, delay_time);
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
			self.system.emit('graphics_invalidate_bank', page, bank);
		}
	});

	self.system.emit('io_get', function(io) {
		self.io = io;
		self.io.on('connect', function(client) {

			client.on('get_actions', function() {
				client.emit('actions', self.actions);
			});

			client.on('get_release_actions', function() {
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

			client.on('bank_update_release_action_option', function(page,bank,action,option,value) {
				debug('bank_update_release_action_option', page,bank,action,option,value);
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


			client.on('bank_addAction', function(page,bank,action) {
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
				client.emit('bank_get_actions:result', page, bank, self.bank_actions[page][bank] );
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
				client.emit('bank_get_release_actions:result', page, bank, self.bank_release_actions[page][bank] );
				system.emit('instance_status_check_bank', page, bank);
			});

			client.on('bank_delAction', function(page, bank, id) {
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
				client.emit('bank_get_actions:result', page, bank, self.bank_actions[page][bank] );
				system.emit('instance_status_check_bank', page, bank);
			});

			client.on('bank_delReleaseAction', function(page, bank, id) {
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
				client.emit('bank_get_release_actions:result', page, bank, self.bank_release_actions[page][bank] );
				system.emit('instance_status_check_bank', page, bank);
			});


			client.on('bank_get_actions', function(page, bank) {
				if (self.bank_actions[page] === undefined) self.bank_actions[page] = {};
				if (self.bank_actions[page][bank] === undefined) self.bank_actions[page][bank] = [];
				client.emit('bank_get_actions:result', page, bank, self.bank_actions[page][bank] );
			});

			client.on('bank_get_release_actions', function(page, bank) {
				if (self.bank_release_actions[page] === undefined) self.bank_release_actions[page] = {};
				if (self.bank_release_actions[page][bank] === undefined) self.bank_release_actions[page][bank] = [];
				client.emit('bank_get_release_actions:result', page, bank, self.bank_release_actions[page][bank] );
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

	self.system.on('reset_bank', function (page, bank) {
		if (self.bank_actions[page] === undefined) {
			self.bank_actions[page] = {};
		}
		self.bank_actions[page][bank] = [];

		if (self.bank_release_actions[page] === undefined) {
			self.bank_release_actions[page] = {};
		}
		self.bank_release_actions[page][bank] = [];
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
