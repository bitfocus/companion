import { EntityModelType, type EntityOwner, type SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'

export interface EntityRowHeaderDisplay {
	/** The text to show as the row's name */
	headline: string
	/** The name of the local variable whose current value should be previewed, or null to show no value */
	localVariableValueName: string | null
}

/**
 * Work out what a collapsed entity row's header should display. For a named local variable (a
 * top-level value-feedback in a local-variables list) this returns the `$(prefix:name)` label and
 * the variable name to preview its current value; otherwise it falls back to the definition name.
 */
export function getEntityRowHeaderDisplay(
	entity: SomeEntityModel,
	ownerId: EntityOwner | null,
	definitionName: string,
	isPanelCollapsed: boolean,
	localVariablePrefix: string | null
): EntityRowHeaderDisplay {
	const isCollapsedLocalVariable =
		isPanelCollapsed && !!localVariablePrefix && entity.type === EntityModelType.Feedback && !ownerId

	if (!isCollapsedLocalVariable) {
		return { headline: entity.headline || definitionName, localVariableValueName: null }
	}

	if (entity.variableName) {
		return {
			headline: `$(${localVariablePrefix}:${entity.variableName}) ${entity.headline || ''}`,
			localVariableValueName: entity.variableName,
		}
	}

	return { headline: `Unnamed: ${entity.headline || ''}`, localVariableValueName: null }
}
