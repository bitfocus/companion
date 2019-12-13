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

	self.system.on('15to32', function () {
		// Convert config from 15 to 32 keys format
		for (var page in self.config) {
			for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				if (self.feedbacks[page][bank] === undefined) {
					self.feedbacks[page][bank] = [];
				}
				if (self.feedback_styles[page][bank] === undefined) {
					self.feedback_styles[page][bank] = [];
				}
			}
		}
	});

	system.on('feedback_instance_definitions_set', function (instance, feedbacks) {
		self.feedback_definitions[instance.id] = feedbacks;
		io.emit('feedback_get_definitions:result', self.feedback_definitions);
	});

	system.on('feedback_instanceid_check', function (instance_id) {
		debug("calling instance_get", instance_id);

		system.emit('instance_get', instance_id, function (instance) {
			//debug("calling feedback_instance_check", instance);
			if (instance !== undefined) {
				system.emit('feedback_instance_check', instance);
			}
		});

	});

	system.on('bank_reset', function (page, bank) {
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

	system.on('feedbacks_for_instance', function (instance_id, cb) {
		var fbs = [];
		for (var page in self.feedbacks) {
			for (var bank in self.feedbacks[page]) {
				for (var i in self.feedbacks[page][bank]) {
					var feedback = self.feedbacks[page][bank][i];
					if (feedback.instance_id == instance_id) {
						fbs.push(feedback);
					}
				}
			}
		}
		cb(fbs);
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
								var definition;

								if (self.feedback_definitions[instance.id] !== undefined && self.feedback_definitions[instance.id][feedback.type] !== undefined) {
									definition = self.feedback_definitions[instance.id][feedback.type];
								}

								// Ask instance to check bank for custom styling
								if (definition !== undefined && definition.callback !== undefined && typeof definition.callback == 'function') {
									var result = definition.callback(feedback, bank_obj);
									self.setStyle(page, bank, feedback.id, result);
								} else if (typeof instance.feedback == 'function') {
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
			delete self.feedback_styles[page][bank][id];
		}

		system.emit('graphics_bank_invalidate', page, bank);
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

							if (self.feedback_styles[page] !== undefined && self.feedback_styles[page][bank] !== undefined && self.feedback_styles[page][bank][feedback.id]) {
								delete self.feedback_styles[page][bank][feedback.id];
								self.system.emit('graphics_bank_invalidate', page, bank);
							}

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

	system.on('io_connect', function (client) {
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
			// feedback_instance_check will be called as the options get filled in
		});

		client.on('bank_delFeedback', function(page, bank, id) {
			var feedbacks = self.feedbacks[page][bank];

			for (var i = 0; i < feedbacks.length; ++i) {
				if (feedbacks[i].id == id) {
					feedbacks.splice(i, 1);
					break;
				}
			}

			system.emit('feedback_delete', page, bank, id);

			system.emit('feedback_save');
			client.emit('bank_get_feedbacks:result', page, bank, self.feedbacks[page][bank] );
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
						self.system.emit('feedback_instanceid_check', feedback.instance_id)
					}
				}
			}
		});

		client.on('bank_get_feedbacks', function(page, bank) {
			if (self.feedbacks[page] === undefined) self.feedbacks[page] = {};
			if (self.feedbacks[page][bank] === undefined) self.feedbacks[page][bank] = [];
			client.emit('bank_get_feedbacks:result', page, bank, self.feedbacks[page][bank] );
		});

		client.on('bank_update_feedback_order', function(page, bank, old_index, new_index) {
			var feedbacks = self.feedbacks[page][bank];
			if (feedbacks !== undefined) {
				feedbacks.splice(new_index, 0, feedbacks.splice(old_index, 1)[0]);
				self.system.emit('action_save');
			}
		});

		client.on('feedback_get_definitions', function () {
			client.emit('feedback_get_definitions:result', self.feedback_definitions);
		});
	});

}

feedback.prototype.setStyle = function(page, bank, feedback_id, style) {
	var self = this;

	if (self.feedback_styles[page] === undefined) {
		self.feedback_styles[page] = {};
	}

	if (self.feedback_styles[page][bank] === undefined) {
		self.feedback_styles[page][bank] = {};
	}

	if (!_.isEqual(style, self.feedback_styles[page][bank][feedback_id])) {
		debug('Feedback changed style of bank ' + page + '.' + bank);
		self.feedback_styles[page][bank][feedback_id] = style;
		self.system.emit('graphics_bank_invalidate', page, bank);
	}
};

exports = module.exports = function (system) {
	return new feedback(system);
};
