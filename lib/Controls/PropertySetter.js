import CoreBase from '../Core/Base.js'

export default class PropertySetter extends CoreBase {
	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'property-setter', 'Control/PropertySetter')
	}

	async runAction(connection, action, extras) {
		const propertyDefinition = this.instance.definitions.getPropertyDefinition(action.instance, action.propertyId)
		if (propertyDefinition) {
			const instanceId = this.#parseInstanceId(propertyDefinition, action)

			switch (action.action) {
				case 'set-value': {
					await this.#runSetValue(propertyDefinition, action, connection, instanceId, extras)
					break
				}
				default: {
					throw new Error(`Action "${action.action}" not implemented!`)
				}
			}
		} else {
			this.logger.info(`Skipping unknown property ${action.propertyId} for ${connection.connectionId}`)
		}
	}

	async #runSetValue(propertyDefinition, action, connection, instanceId, extras) {
		// Parse the value
		let value = action.options.value
		if (action.options.valueUseExpression) {
			if (
				propertyDefinition.type !== 'number' &&
				propertyDefinition.type !== 'string' &&
				propertyDefinition.type !== 'boolean' &&
				propertyDefinition.type !== 'dropdown'
			)
				throw new Error(`Cannot parse an expression to type: "${propertyDefinition.type}"`)

			value = this.instance.variable.parseExpression(
				action.options.valueExpression,
				propertyDefinition.type !== 'dropdown' ? propertyDefinition.type : undefined
			).value

			// TODO - check value looks valid?
		} else if (propertyDefinition.type === 'string') {
			// if a string, we need to parse variables in the normal value
			value = this.instance.variable.parseVariables(action.options.value)
		}

		await connection.propertySet(action.propertyId, instanceId, value, extras)
	}

	#parseInstanceId(propertyDefinition, action) {
		// If the property has instanceIds, then determine what the user has chosen and validate it
		if (propertyDefinition.instanceIds) {
			let instanceId
			if (action.options.instanceUseExpression) {
				instanceId = this.instance.variable.parseExpression(action.options.instanceExpression).value
			} else {
				instanceId = action.options.instanceValue
			}

			// Try a strict then loose match
			const match =
				propertyDefinition.instanceIds.find((inst) => inst.id === instanceId) ||
				propertyDefinition.instanceIds.find((inst) => inst.id == instanceId)
			if (!match) {
				throw new Error(`Invalid instanceId: ${instanceId}`)
			}
			return match.id
		} else {
			return null
		}
	}
}
