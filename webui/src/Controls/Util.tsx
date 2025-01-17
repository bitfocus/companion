import type { EntityOwner, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'

export function findAllEntityIdsDeep(entities: SomeEntityModel[]): string[] {
	const result: string[] = entities.map((f) => f.id)

	for (const action of entities) {
		if (!action.children) continue

		for (const childGroup of Object.values(action.children)) {
			if (!childGroup) continue
			result.push(...findAllEntityIdsDeep(childGroup))
		}
	}

	return result
}

export function stringifyEntityOwnerId(ownerId: EntityOwner | null): string | null {
	if (!ownerId) return null

	return `${ownerId.parentId}_${ownerId.childGroup}`
}
