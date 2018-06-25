var system;
var debug   = require('debug')('lib/action');
var shortid = require('shortid');

function action(system) {
	var self = this;

	self.system = system;
	self.actions = {};
	self.bank_actions = {};
	self.bank_status = {};

	self.actions_running = [];

	self.system.emit('db_get', 'bank_actions', function(res) {
		if (res !== undefined) {
			self.bank_actions = res;
		}
	});

	self.system.on('action_save', function() {
		self.system.emit('db_set', 'bank_actions', self.bank_actions);
		self.system.emit('db_save');
		debug('saving');
	});

	self.system.on('instance_save', function() {
		setImmediate(function() {
			self.io.emit('actions', self.actions);
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
	});

	function checkBank(page, bank) {
		var status = 0;

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
			for (var bank in self.bank_actions[page]) {
				if (self.bank_actions[page][bank] !== undefined) {
					for (var i = 0; i < self.bank_actions[page][bank].length ; ++i) {
						var action = self.bank_actions[page][bank][i];

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

	self.system.on('bank-pressed', function(page, bank) {

		debug('trying to run bank',page,bank);
		if (self.bank_actions[page] === undefined) return;
		if (self.bank_actions[page][bank] === undefined) return;
		if (self.bank_actions[page][bank].length === 0) return;

		debug('found actions');

		var maxtime = 0;
		var maxidx = -1;
		for (var n in self.bank_actions[page][bank]) {
			var a = self.bank_actions[page][bank][n];
			if (a.delay !== undefined && parseInt(a.delay) > maxtime) {
				maxtime = parseInt(a.delay);
				maxidx = n;
			}
		}

		// Start timer-indication
		if (maxtime > 0) {
			self.actions_running.push(page + '_' + bank);
		}

		system.emit('graphics_indicate_push', page, bank);

		for (var n in self.bank_actions[page][bank]) {
			var a = self.bank_actions[page][bank][n];

			var delay = parseInt(a.delay === undefined ? 0 : a.delay);

			// is this a timedelayed action?
			if (delay > 0) {
				(function(action, delay_time, n) {
					setTimeout(function() {
						self.system.emit('action_run', action);

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
				self.system.emit('action_run', a);
			}
		}
	});

	self.system.emit('io_get', function(io) {
		self.io = io;
		self.io.on('connect', function(client) {
			client.on('get_actions', function() {
				client.emit('actions', self.actions);
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

			client.on('bank_reset_actions', function(page, bank) {
				self.bank_actions[page][bank] = [];
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

			client.on('bank_get_actions', function(page, bank) {
				if (self.bank_actions[page] === undefined) self.bank_actions[page] = {};
				if (self.bank_actions[page][bank] === undefined) self.bank_actions[page][bank] = [];
				client.emit('bank_get_actions:result', page, bank, self.bank_actions[page][bank] );
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
	});

	self.system.on('actions_update', function() {
		debug('actions_update:', self.actions);
		self.io.emit('actions', self.actions);
	});

	self.system.on('instance_actions', function(id, actions) {
		for (var n in actions) {
			var a = actions[n];
			self.actions[id+':'+n] = a;
			debug('adding action', id+':'+n);
		}
		self.io.emit('actions', self.actions);
	});

	return self;
}

action.prototype.func = function () {
	var self = this;
};

exports = module.exports = function (system) {
	return new action(system);
};
