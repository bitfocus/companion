class PropertyActionsGenerator {
	static InsertInstances(property, action) {
		if (property.instanceIds) {
			action.options.unshift({
				type: 'dropdown',
				label: 'Instance',
				id: 'valueInstance',
				choices: property.instanceIds,
			})
		}
	}
	static SetNumberValue(property) {
		// Basic setter property
		const action = {
			label: `Set: ${property.name}`,
			description: `Set ${property.description} to value`,
			options: [
				{
					type: 'number',
					label: 'Value',
					id: 'value',
				},
			],
			hasLearn: false,
		}

		PropertyActionsGenerator.InsertInstances(property, action)

		return action
	}

	static AutoGenerate(property) {
		const actions = {}

		switch (property.type) {
			case 'number':
				actions['set-value'] = PropertyActionsGenerator.SetNumberValue(property)
				break
		}

		return actions
	}
}

export default PropertyActionsGenerator
