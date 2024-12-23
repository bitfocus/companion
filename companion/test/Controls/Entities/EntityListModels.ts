import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { SomeEntityModel, EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

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
		options: { a: 1 },
	},
	{
		type: EntityModelType.Action,
		id: '02',
		definitionId: 'def02',
		connectionId: 'conn02',
		options: { a: 2 },
	},
	{
		type: EntityModelType.Action,
		id: 'int0',
		definitionId: 'action-with-children',
		connectionId: 'internal',
		options: { a: 3 },
		children: {
			group1: [
				{
					type: EntityModelType.Action,
					id: 'int1',
					definitionId: 'def01',
					connectionId: 'internal',
					options: { a: 4 },
					children: {
						default: [
							{
								type: EntityModelType.Action,
								id: 'int1-b',
								definitionId: 'def05',
								connectionId: 'conn04',
								options: { a: 5 },
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
					options: { a: 5 },
					children: {
						default: [
							{
								type: EntityModelType.Feedback,
								id: 'int2-a',
								definitionId: 'def05',
								connectionId: 'conn05',
								options: { a: 6 },
							},
						],
					},
				},
			],
		},
	},
]

export const ActionTreeEntityDefinitions: ClientEntityDefinition[] = [
	{
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
	} as Partial<ClientEntityDefinition> as any,
	{
		entityType: EntityModelType.Action,
		supportsChildGroups: [
			{
				type: EntityModelType.Action,
				groupId: 'default',
				entityTypeLabel: 'Action',
				label: 'Action',
			},
		],
	} as Partial<ClientEntityDefinition> as any,
]
