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

var debug            = require('debug')('lib/Bank/Feedback');
var CoreBase         = require('../Core/Base');
var BankFeedbackItem = require('./FeedbackItem');
var { isEqual }      = require('lodash');

class BankFeedbackController extends CoreBase {

	constructor(registry, bank) {
		super(registry, 'feedback');

		this.bank     = bank;
		this.feedback = new BankFeedbackItem(registry, 'feedback', 'feedbacks');

		this.definitions = {};

		this.feedback_styles = {};

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

		this.system.on('feedback_getall', this.getFeedbacks.bind(this));

		this.system.on('feedbacks_for_instance', this.getInstanceActions.bind(this));

		this.system.on('feedback_instance_check', this.checkInstanceFeedback.bind(this));

		this.system.on('feedback_delete', this.deleteFeedback.bind(this));

		this.system.on('instance_delete', this.deleteInstance.bind(this));

		this.system.on('feedback_save', this.save.bind(this));

		this.system.on('io_connect', (client) => {

			client.on('feedback_get_definitions', () => {
				client.emit('feedback_get_definitions:result', this.feedback_definitions);
			});
		});

	}

	checkBankFeedback(page, bank) {
		var ids = {};

		if (this.feedbacks[page] !== undefined && this.feedbacks[page][bank] !== undefined) {
			// find all instance-ids in feedbacks for bank
			for (var i = 0; i < this.feedbacks[page][bank].length; ++i) {
				ids[this.feedbacks[page][bank][i].instance] = 1;
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

						if (feedback.instance == instance.id) {
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

	deleteInstance(id) {

		delete this.feedback_definitions[id]

		this.system.emit('feedback_update');
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
					if (feedback.instance == instance_id) {
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
		//this.db.setKey('feedbacks', this.feedbacks);
		this.db.setDirty();

		debug('saving');
	}

	setStyle(page, bank, index, style) {

		if (this.feedback_styles[page] === undefined) {
			this.feedback_styles[page] = {};
		}

		if (this.feedback_styles[page][bank] === undefined) {
			this.feedback_styles[page][bank] = [];
		}

		if (!isEqual(style, this.feedback_styles[page][bank][index])) {
			debug('Feedback changed style of bank ' + page + '.' + bank);
			this.feedback_styles[page][bank][index] = style;
			this.system.emit('graphics_bank_invalidate', page, bank);
		}
	}
}

exports = module.exports = BankFeedbackController;