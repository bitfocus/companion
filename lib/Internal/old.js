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

	self.setVariableDefinitions(variables)

	self.setVariables({
		't-bar': '0',
		jog: '0',
		shuttle: '0',
	})
}
