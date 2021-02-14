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

var debug = require('debug')('lib/feedback');
var _ = require('lodash');
var shortid = require('shortid');

class feedback {
	constructor(system) {
		
		this.system = system;
		this.feedback_definitions = {};
		this.feedbacks = {};
		
		this.system.emit('io_get', (io) => {
			this.io = io
		});

		this.system.emit('db_get', 'feedbacks', (res) => {
			if (res !== undefined) {
				this.feedbacks = res;
			}
		});

		this.feedback_styles = {};

		this.system.on('15to32', this.upgrade15to32.bind(this));

		this.system.on('feedback_instance_definitions_set', (instance, feedbacks) => {
			this.feedback_definitions[instance.id] = feedbacks;
			this.io.emit('feedback_get_definitions:result', this.feedback_definitions);
		});

		this.system.on('feedback_update', () => {
			this.io.emit('feedback_get_definitions:result', this.feedback_definitions);
		})

		this.system.on('feedback_instanceid_check', (instance_id) => {
			debug("calling instance_get", instance_id);

			this.system.emit('instance_get', instance_id, (instance) => {
				//debug("calling feedback_instance_check", instance);
				if (instance !== undefined) {
					this.system.emit('feedback_instance_check', instance);
				}
			});
		});

		this.system.on('bank_reset', this.resetBank.bind(this));

		this.system.on('feedback_check_bank', this.checkBankFeedback.bind(this));

		this.system.on('feedback_subscribe_bank', this.unsubscribeBank.bind(this));

		this.system.on('feedback_unsubscribe_bank', this.unsubscribeBank.bind(this));

		this.system.on('feedback_getall', this.getFeedbacks.bind(this));

		this.system.on('feedbacks_for_instance', this.getInstanceActions.bind(this));

		this.system.on('feedback_instance_check', this.checkInstanceFeedback.bind(this));

		this.system.on('feedback_delete', this.deleteFeedback.bind(this));

		this.system.on('instance_delete', this.deleteInstance.bind(this));

		this.system.on('feedback_save', this.save.bind(this));

		this.system.on('feedback_get_style', this.getBankStyle.bind(this));

		this.system.on('instance', this.setInstance.bind(this));

		this.system.on('io_connect', (client) => {

			client.on('bank_addFeedback', (page, bank, feedback) => {
				this.addFeedback(page, bank, feedback);	
				client.emit('bank_get_feedbacks:result', page, bank, this.feedbacks[page][bank] );
			});

			client.on('bank_delFeedback', (page, bank, id) => {
				this.deleteFeedbackByID(page, bank, id);
				client.emit('bank_get_feedbacks:result', page, bank, this.feedbacks[page][bank] );
			});

			client.on('bank_update_feedback_option', this.updateFeedbackOption.bind(this));

			client.on('bank_get_feedbacks', (page, bank) => {
				if (this.feedbacks[page] === undefined) this.feedbacks[page] = {};
				if (this.feedbacks[page][bank] === undefined) this.feedbacks[page][bank] = [];
				client.emit('bank_get_feedbacks:result', page, bank, this.feedbacks[page][bank] );
			});

			client.on('bank_update_feedback_order', this.updateFeedbackOrder.bind(this));

			client.on('feedback_get_definitions', () => {
				client.emit('feedback_get_definitions:result', this.feedback_definitions);
			});
		});

	}

	addFeedback(page, bank, feedback) {
		if (this.feedbacks[page] === undefined) this.feedbacks[page] = {};
		if (this.feedbacks[page][bank] === undefined) this.feedbacks[page][bank] = [];

		var s = feedback.split(/:/);
		var fb = {
			'id': shortid.generate(),
			'type': s[1],
			'instance_id': s[0],
			'options': {}
		}

		if (!this.instance.store.db[fb.instance_id]) {
			// Feedback is not valid
			return
		}

		if (this.feedback_definitions[s[0]] !== undefined && this.feedback_definitions[s[0]][s[1]] !== undefined) {
			var definition = this.feedback_definitions[s[0]][s[1]];

			if (definition.options !== undefined && definition.options.length > 0) {
				for(var j in definition.options) {
					var opt = definition.options[j];
					fb.options[opt.id] = opt.default;
				}
			}
		}

		this.feedbacks[page][bank].push(fb);
		this.subscribeFeedback(fb);

		this.system.emit('feedback_save');
		// feedback_instance_check will be called as the options get filled in
	}

	checkBankFeedback(page, bank) {
		var ids = {};

		if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
			// find all instance-ids in feedbacks for bank
			for (var i = 0; i < this.feedbacks[page][bank].length; ++i) {
				ids[this.feedbacks[page][bank][i].instance_id] = 1;
			}
		}

