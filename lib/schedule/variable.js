const plugin_base = require('./plugin_base');

class variable extends plugin_base {
	setup() {
		this.scheduler.system.on('variable_changed', this.matches.bind(this));

		this.options = [
			{
				key: 'key',
				name: 'Variable name',
				type: 'textinput',
				placeholder: 'Name of variable, such as internal:time_hms (without the $())',
				pattern: '([A-Za-z0-9\:\_]*)'
			},
			{
				key: 'check',
				name: 'Type',
				type: 'select',
				choices: [
					{ id: 'eq', label: '=' },
					{ id: 'gt', label: '>' },
					{ id: 'lt', label: '<' }
				]
			},
			{
				key: 'value',
				name: 'Value',
				type: 'textinput',
				placeholder: 'Value of the variable'
			}
		];
	}

	/**
	 * Checks if event should work
	 * @param {number} day
	 * @param {string} hms
	 */
	matches(label, key, value) {
		this.watch.filter(x => {
			if (x.config.key === `${label}:${key}`) {
				switch (x.config.check) {
					case 'gt':
						return parseFloat(x.config.value) > value;
					case 'lt':
						return parseFloat(x.config.value) < value;
					default:
						return x.config.value == value;
				}
			}
		}).forEach(x => this.scheduler.action(x.id));
	}

	get type() {
		return 'variable';
	}

	get name() {
		return 'Variable value';
	}

	config_desc(config) {
		return `Runs when variable <strong>$(${config.key}) ${this.options[1].choices.find(x => x.id == config.check).label} ${config.value}</strong>.`;
	}
}

module.exports = variable;
