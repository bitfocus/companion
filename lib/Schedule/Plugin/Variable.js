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

const SchedulePluginBase = require('./Base')

class SchedulePluginVariable extends SchedulePluginBase {
	setup() {
		this.system.on('variable_changed', this.matches.bind(this))

		this.options = [
			{
				key: 'key',
				name: 'Variable name',
				type: 'textinput',
				placeholder: 'Ex: internal:time_m',
				pattern: '([A-Za-z0-9 :_-]*)',
			},
			{
				key: 'check',
				name: 'Type',
				type: 'select',
				choices: [
					{ id: 'eq', label: '=' },
					{ id: 'ne', label: '!=' },
					{ id: 'gt', label: '>' },
					{ id: 'lt', label: '<' },
				],
			},
			{
				key: 'value',
				name: 'Value',
				type: 'textinput',
			},
		]
	}

	/**
	 * @access protected
	 */
	checkVariable(varCheck, value, cond) {
		if (cond.key !== varCheck) {
			return false
		}

		switch (cond.check) {
			case 'gt':
				return parseFloat(cond.value) > value
			case 'lt':
				return parseFloat(cond.value) < value
			case 'ne':
				return cond.value != value
			default:
				return cond.value == value
		}
	}

	/**
	 * @access protected
	 */
	condDesc(desc) {
		return `$(${desc.key}) ${this.options[1].choices.find((x) => x.id == desc.check).label} ${desc.value}`
	}

	configDesc(config) {
		let condList = []
		if (Array.isArray(config)) {
			config.forEach((x) => condList.push(this.condDesc(x)))
		} else {
			condList.push(this.condDesc(config))
		}
		return `Runs when variable <strong>${condList.join('</strong> AND <strong>')}</strong>.`
	}

	get multiple() {
		return true
	}

	get name() {
		return 'Variable value'
	}

	get type() {
		return 'variable'
	}

	/**
	 * Checks if event should work
	 * @param {number} day
	 * @param {string} hms
	 */
	matches(label, key, value) {
		const varCheck = `${label}:${key}`

		this.watch.forEach((x) => {
			if (Array.isArray(x.config)) {
				// Since we're checking multiple vars, we need to make sure one of the ones we're looking for HAS been updated and is valid
				// If it hasn't, we won't run any further logic
				let validVar = x.config.find((x) => x.key === varCheck)
				if (validVar === undefined || !this.checkVariable(varCheck, value, validVar)) {
					return false
				}

				let checkAll = []
				x.config.forEach((k) => {
					// We've already checked this and it was true...
					if (k.key === varCheck) {
						return
					}

					checkAll.push(
						new Promise((resolve, reject) => {
							this.scheduler.system.emit('variable_parse', `$(${k.key})`, (val) => {
								if (!this.checkVariable(k.key, val, k)) {
									reject()
								} else {
									resolve()
								}
							})
						}).catch((reason) => {
							throw Error('Value does not match')
						})
					)
				})

				// If any are rejected, we'll immediately ignore everything else
				Promise.all(checkAll)
					.then((valReturn) => {
						this.scheduler.action(x.id)
					})
					.catch(() => {})
			} else if (this.checkVariable(varCheck, value, x.config)) {
				this.scheduler.action(x.id)
			}
		})
	}
}

module.exports = SchedulePluginVariable
