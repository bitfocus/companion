const plugin_base = require('./plugin_base')

class variable extends plugin_base {
	setup() {
		this.scheduler.system.on('variable_changed', this.matches.bind(this))

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

	get multiple() {
		return true
	}

	/**
	 * Checks if event should work
	 * @param {number} day
	 * @param {string} hms
	 */
	matches(label, key, value) {
		const var_check = `${label}:${key}`

		this.watch.forEach((x) => {
			if (Array.isArray(x.config)) {
				// Since we're checking multiple vars, we need to make sure one of the ones we're looking for HAS been updated and is valid
				// If it hasn't, we won't run any further logic
				let valid_var = x.config.find((x) => x.key === var_check)
				if (valid_var === undefined || !this._check_variable(var_check, value, valid_var)) {
					return false
				}

				let check_all = []
				x.config.forEach((k) => {
					// We've already checked this and it was true...
					if (k.key === var_check) {
						return
					}

					check_all.push(
						new Promise((resolve, reject) => {
							this.scheduler.system.emit('variable_parse', `$(${k.key})`, (val) => {
								if (!this._check_variable(k.key, val, k)) {
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
				Promise.all(check_all)
					.then((val_return) => {
						this.scheduler.action(x.id)
					})
					.catch(() => {})
			} else if (this._check_variable(var_check, value, x.config)) {
				this.scheduler.action(x.id)
			}
		})
	}

	_check_variable(var_check, value, cond) {
		if (cond.key !== var_check) {
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

	get type() {
		return 'variable'
	}

	get name() {
		return 'Variable value'
	}

	_cond_desc(desc) {
		return `$(${desc.key}) ${this.options[1].choices.find((x) => x.id == desc.check).label} ${desc.value}`
	}

	config_desc(config) {
		let cond_list = []
		if (Array.isArray(config)) {
			config.forEach((x) => cond_list.push(this._cond_desc(x)))
		} else {
			cond_list.push(this._cond_desc(config))
		}
		return `Runs when variable <strong>${cond_list.join('</strong> AND <strong>')}</strong>.`
	}
}

module.exports = variable
