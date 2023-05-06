import { serializeIsVisibleFn } from '@companion-module/base/dist/internal/base.js'

class PropertyActionsGenerator {
	static #InsertInstances(property, action) {
		if (property.instanceIds) {
			action.options.unshift(
				...serializeIsVisibleFn([
					{
						type: 'checkbox',
						label: 'Instance from Expression',
						id: 'instanceUseExpression',
						default: false,
					},
					{
						type: 'dropdown',
						label: 'Instance',
						id: 'instanceValue',
						choices: property.instanceIds,
						isVisible: (options) => !options.instanceUseExpression,
					},
					{
						type: 'textinput',
						label: 'Instance Expression',
						id: 'instanceExpression',
						isVisible: (options) => !!options.instanceUseExpression,
						useVariables: true,
					},
				])
			)
		}
	}
	static #CreateSetValueExpressionFields(baseField) {
		return serializeIsVisibleFn([
			{
				type: 'checkbox',
				label: 'Value from Expression',
				id: 'valueUseExpression',
				default: false,
			},
			{
				...baseField,
				label: 'Value',
				id: 'value',
				isVisible: (options) => !options.valueUseExpression,
			},
			{
				type: 'textinput',
				label: 'Value Expression',
				id: 'valueExpression',
				isVisible: (options) => !!options.valueUseExpression,
				useVariables: true,
			},
		])
	}
	static SetNumberValue(property) {
		// Basic setter property
		const action = {
			label: `Set: ${property.name}`,
			description: `Set ${property.description} to value`,
			options: [
				...this.#CreateSetValueExpressionFields({
					type: 'number',
				}),
			],
			hasLearn: false,
		}

		PropertyActionsGenerator.#InsertInstances(property, action)

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
