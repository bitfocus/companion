var system;
var io;
var debug = require('debug')('lib/feedback');
var _ = require('lodash');
var shortid = require('shortid');

function feedback(system) {
	var self = this;

	system.emit('io_get', function (_io) {
		self.io = io = _io;
	});

	self.system = system;
	self.feedback_definitions = {};
	self.feedbacks = {};

	self.system.emit('db_get', 'feedbacks', function(res) {
		if (res !== undefined) {
			self.feedbacks = res;
		}
	});

	self.feedback_styles = {};

	system.on('feedback_instance_definitions_set', function (instance, feedbacks) {
		self.feedback_definitions[instance.id] = feedbacks;
		io.emit('feedback_get_definitions:result', self.feedback_definitions);
	});

	system.on('feedback_instanceid_check', function (instance_id) {
		debug("calling instance_get", instance_id);

		system.emit('instance_get', instance_id, function (instance) {
			//debug("calling feedback_instance_check", instance);
			system.emit('feedback_instance_check', instance);
		});

	});

	system.on('reset_bank', function (page, bank) {
		if (self.feedbacks[page] === undefined) {
			self.feedbacks[page] = {};
			self.feedback_styles[page] = {};
		}
		if (self.feedbacks[page] !== undefined && self.feedbacks[page][bank] !== undefined) {
			self.feedbacks[page][bank] = [];
		}
		if (self.feedback_styles[page] !== undefined && self.feedback_styles[page][bank] !== undefined) {
			self.feedback_styles[page][bank] = [];
		}
	});

	system.on('feedback_check_bank', function (page, bank) {
		var ids = {};
		if (self.feedbacks[page] !== undefined && self.feedbacks[page][bank] !== undefined) {
			// find all instance-ids in feedbacks for bank
			for (var i = 0; i < self.feedbacks[page][bank].length; ++i) {
				ids[self.feedbacks[page][bank][i].instance_id] = 1;
			}
		}

		// Recheck all instance-ids in feedbacks for bank
		ids = Object.keys(ids);
		for (var i = 0; i < ids.length; ++i) {
			system.emit('feedback_instanceid_check', ids[i]);
		}
	});

	system.on('feedback_getall', function (cb) {
		cb(self.feedbacks);
	});

	system.on('feedback_instance_check', function (instance, type) {
		//debug('Instance ' + instance.label + ' wants us to check banks (' + type + ')');
		for (var page in self.feedbacks) {
			for (var bank in self.feedbacks[page]) {

				// Iterate through feedbacks on this bank
				if (self.feedbacks[page][bank] !== undefined) {
					for (var i in self.feedbacks[page][bank]) {
						var feedback = self.feedbacks[page][bank][i];

						if (type !== undefined && feedback.type != type) {
							continue;
						}

						if (feedback.instance_id == instance.id) {
							system.emit('get_bank', page, bank, function (bank_obj) {

								// Ask instance to check bank for custom styling
								if (typeof instance.feedback == 'function') {
									var result = instance.feedback(feedback, bank_obj);
									self.setStyle(page, bank, feedback.id, result);
								} else {
									debug('ERROR: instance ' + instance.label + ' does not have a feedback() function');
								}

							});
						}
					}
				}

			}
		}
	});

	system.on('feedback_delete', function (page, bank, id) {
		if (self.feedback_styles[page] !== undefined && self.feedback_styles[page][bank] !== undefined) {
			delete self.feedback_styles[page][bank][feedback.id];
		}

		system.emit('feedback_check_bank', page, bank);
	});

	system.on('instance_delete', function (id) {

		for (var page in self.feedbacks) {
			for (var bank in self.feedbacks[page]) {
				if (self.feedbacks[page][bank] !== undefined) {
					for (var i = 0; i < self.feedbacks[page][bank].length ; ++i) {

						var feedback = self.feedbacks[page][bank][i];

						if (feedback.instance_id == id) {
							debug('Deleting feedback ' + i + ' from bank ' + page + '.' + bank);
							system.emit('feedback_delete', page, bank, feedback.id);
							self.feedbacks[page][bank].splice(i, 1);
							i--;
						}

					}
				}
			}
		}

	});

	system.on('feedback_save', function() {
		self.system.emit('db_set', 'feedbacks', self.feedbacks);
		self.system.emit('db_save');

		debug('saving');
	});


	system.on('feedback_get_style', function (page, bank, cb) {
		if (self.feedback_styles[page] === undefined || self.feedback_styles[page][bank] === undefined) {
			return cb(undefined);
		}

		var styles = {};
		for (var id in self.feedback_styles[page][bank]) {
			debug('Bank, change for id ' + id);
			if (self.feedback_styles[page][bank][id] !== undefined) {
				for (var key in self.feedback_styles[page][bank][id]) {
					styles[key] = self.feedback_styles[page][bank][id][key];
				}
			}
		}
		if (Object.keys(styles).length == 0) {
			return cb(undefined);
		}

		return cb(styles);
	});

	io.on('connect', function (client) {
		client.on('bank_addFeedback', function(page, bank, feedback) {
			if (self.feedbacks[page] === undefined) self.feedbacks[page] = {};
			if (self.feedbacks[page][bank] === undefined) self.feedbacks[page][bank] = [];
			var s = feedback.split(/:/);

			self.feedbacks[page][bank].push({
				'id': shortid.generate(),
				'type': s[1],
				'instance_id': s[0],
				'options': {}
			});

			system.emit('feedback_save');
			client.emit('bank_get_feedbacks:result', page, bank, self.feedbacks[page][bank] );
			// feedback_instance_check
		});

		client.on('bank_delFeedback', function(page, bank, id) {
			var feedbacks = self.feedbacks[page][bank];
			system.emit('feedback_delete', page, bank, feedback.id);

			for (var i = 0; i < feedbacks.length; ++i) {
				if (feedbacks[i].id == id) {
					feedbacks.splice(i, 1);
					break;
				}
			}

			system.emit('feedback_save');
			client.emit('bank_get_feedbacks:result', page, bank, self.feedbacks[page][bank] );
			// feedback_instance_check
		});

		client.on('bank_update_feedback_option', function(page, bank, feedbackid, option, value) {
			debug('bank_update_feedback_option', page, bank, feedbackid, option, value);
			var feedbacks = self.feedbacks[page][bank];
			if (feedbacks !== undefined) {
				for (var n in feedbacks) {
					var feedback = feedbacks[n];
					if (feedback !== undefined && feedback.id === feedbackid) {
						if (feedback.options === undefined) {
							feedback.options = {};
						}
						feedback.options[option] = value;
						self.system.emit('feedback_save');
					}
				}
			}
		});

		client.on('bank_get_feedbacks', function(page, bank) {
			if (self.feedbacks[page] === undefined) self.feedbacks[page] = {};
			if (self.feedbacks[page][bank] === undefined) self.feedbacks[page][bank] = [];
			client.emit('bank_get_feedbacks:result', page, bank, self.feedbacks[page][bank] );
		});

		client.on('feedback_get_definitions', function () {
			client.emit('feedback_get_definitions:result', self.feedback_definitions);
		});
	});

}

feedback.prototype.setStyle = function(page, bank, instance_id, style) {
	var self = this;

	if (self.feedback_styles[page] === undefined) {
		self.feedback_styles[page] = {};
	}

	if (self.feedback_styles[page][bank] === undefined) {
		self.feedback_styles[page][bank] = {};
	}

	if (!_.isEqual(style, self.feedback_styles[page][bank][instance_id])) {
		debug('Feedback changed style of bank ' + page + '.' + bank);
		self.feedback_styles[page][bank][instance_id] = style;
		self.system.emit('graphics_invalidate_bank', page, bank);
	}
};

exports = module.exports = function (system) {
	return new feedback(system);
};
