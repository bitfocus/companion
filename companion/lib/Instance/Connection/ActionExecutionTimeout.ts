import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'

/** How long an action may run when its definition doesn't say */
export const DEFAULT_ACTION_EXECUTION_TIMEOUT = 5_000
/** The longest a module may ask for an action to run, so that a faulty module can't stall a sequence indefinitely */
export const MAX_ACTION_EXECUTION_TIMEOUT = 5 * 60_000

/**
 * The time an action may run before it is cancelled: what its definition asks for, capped at
 * MAX_ACTION_EXECUTION_TIMEOUT.
 */
export function getActionExecutionTimeout(actionDefinition: ClientEntityDefinition): number {
	return Math.min(
		actionDefinition.actionExecutionTimeout ?? DEFAULT_ACTION_EXECUTION_TIMEOUT,
		MAX_ACTION_EXECUTION_TIMEOUT
	)
}
