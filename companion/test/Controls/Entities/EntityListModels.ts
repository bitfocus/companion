import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { SomeEntityModel, EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'

export function getAllModelsInTree(tree: SomeEntityModel[]): SomeEntityModel[] {
	const result: SomeEntityModel[] = []
	for (const entity of tree) {
		result.push(entity)
		if (entity.connectionId === 'internal' && entity.children) {
			for (const group of Object.values(entity.children)) {
				if (group) {
					result.push(...getAllModelsInTree(group))
				}
			}
		}
	}
	return result
}

export const ActionTree: SomeEntityModel[] = [
	{
		type: EntityModelType.Action,
		id: '01',
		definitionId: 'def01',
		connectionId: 'conn01',
		options: { a: { isExpression: false, value: 1 } },
		upgradeIndex: undefined,
	},
	{
		type: EntityModelType.Action,
		id: '02',
		definitionId: 'def02',
		connectionId: 'conn02',
		options: { a: { isExpression: false, value: 2 } },
		upgradeIndex: undefined,
	},
	{
		type: EntityModelType.Action,
		id: 'int0',
		definitionId: 'action-with-children',
		connectionId: 'internal',
		options: { a: { isExpression: false, value: 3 } },
		upgradeIndex: undefined,
		children: {
			group1: [
				{
					type: EntityModelType.Action,
					id: 'int1',
					definitionId: 'def01',
					connectionId: 'internal',
					options: { a: { isExpression: false, value: 4 } },
					upgradeIndex: undefined,
					children: {
						default: [
							{
								type: EntityModelType.Action,
								id: 'int1-b',
								definitionId: 'def05',
								connectionId: 'conn04',
								options: { a: { isExpression: false, value: 5 } },
								upgradeIndex: undefined,
							},
						],
					},
				},
			],
			group2: [
				{
					type: EntityModelType.Feedback,
					id: 'int2',
					definitionId: 'def01',
					connectionId: 'conn04',
					options: { a: { isExpression: false, value: 5 } },
					upgradeIndex: undefined,
					children: {
						default: [
							{
								type: EntityModelType.Feedback,
								id: 'int2-a',
								definitionId: 'def05',
								connectionId: 'conn05',
								options: { a: { isExpression: false, value: 6 } },
								upgradeIndex: undefined,
							},
						],
					},
				},
			],
		},
	},
]

export function ActionTreeEntityDefinitions(
	entityType: EntityModelType,
	connectionId: string,
	definitionId: string
): ClientEntityDefinition | undefined {
	if (entityType !== EntityModelType.Action) return undefined

	if (connectionId === 'internal' && definitionId === 'action-with-children') {
		return {
			entityType: EntityModelType.Action,
			supportsChildGroups: [
				{
					type: EntityModelType.Action,
					groupId: 'group1',
					entityTypeLabel: 'Action',
					label: 'Action',
				},
				{
					type: EntityModelType.Feedback,
					groupId: 'group2',
					entityTypeLabel: 'Feedback',
					label: 'Feedback',
				},
			],
		} as Partial<ClientEntityDefinition> as any
	}
	if (connectionId === 'internal' && definitionId === 'def01') {
		return {
			entityType: EntityModelType.Action,
			supportsChildGroups: [
				{
					type: EntityModelType.Action,
					groupId: 'default',
					entityTypeLabel: 'Action',
					label: 'Action',
				},
			],
		} as Partial<ClientEntityDefinition> as any
	}

	// Fallback to a valid action
	return {
		entityType: EntityModelType.Action,
	} as Partial<ClientEntityDefinition> as any
}

export const FeedbackTree: SomeEntityModel[] = [
	{
		type: EntityModelType.Feedback,
		id: '01',
		definitionId: 'def01',
		connectionId: 'conn01',
		options: { a: { isExpression: false, value: 1 } },
		upgradeIndex: undefined,
	},
	{
		type: EntityModelType.Feedback,
		id: '02',
		definitionId: 'def02',
		connectionId: 'conn02',
		options: { a: { isExpression: false, value: 2 } },
		upgradeIndex: undefined,
	},
	{
		type: EntityModelType.Feedback,
		id: 'int0',
		definitionId: 'feedback-with-children',
		connectionId: 'internal',
		options: { a: { isExpression: false, value: 3 } },
		upgradeIndex: undefined,
		children: {
			group1: [
				{
					type: EntityModelType.Feedback,
					id: 'int1',
					definitionId: 'def01',
					connectionId: 'internal',
					options: { a: { isExpression: false, value: 4 } },
					upgradeIndex: undefined,
					children: {
						default: [
							{
								type: EntityModelType.Feedback,
								id: 'int1-b',
								definitionId: 'def05',
								connectionId: 'conn04',
								options: { a: { isExpression: false, value: 5 } },
								upgradeIndex: undefined,
							},
						],
					},
				},
			],
			group2: [
				{
					type: EntityModelType.Action,
					id: 'int2',
					definitionId: 'def01',
					connectionId: 'conn04',
					options: { a: { isExpression: false, value: 5 } },
					upgradeIndex: undefined,
					children: {
						default: [
							{
								type: EntityModelType.Action,
								id: 'int2-a',
								definitionId: 'def05',
								connectionId: 'conn05',
								options: { a: { isExpression: false, value: 6 } },
								upgradeIndex: undefined,
							},
						],
					},
				},
			],
		},
	},
]

export function FeedbackTreeEntityDefinitions(
	entityType: EntityModelType,
	connectionId: string,
	definitionId: string
): ClientEntityDefinition | undefined {
	if (entityType !== EntityModelType.Feedback) return undefined

	if (connectionId === 'internal' && definitionId === 'feedback-with-children') {
		return {
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Advanced,
			supportsChildGroups: [
				{
					type: EntityModelType.Feedback,
					groupId: 'group1',
					entityTypeLabel: 'Feedback',
					label: 'Feedback',
				},
				{
					type: EntityModelType.Action,
					groupId: 'group2',
					entityTypeLabel: 'Action',
					label: 'Action',
				},
			],
		} as Partial<ClientEntityDefinition> as any
	}
	if (connectionId === 'internal' && definitionId === 'def01') {
		return {
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Boolean,
			supportsChildGroups: [
				{
					type: EntityModelType.Feedback,
					groupId: 'default',
					entityTypeLabel: 'Feedback',
					label: 'Feedback',
				},
			],
		} as Partial<ClientEntityDefinition> as any
	}

	// Fallback to a valid feedback
	return {
		entityType: EntityModelType.Feedback,
		feedbackType: FeedbackEntitySubType.Boolean,
	} as Partial<ClientEntityDefinition> as any
}
