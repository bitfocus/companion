import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ControlEntityList, ControlEntityListDefinition } from '../../../lib/Controls/Entities/EntityList.js'
import {
	ActionEntityModel,
	EntityModelType,
	EntityOwner,
	FeedbackEntityModel,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { cloneDeep } from 'lodash-es'
import { ActionTree, ActionTreeEntityDefinitions, getAllModelsInTree } from './EntityListModels.js'
import {
	InstanceDefinitionsForEntity,
	InternalControllerForEntity,
	ModuleHostForEntity,
} from '../../../lib/Controls/Entities/Types.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { ControlEntityInstance } from '../../../lib/Controls/Entities/EntityInstance.js'

describe('EntityList', () => {
	function createList(controlId: string, ownerId?: EntityOwner | null, listId?: ControlEntityListDefinition | null) {
		const getEntityDefinition = vi.fn<InstanceDefinitionsForEntity['getEntityDefinition']>()
		const connectionEntityUpdate = vi.fn<ModuleHostForEntity['connectionEntityUpdate']>(async () => false)
		const connectionEntityDelete = vi.fn<ModuleHostForEntity['connectionEntityDelete']>(async () => false)
		const internalEntityUpdate = vi.fn<InternalControllerForEntity['entityUpdate']>()
		const internalEntityDelete = vi.fn<InternalControllerForEntity['entityDelete']>()

		const instanceDefinitions: InstanceDefinitionsForEntity = {
			getEntityDefinition,
		}
		const moduleHost: ModuleHostForEntity = {
			connectionEntityUpdate,
			connectionEntityDelete,
			connectionEntityLearnOptions: null as any,
		}
		const internalController: InternalControllerForEntity = {
			entityUpdate: internalEntityUpdate,
			entityDelete: internalEntityDelete,
			entityUpgrade: null as any,
			executeLogicFeedback: null as any,
		}

		const list = new ControlEntityList(
			instanceDefinitions,
			internalController,
			moduleHost,
			controlId,
			ownerId ?? null,
			listId ?? {
				type: EntityModelType.Action,
			}
		)

		const newActionModel: ActionEntityModel = {
			type: EntityModelType.Action,
			id: 'my-new-action',
			connectionId: 'internal',
			definitionId: 'def01',
			options: {},
		}
		const newAction = new ControlEntityInstance(
			instanceDefinitions,
			internalController,
			moduleHost,
			controlId,
			newActionModel,
			false
		)

		// Clear any calls made by the above
		getEntityDefinition.mockClear()

		return {
			list,
			getEntityDefinition,
			connectionEntityUpdate,
			connectionEntityDelete,
			internalEntityUpdate,
			internalEntityDelete,
			instanceDefinitions,
			internalController,
			moduleHost,
			newActionModel,
			newAction,
		}
	}

	test('construction', () => {
		const { list } = createList('test01')

		expect(list.getAllEntities()).toHaveLength(0)
		expect(list.getDirectEntities()).toHaveLength(0)
	})

	test('buildFeedbackStyle - errors for wrong types', () => {
		const { list: actionList } = createList('test01', null, { type: EntityModelType.Action })
		expect(() => actionList.buildFeedbackStyle(null as any)).toThrowError('ControlEntityList is not style feedback')

		const { list: feedbackList } = createList('test01', null, {
			type: EntityModelType.Feedback,
			booleanFeedbacksOnly: false,
		})
		expect(() => feedbackList.buildFeedbackStyle(null as any)).not.toThrowError(
			'ControlEntityList is not style feedback'
		)

		const { list: booleanFeedbackList } = createList('test01', null, {
			type: EntityModelType.Feedback,
			booleanFeedbacksOnly: true,
		})
		expect(() => booleanFeedbackList.buildFeedbackStyle(null as any)).toThrowError(
			'ControlEntityList is not style feedback'
		)
	})

	test('getChildBooleanFeedbackValues - errors for wrong types', () => {
		const { list: actionList } = createList('test01', null, { type: EntityModelType.Action })
		expect(() => actionList.getChildBooleanFeedbackValues()).toThrowError('ControlEntityList is not boolean feedback')

		const { list: feedbackList } = createList('test01', null, {
			type: EntityModelType.Feedback,
			booleanFeedbacksOnly: false,
		})
		expect(() => feedbackList.getChildBooleanFeedbackValues()).toThrowError('ControlEntityList is not boolean feedback')

		const { list: booleanFeedbackList } = createList('test01', null, {
			type: EntityModelType.Feedback,
			booleanFeedbacksOnly: true,
		})
		expect(() => booleanFeedbackList.getChildBooleanFeedbackValues()).not.toThrowError(
			'ControlEntityList is not boolean feedback'
		)
	})

	test('getBooleanFeedbackValue - errors for wrong types', () => {
		const { list: actionList } = createList('test01', null, { type: EntityModelType.Action })
		expect(() => actionList.getBooleanFeedbackValue()).toThrowError('ControlEntityList is not boolean feedback')

		const { list: feedbackList } = createList('test01', null, {
			type: EntityModelType.Feedback,
			booleanFeedbacksOnly: false,
		})
		expect(() => feedbackList.getBooleanFeedbackValue()).toThrowError('ControlEntityList is not boolean feedback')

		const { list: booleanFeedbackList } = createList('test01', null, {
			type: EntityModelType.Feedback,
			booleanFeedbacksOnly: true,
		})
		expect(() => booleanFeedbackList.getBooleanFeedbackValue()).not.toThrowError(
			'ControlEntityList is not boolean feedback'
		)
	})

	describe('loadStorage', () => {
		test('actions tree missing definition', () => {
			const { list } = createList('test01')

			const inputModels = ActionTree

			list.loadStorage(cloneDeep(inputModels), true, false)

			const compiled = list.getDirectEntities().map((e) => e.asEntityModel())

			// Prune out the children which will have been discarded
			const expected = cloneDeep(inputModels)
			for (const entity of expected) {
				if (entity.connectionId === 'internal') {
					entity.children = {}
				}
			}
			expect(compiled).toEqual(expected)

			expect(list.getAllEntities()).toHaveLength(3)
			expect(list.getDirectEntities()).toHaveLength(3)
		})

		test('actions tree with definition', () => {
			const { list, getEntityDefinition } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			const inputModels = ActionTree

			list.loadStorage(cloneDeep(inputModels), true, false)

			const compiled = list.getDirectEntities().map((e) => e.asEntityModel())
			delete inputModels[2].children?.group2?.[0]?.children
			expect(compiled).toEqual(inputModels)

			expect(getEntityDefinition).toHaveBeenCalledTimes(2)
			expect(getEntityDefinition).toHaveBeenNthCalledWith(1, EntityModelType.Action, 'internal', 'action-with-children')
			expect(getEntityDefinition).toHaveBeenNthCalledWith(2, EntityModelType.Action, 'internal', 'def01')

			expect(list.getAllEntities()).toHaveLength(6)
			expect(list.getDirectEntities()).toHaveLength(3)
		})

		test('actions tree with definition and unknown child group', () => {
			const { list, getEntityDefinition } = createList('test01')

			getEntityDefinition.mockReturnValueOnce({
				entityType: EntityModelType.Action,
				supportsChildGroups: [
					{
						type: EntityModelType.Action,
						groupId: 'group1',
						entityTypeLabel: 'Action',
						label: 'Action',
					},
				],
			} as Partial<ClientEntityDefinition> as any)
			getEntityDefinition.mockReturnValueOnce({
				entityType: EntityModelType.Action,
				supportsChildGroups: [
					{
						type: EntityModelType.Action,
						groupId: 'default',
						entityTypeLabel: 'Action',
						label: 'Action',
					},
				],
			} as Partial<ClientEntityDefinition> as any)

			const inputModels = ActionTree

			list.loadStorage(cloneDeep(inputModels), true, false)

			const compiled = list.getDirectEntities().map((e) => e.asEntityModel())

			// Prune out the children which will have been discarded
			const expected = cloneDeep(inputModels)
			for (const entity of expected) {
				if (entity.connectionId === 'internal') {
					delete entity.children?.group2
				}
			}
			expect(compiled).toEqual(expected)

			expect(getEntityDefinition).toHaveBeenCalledTimes(2)
			expect(getEntityDefinition).toHaveBeenNthCalledWith(1, EntityModelType.Action, 'internal', 'action-with-children')
			expect(getEntityDefinition).toHaveBeenNthCalledWith(2, EntityModelType.Action, 'internal', 'def01')

			expect(list.getAllEntities()).toHaveLength(5)
			expect(list.getDirectEntities()).toHaveLength(3)
		})

		test('actions tree with children on non-internal', () => {
			const { list, getEntityDefinition } = createList('test01')

			const inputModels = cloneDeep(ActionTree)
			for (const entity of inputModels) {
				if (entity.connectionId === 'internal') {
					entity.connectionId = 'fake'
				}
			}

			list.loadStorage(cloneDeep(inputModels), true, false)

			const compiled = list.getDirectEntities().map((e) => e.asEntityModel())

			// Prune out the children which will have been discarded
			const expected = cloneDeep(inputModels)
			for (const entity of expected) {
				if (entity.connectionId === 'fake') {
					delete entity.children
				}
			}
			expect(compiled).toEqual(expected)

			expect(getEntityDefinition).toHaveBeenCalledTimes(0)

			expect(list.getAllEntities()).toHaveLength(3)
			expect(list.getDirectEntities()).toHaveLength(3)
		})

		test('ids when not cloned', () => {
			const { list, getEntityDefinition } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			const inputModels = ActionTree
			list.loadStorage(cloneDeep(inputModels), true, false)

			const inputIds = getAllModelsInTree(inputModels).map((e) => e.id)
			const compiledIds = list.getAllEntities().map((e) => e.id)
			expect(compiledIds).toEqual(inputIds)

			expect(getEntityDefinition).toHaveBeenCalledTimes(2)
		})

		test('ids when cloned', () => {
			const { list, getEntityDefinition } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			const inputModels = ActionTree
			list.loadStorage(cloneDeep(inputModels), true, true)

			const inputIds = getAllModelsInTree(inputModels).map((e) => e.id)
			const inputIdsSet = new Set(inputIds)
			expect(inputIdsSet.size).toBe(inputIds.length)

			const compiledIds = list.getAllEntities().map((e) => e.id)
			for (const id of compiledIds) {
				expect(inputIdsSet.has(id)).toBe(false)
			}

			expect(getEntityDefinition).toHaveBeenCalledTimes(2)
		})

		test('subscribe when enabled', () => {
			const { list, getEntityDefinition, connectionEntityUpdate, internalEntityUpdate } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			const inputModels = ActionTree
			list.loadStorage(cloneDeep(inputModels), false, false)

			expect(connectionEntityUpdate).toHaveBeenCalledTimes(4)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(2)
		})
	})

	test('cleanup entities', () => {
		const { list, getEntityDefinition, connectionEntityDelete, internalEntityDelete } = createList('test01')

		for (const def of ActionTreeEntityDefinitions) {
			getEntityDefinition.mockReturnValueOnce(def)
		}

		const inputModels = ActionTree

		list.loadStorage(cloneDeep(inputModels), true, false)

		list.cleanup()

		expect(connectionEntityDelete).toHaveBeenCalledTimes(4)
		expect(internalEntityDelete).toHaveBeenCalledTimes(2)

		expect(list.getAllEntities()).toHaveLength(0)
		expect(list.getDirectEntities()).toHaveLength(0)
	})

	describe('subscribe entities', () => {
		const { list, getEntityDefinition, connectionEntityUpdate, internalEntityUpdate } = createList('test01')

		for (const def of ActionTreeEntityDefinitions) {
			getEntityDefinition.mockReturnValueOnce(def)
		}

		list.loadStorage(cloneDeep(ActionTree), true, false)

		beforeEach(() => {
			connectionEntityUpdate.mockClear()
			internalEntityUpdate.mockClear()
		})

		afterEach(() => {
			expect(list.getAllEntities()).toHaveLength(6)
			expect(list.getDirectEntities()).toHaveLength(3)
		})

		test('non recursive', () => {
			list.subscribe(false)

			expect(connectionEntityUpdate).toHaveBeenCalledTimes(2)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(1)
		})

		test('recursive', () => {
			list.subscribe(true)

			expect(connectionEntityUpdate).toHaveBeenCalledTimes(4)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(2)
		})

		test('only actions', () => {
			list.subscribe(true, EntityModelType.Action)

			expect(connectionEntityUpdate).toHaveBeenCalledTimes(3)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(2)
		})

		test('only feedbacks', () => {
			list.subscribe(true, EntityModelType.Feedback)

			expect(connectionEntityUpdate).toHaveBeenCalledTimes(1)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(0)
		})

		test('only internal', () => {
			list.subscribe(true, undefined, 'internal')

			expect(connectionEntityUpdate).toHaveBeenCalledTimes(0)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(2)
		})

		test('only conn01', () => {
			list.subscribe(true, undefined, 'conn01')

			expect(connectionEntityUpdate).toHaveBeenCalledTimes(1)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(0)
		})

		test('only missing-connection', () => {
			list.subscribe(true, undefined, 'missing-connection')

			expect(connectionEntityUpdate).toHaveBeenCalledTimes(0)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(0)
		})
	})

	describe('findById', () => {
		const { list, getEntityDefinition, connectionEntityUpdate, internalEntityUpdate } = createList('test01')

		for (const def of ActionTreeEntityDefinitions) {
			getEntityDefinition.mockReturnValueOnce(def)
		}

		list.loadStorage(cloneDeep(ActionTree), true, false)

		test('find missing id', () => {
			const entity = list.findById('missing-id')
			expect(entity).toBeUndefined()
		})

		test('find at root level', () => {
			const entity = list.findById('01')
			expect(entity).not.toBeUndefined()
			expect(entity?.id).toBe('01')
		})

		test('find deep - int1-b', () => {
			const entity = list.findById('int1-b')
			expect(entity).not.toBeUndefined()
			expect(entity?.id).toBe('int1-b')
		})
	})

	describe('findParentAndIndex', () => {
		const { list, getEntityDefinition } = createList('test01')

		for (const def of ActionTreeEntityDefinitions) {
			getEntityDefinition.mockReturnValueOnce(def)
		}

		list.loadStorage(cloneDeep(ActionTree), true, false)

		test('find missing id', () => {
			const entity = list.findParentAndIndex('missing-id')
			expect(entity).toBeUndefined()
		})

		test('find at root level', () => {
			const info = list.findParentAndIndex('02')
			expect(info).not.toBeUndefined()
			const { parent, index, item } = info!
			expect(item.id).toBe('02')
			expect(index).toBe(1)
			expect(parent.ownerId).toBe(null)
		})

		test('find deep - int1-b', () => {
			const info = list.findParentAndIndex('int1-b')
			expect(info).not.toBeUndefined()
			const { parent, index, item } = info!
			expect(item.id).toBe('int1-b')
			expect(index).toBe(0)
			expect(parent.ownerId).toEqual({
				childGroup: 'default',
				parentId: 'int1',
			} satisfies EntityOwner)
		})
	})

	describe('addEntity', () => {
		function expectEntityToMatchModel(entity: SomeEntityModel, instance: ControlEntityInstance) {
			expect(instance).not.toBeUndefined()
			expect(instance.id).toBe(entity.id)
			expect(instance.connectionId).toBe(entity.connectionId)
			expect(instance.definitionId).toBe(entity.definitionId)
			expect(instance.rawOptions).toEqual(entity.options)
			expect(instance.asEntityModel()).toEqual(entity)
		}

		test('add action to action list', () => {
			const { list } = createList('test01', null, { type: EntityModelType.Action })

			const newAction: ActionEntityModel = {
				id: 'new01',
				type: EntityModelType.Action,
				connectionId: 'my-conn99',
				definitionId: 'something',
				options: {
					test: 123,
				},
			}

			const newInstance = list.addEntity(cloneDeep(newAction))
			expect(newInstance).not.toBeUndefined()
			expectEntityToMatchModel(newAction, newInstance)
		})

		test('add action to feedback list', () => {
			const { list } = createList('test01', null, { type: EntityModelType.Feedback })

			const newAction: ActionEntityModel = {
				id: 'new01',
				type: EntityModelType.Action,
				connectionId: 'my-conn99',
				definitionId: 'something',
				options: {
					test: 123,
				},
			}

			expect(() => list.addEntity(cloneDeep(newAction))).toThrowError('EntityList cannot accept this type of entity')
			expect(list.getAllEntities()).toHaveLength(0)
		})

		test('add feedback to action list', () => {
			const { list } = createList('test01', null, { type: EntityModelType.Action })

			const newFeedback: FeedbackEntityModel = {
				id: 'new01',
				type: EntityModelType.Feedback,
				connectionId: 'my-conn99',
				definitionId: 'something',
				options: {
					test: 123,
				},
			}

			expect(() => list.addEntity(cloneDeep(newFeedback))).toThrowError('EntityList cannot accept this type of entity')
			expect(list.getAllEntities()).toHaveLength(0)
		})

		test('add feedback to feedback list', () => {
			const { list } = createList('test01', null, { type: EntityModelType.Feedback })

			const newFeedback: FeedbackEntityModel = {
				id: 'new01',
				type: EntityModelType.Feedback,
				connectionId: 'my-conn99',
				definitionId: 'something',
				options: {
					test: 123,
				},
			}

			const newInstance = list.addEntity(cloneDeep(newFeedback))
			expect(newInstance).not.toBeUndefined()
			expectEntityToMatchModel(newFeedback, newInstance)
		})

		test('add unknown feedback to boolean feedback list', () => {
			const { list } = createList('test01', null, { type: EntityModelType.Feedback, booleanFeedbacksOnly: true })

			const newFeedback: FeedbackEntityModel = {
				id: 'new01',
				type: EntityModelType.Feedback,
				connectionId: 'my-conn99',
				definitionId: 'something',
				options: {
					test: 123,
				},
			}

			expect(() => list.addEntity(cloneDeep(newFeedback))).toThrowError('EntityList cannot accept this type of entity')
			expect(list.getAllEntities()).toHaveLength(0)
		})

		test('add advanced feedback to boolean feedback list', () => {
			const { list, getEntityDefinition } = createList('test01', null, {
				type: EntityModelType.Feedback,
				booleanFeedbacksOnly: true,
			})

			getEntityDefinition.mockReturnValueOnce({
				entityType: EntityModelType.Feedback,
				feedbackType: 'advanced',
			} as Partial<ClientEntityDefinition> as any)

			const newFeedback: FeedbackEntityModel = {
				id: 'new01',
				type: EntityModelType.Feedback,
				connectionId: 'my-conn99',
				definitionId: 'something',
				options: {
					test: 123,
				},
			}

			expect(() => list.addEntity(cloneDeep(newFeedback))).toThrowError('EntityList cannot accept this type of entity')
			expect(list.getAllEntities()).toHaveLength(0)

			expect(getEntityDefinition).toHaveBeenCalledTimes(1)
			expect(getEntityDefinition).toHaveBeenCalledWith(EntityModelType.Feedback, 'my-conn99', 'something')
		})

		test('add boolean feedback to boolean feedback list', () => {
			const { list, getEntityDefinition } = createList('test01', null, {
				type: EntityModelType.Feedback,
				booleanFeedbacksOnly: true,
			})

			const newFeedback: FeedbackEntityModel = {
				id: 'new01',
				type: EntityModelType.Feedback,
				connectionId: 'my-conn99',
				definitionId: 'something',
				options: {
					test: 123,
				},
			}

			getEntityDefinition.mockReturnValueOnce({
				entityType: EntityModelType.Feedback,
				feedbackType: 'boolean',
			} as Partial<ClientEntityDefinition> as any)

			const newInstance = list.addEntity(cloneDeep(newFeedback))
			expect(newInstance).not.toBeUndefined()
			expectEntityToMatchModel(newFeedback, newInstance)

			expect(getEntityDefinition).toHaveBeenCalledTimes(1)
			expect(getEntityDefinition).toHaveBeenCalledWith(EntityModelType.Feedback, 'my-conn99', 'something')
		})

		test('non-internal with children', () => {
			const { list } = createList('test01', null, {
				type: EntityModelType.Feedback,
			})

			const newFeedback: FeedbackEntityModel = {
				id: 'new01',
				type: EntityModelType.Feedback,
				connectionId: 'my-conn99',
				definitionId: 'something',
				options: {
					test: 123,
				},
				children: {
					group1: [
						{
							id: 'child01',
							type: EntityModelType.Feedback,
							connectionId: 'my-conn99',
							definitionId: 'something',
							options: {
								test: 123,
							},
						},
					],
				},
			}

			const newInstance = list.addEntity(cloneDeep(newFeedback))
			expect(newInstance).not.toBeUndefined()

			// Prune out the children which will have been discarded
			delete newFeedback.children
			expectEntityToMatchModel(newFeedback, newInstance)

			expect(list.getAllEntities()).toHaveLength(1)
		})

		test('internal with children', () => {
			const { list, getEntityDefinition, connectionEntityUpdate, internalEntityUpdate } = createList('test01', null, {
				type: EntityModelType.Feedback,
			})

			getEntityDefinition.mockReturnValueOnce({
				entityType: EntityModelType.Feedback,
				supportsChildGroups: [
					{
						type: EntityModelType.Feedback,
						groupId: 'group1',
						entityTypeLabel: 'Feedback',
						label: 'Feedback',
					},
				],
			} satisfies Partial<ClientEntityDefinition> as any)

			const newFeedback: FeedbackEntityModel = {
				id: 'new01',
				type: EntityModelType.Feedback,
				connectionId: 'internal',
				definitionId: 'something',
				options: {
					test: 123,
				},
				children: {
					group1: [
						{
							id: 'child01',
							type: EntityModelType.Feedback,
							connectionId: 'my-conn99',
							definitionId: 'thing',
							options: {
								test: 99,
							},
						},
					],
					group2: [
						{
							id: 'child02',
							type: EntityModelType.Feedback,
							connectionId: 'my-conn99',
							definitionId: 'another',
							options: {
								test: 45,
							},
						},
					],
				},
			}

			const newInstance = list.addEntity(cloneDeep(newFeedback))
			expect(newInstance).not.toBeUndefined()

			// Prune out the children which will have been discarded
			delete newFeedback.children!.group2
			expectEntityToMatchModel(newFeedback, newInstance)

			const allInstances = list.getAllEntities()
			expect(allInstances).toHaveLength(2)
			expectEntityToMatchModel(newFeedback, allInstances[0])
			expectEntityToMatchModel(newFeedback.children!['group1']![0], allInstances[1])

			// ensure not cloned
			expect(connectionEntityUpdate).toHaveBeenCalledTimes(0)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(0)
		})

		test('add cloned', () => {
			const { list } = createList('test01', null, { type: EntityModelType.Feedback })

			const newFeedback: FeedbackEntityModel = {
				id: 'new01',
				type: EntityModelType.Feedback,
				connectionId: 'my-conn99',
				definitionId: 'something',
				options: {
					test: 123,
				},
			}

			const newInstance = list.addEntity(cloneDeep(newFeedback), true)
			expect(newInstance).not.toBeUndefined()
			expect(newInstance.id).not.toBe(newFeedback.id)

			// Update the expected id
			newFeedback.id = newInstance.id
			expectEntityToMatchModel(newFeedback, newInstance)
		})

		test('clone with children', () => {
			const { list, getEntityDefinition } = createList('test01', null, {
				type: EntityModelType.Feedback,
			})

			getEntityDefinition.mockReturnValueOnce({
				entityType: EntityModelType.Feedback,
				supportsChildGroups: [
					{
						type: EntityModelType.Feedback,
						groupId: 'group1',
						entityTypeLabel: 'Feedback',
						label: 'Feedback',
					},
				],
			} satisfies Partial<ClientEntityDefinition> as any)

			const newFeedback: FeedbackEntityModel = {
				id: 'new01',
				type: EntityModelType.Feedback,
				connectionId: 'internal',
				definitionId: 'something',
				options: {
					test: 123,
				},
				children: {
					group1: [
						{
							id: 'child01',
							type: EntityModelType.Feedback,
							connectionId: 'my-conn99',
							definitionId: 'thing',
							options: {
								test: 99,
							},
						},
					],
				},
			}

			const newInstance = list.addEntity(cloneDeep(newFeedback), true)
			expect(newInstance).not.toBeUndefined()

			expect(newInstance.id).not.toBe(newFeedback.id)
			newFeedback.id = newInstance.id
			expect(newInstance.getAllChildren()[0].id).not.toBe(newFeedback.children!['group1']![0].id)
			newFeedback.children!['group1']![0].id = newInstance.getAllChildren()[0].id
			expectEntityToMatchModel(newFeedback, newInstance)
		})
	})

	describe('removeEntity', () => {
		test('remove from root', () => {
			const { list, getEntityDefinition, internalEntityDelete, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)
			expect(list.findById('02')).not.toBeUndefined()

			// Remove from root
			list.removeEntity('02')

			// Check was removed
			expect(list.getAllEntities()).toHaveLength(5)
			expect(list.findById('02')).toBeUndefined()
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(1)
			expect(connectionEntityDelete).toHaveBeenCalledWith(ActionTree[1], 'test01')
		})

		test('remove from root with children', () => {
			const { list, getEntityDefinition, internalEntityDelete, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)
			expect(list.findById('int0')).not.toBeUndefined()

			// Remove from root
			list.removeEntity('int0')

			// Check was removed
			expect(list.getAllEntities()).toHaveLength(2)
			expect(list.findById('int0')).toBeUndefined()
			expect(internalEntityDelete).toHaveBeenCalledTimes(2)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(2)
		})

		test('remove deep', () => {
			const { list, getEntityDefinition, internalEntityDelete, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)
			expect(list.findById('int1-b')).not.toBeUndefined()

			// Remove from root
			list.removeEntity('int1-b')

			// Check was removed
			expect(list.getAllEntities()).toHaveLength(5)
			expect(list.findById('int1-b')).toBeUndefined()
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(1)
		})
	})

	describe('popEntity', () => {
		test('pop empty', () => {
			const { list } = createList('test01')

			const entity = list.popEntity(0)
			expect(entity).toBeUndefined()
		})

		test('pop first', () => {
			const { list, getEntityDefinition, internalEntityDelete, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			const allEntitiesBefore = list.getAllEntities()
			const beforeIds = allEntitiesBefore.map((e) => e.id)

			// Starts with correct length
			expect(allEntitiesBefore).toHaveLength(6)

			// Remove from root
			const popped = list.popEntity(0)
			expect(popped).not.toBeUndefined()
			expect(popped).toBe(allEntitiesBefore[0])

			// Check no lifecycle
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			// Check ids after remove
			const afterIds = list.getAllEntities().map((e) => e.id)
			beforeIds.splice(0, 1)
			expect(afterIds).toEqual(beforeIds)
		})

		test('pop negative', () => {
			const { list, getEntityDefinition, internalEntityDelete, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			// Remove from root
			expect(list.popEntity(-1)).toBeUndefined()

			// Check no lifecycle
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			// Check ids after remove
			expect(list.getAllEntities()).toHaveLength(6)
		})

		test('after end', () => {
			const { list, getEntityDefinition, internalEntityDelete, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			// Remove from root
			expect(list.popEntity(4)).toBeUndefined()

			// Check no lifecycle
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			// Check ids after remove
			expect(list.getAllEntities()).toHaveLength(6)
		})

		test('with children', () => {
			const { list, getEntityDefinition, internalEntityDelete, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			const allEntitiesBefore = list.getAllEntities()
			const beforeIds = allEntitiesBefore.map((e) => e.id)

			// Starts with correct length
			expect(allEntitiesBefore).toHaveLength(6)

			// Remove from root
			const popped = list.popEntity(2)
			expect(popped).not.toBeUndefined()
			expect(popped).toBe(allEntitiesBefore[2])

			// Check no lifecycle
			expect(internalEntityDelete).toHaveBeenCalledTimes(0)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)

			// Check ids after remove
			const afterIds = list.getAllEntities().map((e) => e.id)
			beforeIds.splice(2, 4)
			expect(afterIds).toEqual(beforeIds)
		})
	})

	describe('popEntity', () => {
		test('push to empty', () => {
			const { list, newAction, internalEntityUpdate, connectionEntityUpdate } = createList('test01')

			expect(list.getAllEntities()).toHaveLength(0)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(0)
			expect(connectionEntityUpdate).toHaveBeenCalledTimes(0)

			list.pushEntity(newAction, 5)

			expect(list.getAllEntities()).toHaveLength(1)
			expect(list.getAllEntities()[0]).toBe(newAction)
			expect(internalEntityUpdate).toHaveBeenCalledTimes(0)
			expect(connectionEntityUpdate).toHaveBeenCalledTimes(0)
		})

		test('push front', () => {
			const { list, newAction } = createList('test01')

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(3)

			list.pushEntity(newAction, 0)

			// Check ids after push
			const afterIds = list.getAllEntities().map((e) => e.id)
			expect(afterIds).toHaveLength(4)
			expect(afterIds[0]).toBe(newAction.id)
		})

		test('push front - negative', () => {
			const { list, newAction } = createList('test01')

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(3)

			list.pushEntity(newAction, -1)

			// Check ids after push
			const afterIds = list.getAllEntities().map((e) => e.id)
			expect(afterIds).toHaveLength(4)
			expect(afterIds[0]).toBe(newAction.id)
		})

		test('push front - beyond end', () => {
			const { list, newAction } = createList('test01')

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(3)

			list.pushEntity(newAction, 5)

			// Check ids after push
			const afterIds = list.getAllEntities().map((e) => e.id)
			expect(afterIds).toHaveLength(4)
			expect(afterIds[3]).toBe(newAction.id)
		})

		test('push front - middle', () => {
			const { list, newAction } = createList('test01')

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(3)

			list.pushEntity(newAction, 1)

			// Check ids after push
			const afterIds = list.getAllEntities().map((e) => e.id)
			expect(afterIds).toHaveLength(4)
			expect(afterIds[1]).toBe(newAction.id)
		})
	})

	// canAcceptEntity is tested as part of addEntity

	// TODO - duplicateEntity

	describe('forgetForConnection', () => {
		test('cleanup nothing', () => {
			const { list, getEntityDefinition } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			expect(list.forgetForConnection('missing-connection')).toBe(false)

			// Check ids after cleanup
			expect(list.getAllEntities()).toHaveLength(6)
		})

		test('remove from root', () => {
			const { list, getEntityDefinition, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			expect(list.forgetForConnection('conn02')).toBe(true)

			// Check ids after cleanup
			expect(list.getAllEntities()).toHaveLength(5)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(1)
		})

		test('remove deep', () => {
			const { list, getEntityDefinition, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			expect(list.forgetForConnection('conn04')).toBe(true)

			// Check ids after cleanup
			expect(list.getAllEntities()).toHaveLength(4)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(2)
		})
	})

	describe('verifyConnectionIds', () => {
		test('cleanup nothing', () => {
			const { list, getEntityDefinition } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			const allConnectionIds = new Set(list.getAllEntities().map((e) => e.connectionId))
			list.verifyConnectionIds(allConnectionIds)

			// Check ids after cleanup
			expect(list.getAllEntities()).toHaveLength(6)
		})

		test('remove from root', () => {
			const { list, getEntityDefinition, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			const allConnectionIds = new Set(list.getAllEntities().map((e) => e.connectionId))
			allConnectionIds.delete('conn02')
			list.verifyConnectionIds(allConnectionIds)

			// Check ids after cleanup
			expect(list.getAllEntities()).toHaveLength(5)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)
		})

		test('remove deep', () => {
			const { list, getEntityDefinition, connectionEntityDelete } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			const allConnectionIds = new Set(list.getAllEntities().map((e) => e.connectionId))
			allConnectionIds.delete('conn04')
			list.verifyConnectionIds(allConnectionIds)

			// Check ids after cleanup
			expect(list.getAllEntities()).toHaveLength(4)
			expect(connectionEntityDelete).toHaveBeenCalledTimes(0)
		})
	})

	// TODO - postProcessImport

	// TODO - clearCachedValueForConnectionId

	// TODO - getBooleanFeedbackValue

	// TODO - getChildBooleanFeedbackValues

	// TODO - buildFeedbackStyle

	// TODO - updateFeedbackValues

	describe('getAllEnabledConnectionIds', () => {
		test('default', () => {
			const { list, getEntityDefinition } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			list.loadStorage(cloneDeep(ActionTree), true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			const allConnectionIds = new Set(list.getAllEntities().map((e) => e.connectionId))

			const connectionIds = new Set<string>()
			list.getAllEnabledConnectionIds(connectionIds)
			expect(connectionIds).toHaveLength(allConnectionIds.size)
		})

		test('all disabled', () => {
			const { list, getEntityDefinition } = createList('test01')

			for (const def of ActionTreeEntityDefinitions) {
				getEntityDefinition.mockReturnValueOnce(def)
			}

			const actions = cloneDeep(ActionTree)
			for (const entity of actions) {
				entity.disabled = true
			}

			list.loadStorage(actions, true, false)

			// Starts with correct length
			expect(list.getAllEntities()).toHaveLength(6)

			// const allConnectionIds = new Set(list.getAllEntities().map((e) => e.connectionId))
			const connectionIds = new Set<string>()
			list.getAllEnabledConnectionIds(connectionIds)
			expect(connectionIds).toHaveLength(0)
		})
	})
})
