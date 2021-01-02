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

const debug            = require('debug')('lib/Bank/Feedback');
const CoreBase         = require('../Core/Base');
const BankFeedbackItem = require('./FeedbackItem');
const { isEqual }      = require('lodash');

class BankFeedbackController extends CoreBase {

	constructor(registry) {
		super(registry, 'feedback');

		this.feedback = new BankFeedbackItem(registry, this, 'feedback', 'feedbacks');

		this.definitions = {};
		
		// Permanent
		this.system.on('feedbacks_for_instance', this.getInstanceFeedbacks.bind(this));
		this.system.on('feedback_instance_check', this.checkInstanceStatus.bind(this));
		this.system.on('feedback_instance_definitions_set', this.setInstanceDefinitions.bind(this));

		this.system.on('feedbacks_for_instance', (id, cb) => {
			if (cb !== undefined && typeof cb == 'function') {
				cb(this.getInstanceFeedbacks(id));
			}
		});

		// Temporary
		this.system.on('instance_delete', this.deleteInstance.bind(this));
		this.system.on('feedback_check_bank', this.checkBankStatus.bind(this));

		this.system.on('feedback_get_style', (page, bank, cb) => {
			if (cb !== undefined && typeof cb == 'function') {
				cb(this.getBankStyle(page, bank));
			}
		});
	}

	checkBanks(pageBankArray) {

		if (pageBankArray.length > 0) {
			for(let s in pageBankArray) {
				let bp = s.split('_');
				this.checkBankStyle(bp[0], bp[1]);
			}
		}
	}

	checkBankStatus(page, bank, invalidate = true) {
		this.feedback.checkBankStatus(page, bank);

		this.checkBankStyle(page, bank, invalidate);
	}

	checkBankStyle(page, bank, invalidate = true) {
		let styles = this.feedback.getBankStyles(page, bank, true);
		let style = {};

		for (let index in this.feedback_styles[page][bank]) {
			let s = this.feedback.getStyle(page, bank, index);
			if (s !== undefined) {
				for (let key in style) {
					style[key] = s[key];
				}
			}
		}

		if (!isEqual(styles, this.bankStyles[page + '_' + bank])) {
			this.bankStyles[page + '_' + bank] = style;

			if (invalidate === true) {
				this.graphics().invalidateBank(page, bank);
			}
		}
	}

	checkInstanceStatus(instance, type) {
		let checkQueue = this.feedback.checkInstanceStatus(instance, type);

		this.checkBanks(checkQueue);
	}

	clientConnect(client) {
		client.on('feedback_get_definitions', () => {
			client.emit('feedback_get_definitions:result', this.definitions);
		});

		client.on('bank_update_feedback_option', this.feedback.updateItemOption.bind(this.feedback));
		client.on('bank_update_feedback_order',  this.feedback.updateItemOrder.bind(this.feedback));

		client.on('bank_addFeedback',   this.feedback.addItemByClient.bind(    this.feedback, client, 'bank_get_feedbacks:result'));
		client.on('bank_delFeedback',   this.feedback.deleteItemByClient.bind( this.feedback, client, 'bank_get_feedbacks:result'));
		client.on('bank_get_feedbacks', this.feedback.getBankByClient.bind(    this.feedback, client, 'bank_get_feedbacks:result'));
	}

	deleteInstance(id) {

		delete this.definitions[id];

		this.updateDefinitions();

		let checkQueue = this.feedback.deleteInstance(id, []);

		this.checkBanks(checkQueue);
	}

	getBankStyle(page, bank) {
		this.bankStyles[page + '_' + bank];
	}

	getFeedbacks(clone = false) {
		this.feedback.getAll(clone);
	}

	getInstanceFeedbacks(instanceId) {
		this.feedback.getInstanceItems(instanceId);
	}

	resetBank(page, bank) {
		this.feedback.resetBank(page, bank);
	}

	save() {
		this.feedback.save();
	}

	setInstanceDefinitions(id, feedbcaks) {
		this.definitions[id] = feedbcaks;
		this.updateDefinitions();
	}

	updateDefinitions() {
		this.feedback.setDefinitions(this.definitions);
		debug('feedbacks_update:', this.definitions);
		this.io().emit('feedback_get_definitions:result', this.definitions);
	}
}

exports = module.exports = BankFeedbackController;