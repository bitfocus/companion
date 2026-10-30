/**
 * The local variables of a copy of a custom action or feedback are its own, and can not be seen by the control which holds the
 * copy, nor can the copy see those of the control. As the entities of the copy live in that control, a reference to
 * one of the copy's local variables is tracked under an id which names the copy, so that a change to a local variable
 * of the control doesn't reach the entities of the copy, and a change to one of the copy reaches only its entities.
 */

/**
 * The id a local variable of a copy of a custom action or feedback is tracked under, which can never be a real variable id
 * @param localVariablesScopeId The scope of the local variables of the copy
 * @param rawName The name of the variable, without the `local:` prefix
 */
export function localVariableIdInScope(localVariablesScopeId: string, rawName: string): string {
	return `local@${localVariablesScopeId}:${rawName}`
}

/**
 * Track the variables referenced by an entity under the ids for its scope
 * @param variableIds The variables referenced by the entity
 * @param localVariablesScopeId The scope of the local variables the entity sees, or null when they are those of its
 * control
 */
export function scopeReferencedVariableIds<T extends ReadonlySet<string>>(
	variableIds: T,
	localVariablesScopeId: string | null
): T | Set<string> {
	if (localVariablesScopeId === null) return variableIds

	const scoped = new Set<string>()
	for (const id of variableIds) {
		scoped.add(id.startsWith('local:') ? localVariableIdInScope(localVariablesScopeId, id.slice(6)) : id)
	}
	return scoped
}
