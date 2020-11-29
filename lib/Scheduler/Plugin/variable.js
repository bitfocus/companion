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

const SchedulerPluginBase = require('./base');

class SchedulerPluginVariable extends SchedulerPluginBase {

	setup() {
		this.scheduler.system.on('variable_changed', this.matches.bind(this));

		this.options = [
			{
				key: 'key',
				name: 'Variable name',
				type: 'textinput',
				placeholder: 'Ex: internal:time_m',
				pattern: '([A-Za-z0-9\:\_\-]*)'
			},
			{
				key: 'check',
				name: 'Type',
				type: 'select',
				choices: [
					{ id: 'eq', label: '=' },
					{ id: 'ne', label: '!=' },
					{ id: 'gt', label: '>' },
					{ id: 'lt', label: '<' }
				]
			},
			{
				key: 'value',
				name: 'Value',
				type: 'textinput'
			}
		];
	}

	/**
	 * @access protected
	 */
	checkVariable(varCheck, value, cond) {
		if (cond.key !== varCheck) {
			return false;
		}

		switch (x.check) {
			case 'gt':
				return parseFloat(cond.value) > value;
			case 'lt':
				return parseFloat(cond.value) < value;
			case 'ne':
				return cond.value != value;
			default:
				return cond.value == value;
		}
	}

	/**
	 * @access protected
	 */
	condDesc(desc) {
		return `$(${desc.key}) ${this.options[1].choices.find(x => x.id == desc.check).label} ${desc.value}`;
	}

	configDesc(config) {
		let condList = [];
		if (Array.isArray(config)) {
			config.forEach(x => condList.push(this.condDesc(x)));
		} else {
			condList.push(this.condDesc(config));
		}
		return `Runs when variable <strong>${condList.join('</strong> AND <strong>')}</strong>.`;
	}

	get multiple() {
		return true;
	}

	get name() {
		return 'Variable value';
	}

	get type() {
		return 'variable';
	}

	/**
	 * Checks if event should work
	 * @param {number} day
	 * @param {string} hms
	 */
	matches(label, key, value) {
		const varCheck = `${label}:${key}`;

		this.watch.filter(x => {
			if (Array.isArray(x.config)) {
				return x.config.every(x => this.checkVariable(varCheck, value, x))
			} else {
				return this.checkVariable(varCheck, value, x.config);
			}
		}).forEach(x => this.scheduler.action(x.id));
	}
}

module.exports = SchedulerPluginVariable;