		// Recheck all instance-ids in feedbacks for bank
		ids = Object.keys(ids);

		for (var i = 0; i < ids.length; ++i) {
			this.system.emit('feedback_instanceid_check', ids[i]);
		}
	}

	checkInstanceFeedback(instance, type) {
		//debug('Instance ' + instance.label + ' wants us to check banks (' + type + ')');
		for (var page in this.feedbacks) {
			for (var bank in this.feedbacks[page]) {
				// Iterate through feedbacks on this bank
				if (this.feedbacks[page][bank] !== undefined) {
					for (var i in this.feedbacks[page][bank]) {
						var feedback = this.feedbacks[page][bank][i];

						if (type !== undefined && feedback.type != type) {
							continue;
						}

						if (feedback.instance_id == instance.id) {
							this.system.emit('get_bank', page, bank, (bank_obj) => {
								var definition;

								if (this.feedback_definitions[instance.id] !== undefined && this.feedback_definitions[instance.id][feedback.type] !== undefined) {
									definition = this.feedback_definitions[instance.id][feedback.type];
								}

								try {
									// Ask instance to check bank for custom styling
									if (definition !== undefined && definition.callback !== undefined && typeof definition.callback == 'function') {
										var result = definition.callback(feedback, bank_obj);
										this.setStyle(page, bank, i, result);
									} else if (typeof instance.feedback == 'function') {
										var result = instance.feedback(feedback, bank_obj);
										this.setStyle(page, bank, i, result);
									} else {
										debug('ERROR: instance ' + instance.label + ' does not have a feedback() function');
									}
								}
								catch(e) {
									this.system.emit('log', 'instance('+instance.label+')', 'warn', 'Error checking feedback: ' + e.message);
								}
							});
						}
					}
				}
			}
		}
	}

	deleteFeedback(page, bank, index) {
		if(this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined && this.feedbacks[page][bank][index]!== undefined) {
			this.unsubscribeFeedback(this.feedbacks[page][bank][index])
			this.feedbacks[page][bank].splice(index, 1);
		}

		if (this.feedback_styles[page] !== undefined && this.feedback_styles[page][bank] !== undefined && this.feedback_styles[page][bank][index] !== undefined) {
			this.feedback_styles[page][bank].splice(index, 1);
		}

		this.system.emit('graphics_bank_invalidate', page, bank);
	}

	deleteFeedbackByID(page, bank, id) {
		var feedbacks = this.feedbacks[page][bank];

		for (var i = 0; i < feedbacks.length; ++i) {
			if (feedbacks[i].id == id) {
				this.system.emit('feedback_delete', page, bank, i);
				break;
			}
		}

		this.system.emit('feedback_save');
	}

	deleteInstance(id) {

		for (var page in this.feedbacks) {
			for (var bank in this.feedbacks[page]) {
				if (this.feedbacks[page][bank] !== undefined) {
					for (var i = 0; i < this.feedbacks[page][bank].length ; ++i) {
						var feedback = this.feedbacks[page][bank][i];

						if (feedback.instance_id == id) {
							debug('Deleting feedback ' + i + ' from bank ' + page + '.' + bank);
							this.system.emit('feedback_delete', page, bank, i);

							i--;
						}
					}
				}
			}
		}

		delete this.feedback_definitions[id]

		this.system.emit('feedback_update');
	}

	getBankStyle(page, bank, cb) {

		if (this.feedback_styles[page] === undefined || this.feedback_styles[page][bank] === undefined) {
			return cb(undefined);
		}

		var styles = {};

		for (var i in this.feedback_styles[page][bank]) {
			if (this.feedback_styles[page][bank][i] !== undefined) {
				for (var key in this.feedback_styles[page][bank][i]) {
					styles[key] = this.feedback_styles[page][bank][i][key];
				}
			}
		}

		if (Object.keys(styles).length == 0) {
			return cb(undefined);
		}

		return cb(styles);
	}

	getFeedbacks(cb) {
		cb(this.feedbacks);
	}

	getInstanceActions(instance_id, cb) {
		var fbs = [];

		for (var page in this.feedbacks) {
			for (var bank in this.feedbacks[page]) {
				for (var i in this.feedbacks[page][bank]) {
					var feedback = this.feedbacks[page][bank][i];
					if (feedback.instance_id == instance_id) {
						fbs.push(feedback);
					}
				}
			}
		}

		cb(fbs);
	}

	resetBank(page, bank) {

		if (this.feedbacks[page] === undefined) {
			this.feedbacks[page] = {};
			this.feedback_styles[page] = {};
		}
		if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
			this.system.emit('feedback_unsubscribe_bank', page, bank);
			this.feedbacks[page][bank] = [];
		}
		if (this.feedback_styles[page] !== undefined && this.feedback_styles[page][bank] !== undefined) {
			this.feedback_styles[page][bank] = [];
		}

		this.system.emit('feedback_save');
	}

	save() {
		this.system.emit('db_set', 'feedbacks', this.feedbacks);
		this.system.emit('db_save');

		debug('saving');
	}

	setInstance(obj) {
		this.instance = obj
		debug('got instance');

		// ensure all feedbacks are valid
		const res = {}
		for (var page in this.feedbacks) {
			res[page] = {}
			for (var bank in this.feedbacks[page]) {
				res[page][bank] = []

				// Iterate through feedbacks on this bank
				if (this.feedbacks[page][bank] !== undefined) {
					for (var i in this.feedbacks[page][bank]) {
						var feedback = this.feedbacks[page][bank][i];

						if (feedback && this.instance.store.db[feedback.instance_id]) {
							res[page][bank].push(feedback)
						}
					}
				}
			}
		}
		this.feedbacks = res

		this.system.emit('db_set', 'feedbacks', this.feedbacks);
		this.system.emit('db_save');
	}

	setStyle(page, bank, index, style) {

		if (this.feedback_styles[page] === undefined) {
			this.feedback_styles[page] = {};
		}

		if (this.feedback_styles[page][bank] === undefined) {
			this.feedback_styles[page][bank] = [];
		}

		if (!_.isEqual(style, this.feedback_styles[page][bank][index])) {
			debug('Feedback changed style of bank ' + page + '.' + bank);
			this.feedback_styles[page][bank][index] = style;
			this.system.emit('graphics_bank_invalidate', page, bank);
		}
	}

	subscribeBank(page, bank) {

		if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
			// find all instance-ids in feedbacks for bank
			for (var i in this.feedbacks[page][bank]) {
				this.subscribeFeedback(this.feedbacks[page][bank][i]);
			}
		}
	}

	subscribeFeedback(feedback) {

		if (feedback.type !== undefined && feedback.instance_id !== undefined) {
			if (this.feedback_definitions[feedback.instance_id] !== undefined && this.feedback_definitions[feedback.instance_id][feedback.type] !== undefined) {
				let definition = this.feedback_definitions[feedback.instance_id][feedback.type];
				// Run the subscribe function if needed
				if (definition.subscribe !== undefined && typeof definition.subscribe == 'function') {
					definition.subscribe(feedback);
				}
			}
		}
	}

	unsubscribeBank (page, bank) {

		if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
			// find all instance-ids in feedbacks for bank
			for (var i in this.feedbacks[page][bank]) {
				this.unsubscribeFeedback(this.feedbacks[page][bank][i]);
			}
		}
	}

	unsubscribeFeedback(feedback) {

		if (feedback.type !== undefined && feedback.instance_id !== undefined) {
			if (this.feedback_definitions[feedback.instance_id] !== undefined && this.feedback_definitions[feedback.instance_id][feedback.type] !== undefined) {
				let definition = this.feedback_definitions[feedback.instance_id][feedback.type];
				// Run the unsubscribe function if needed
				if (definition.unsubscribe !== undefined && typeof definition.unsubscribe == 'function') {
					definition.unsubscribe(feedback);
				}
			}
		}
	}

	updateFeedbackOption(page, bank, feedbackid, option, value) {
		debug('bank_update_feedback_option', page, bank, feedbackid, option, value);
		var feedbacks = this.feedbacks[page][bank];

		if (feedbacks !== undefined) {
			for (var n in feedbacks) {
				var feedback = feedbacks[n];
				if (feedback !== undefined && feedback.id === feedbackid) {
					this.unsubscribeFeedback(feedback);
					if (feedback.options === undefined) {
						feedback.options = {};
					}
					feedback.options[option] = value;
					this.system.emit('feedback_save');
					this.system.emit('feedback_instanceid_check', feedback.instance_id);
					this.subscribeFeedback(feedback);
				}
			}
		}
	}

	updateFeedbackOrder(page, bank, old_index, new_index) {
		var feedbacks = this.feedbacks[page][bank];

		if (feedbacks !== undefined) {
			feedbacks.splice(new_index, 0, feedbacks.splice(old_index, 1)[0]);
			this.system.emit('feedback_save');
			this.system.emit('feedback_check_bank', page, bank)
		}
	}

	upgrade15to32() {
		// Convert config from 15 to 32 keys format
		for (var page in this.config) {
			for (var bank = 1; bank <= global.MAX_BUTTONS; ++bank) {
				if (this.feedbacks[page][bank] === undefined) {
					this.feedbacks[page][bank] = [];
				}
				if (this.feedback_styles[page][bank] === undefined) {
					this.feedback_styles[page][bank] = [];
				}
			}
		}
	}
}

exports = module.exports = function (system) {
	return new feedback(system);
};
