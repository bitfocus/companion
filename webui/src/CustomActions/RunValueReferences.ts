import { isVirtualConnectionId } from '@companion-app/shared/ConnectionId.js'
import { EntityModelType, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { isExpressionOrValue } from '@companion-app/shared/Model/Options.js'

const RUN_VALUE_REFERENCE = /\$\((options|local):/

/**
 * Find the module feedbacks in some entities whose options reference the values of a run of a custom action
 * (`$(options:x)` or `$(local:x)`). A module feedback is evaluated ahead of time, with the default inputs of the
 * custom action, so it can't see the values of a run.
 */
export function findModuleFeedbacksUsingRunValues(entities: SomeEntityModel[]): SomeEntityModel[] {
	const found: SomeEntityModel[] = []

	const visit = (entity: SomeEntityModel) => {
		if (
			entity.type === EntityModelType.Feedback &&
			!entity.disabled &&
			!isVirtualConnectionId(entity.connectionId) &&
			Object.values(entity.options).some(
				(value) =>
					isExpressionOrValue(value) && typeof value.value === 'string' && RUN_VALUE_REFERENCE.test(value.value)
			)
		) {
			found.push(entity)
		}

		for (const children of Object.values(entity.children ?? {})) {
			for (const child of children ?? []) visit(child)
		}
	}

	for (const entity of entities) visit(entity)

	return found
}
