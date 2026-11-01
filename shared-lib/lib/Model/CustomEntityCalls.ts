/**
 * The ids (`<connectionId>:<definitionId>`) of the custom actions or feedbacks which can't be added to a control, as
 * using them there would come back to the custom action or feedback being edited: itself, and any which use it
 * @param controlId The control being edited
 * @param customEntities Each custom action or feedback of the kind, by its control id, with the ids of those it uses
 * @param getCallDefinition Get the connection and definition of the entity which uses a control of the kind
 */
export function getCustomEntityCallsExcludedFrom(
	controlId: string,
	customEntities: Iterable<[string, { readonly calledIds: ReadonlyArray<string> }]>,
	getCallDefinition: (controlId: string) => { connectionId: string; definitionId: string } | null
): Set<string> {
	const excluded = new Set<string>()

	const self = getCallDefinition(controlId)
	if (!self) return excluded

	excluded.add(`${self.connectionId}:${self.definitionId}`)
	for (const [otherControlId, info] of customEntities) {
		const other = getCallDefinition(otherControlId)
		if (other && info.calledIds.includes(self.definitionId)) {
			excluded.add(`${other.connectionId}:${other.definitionId}`)
		}
	}

	return excluded
}
