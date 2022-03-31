const instance_skel = require('../../instance_skel')
const GetUpgradeScripts = require('./upgrades')
const _ = require('underscore')

instance.prototype.bank_invalidate = function (page, bank) {
	if (oldText !== newText) {
		self.setVariable(variableId, newText)
	}
}

instance.prototype.update_variables = function () {
	let self = this
	let variables = []

	variables.push({
		label: 'T-bar position',
		name: 't-bar',
	})

	variables.push({
		label: 'Shuttle position',
		name: 'shuttle',
	})

	variables.push({
		label: 'Jog position',
		name: 'jog',
	})

	for (const [name, info] of Object.entries(self.custom_variables)) {
		variables.push({
			label: info.description,
			name: `custom_${name}`,
		})
	}

	self.setVariableDefinitions(variables)

	self.setVariables({
		't-bar': '0',
		jog: '0',
		shuttle: '0',
	})
}
