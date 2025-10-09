import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ControlEntityList, ControlEntityListDefinition } from '../../../lib/Controls/Entities/EntityList.js'
import {
	ActionEntityModel,
	EntityModelType,
	EntityOwner,
	FeedbackEntityModel,
	FeedbackEntitySubType,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import { cloneDeep } from 'lodash-es'
import {
	ActionTree,
	ActionTreeEntityDefinitions,
	FeedbackTree,
	FeedbackTreeEntityDefinitions,
	getAllModelsInTree,
} from './EntityListModels.js'
import {
	InstanceDefinitionsForEntity,
	InternalControllerForEntity,
	ProcessManagerForEntity,
} from '../../../lib/Controls/Entities/Types.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { ControlEntityInstance } from '../../../lib/Controls/Entities/EntityInstance.js'
import { FeedbackStyleBuilder } from '../../../lib/Controls/Entities/FeedbackStyleBuilder.js'
import { mock } from 'vitest-mock-extended'

function createList(controlId: string, ownerId?: EntityOwner | null, listId?: ControlEntityListDefinition | null) {
	const getEntityDefinition = vi.fn<InstanceDefinitionsForEntity['getEntityDefinition']>()
	const connectionEntityUpdate = vi.fn<ProcessManagerForEntity['connectionEntityUpdate']>(async () => false)
	const connectionEntityDelete = vi.fn<ProcessManagerForEntity['connectionEntityDelete']>(async () => false)
	const internalEntityUpdate = vi.fn<InternalControllerForEntity['entityUpdate']>()
	const internalEntityUpgrade = vi.fn<InternalControllerForEntity['entityUpgrade']>()
	const internalEntityDelete = vi.fn<InternalControllerForEntity['entityDelete']>()

	const instanceDefinitions: InstanceDefinitionsForEntity = {
		getEntityDefinition,
	}
	const processManager: ProcessManagerForEntity = {
		connectionEntityUpdate,
		connectionEntityDelete,
		connectionEntityLearnOptions: null as any,
	}
	const internalController: InternalControllerForEntity = {
		entityUpdate: internalEntityUpdate,
		entityDelete: internalEntityDelete,
		entityUpgrade: internalEntityUpgrade,
		executeLogicFeedback: null as any,
	}

	const list = new ControlEntityList(
		instanceDefinitions,
		internalController,
		processManager,
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
		upgradeIndex: undefined,
	}
	const newAction = new ControlEntityInstance(
		instanceDefinitions,
		internalController,
		processManager,
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
		internalEntityUpgrade,
		internalEntityDelete,
		instanceDefinitions,
		internalController,
		processManager,
		newActionModel,
		newAction,
	}
}

test('construction', () => {
	const { list } = createList('test01')

	expect(list.getAllEntities()).toHaveLength(0)
	expect(list.getDirectEntities()).toHaveLength(0)
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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

		const inputModels = ActionTree
		list.loadStorage(cloneDeep(inputModels), true, false)

		const inputIds = getAllModelsInTree(inputModels).map((e) => e.id)
		const compiledIds = list.getAllEntities().map((e) => e.id)
		expect(compiledIds).toEqual(inputIds)

		expect(getEntityDefinition).toHaveBeenCalledTimes(2)
	})

	test('ids when cloned', () => {
		const { list, getEntityDefinition } = createList('test01')

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

		const inputModels = ActionTree
		list.loadStorage(cloneDeep(inputModels), false, false)

		expect(connectionEntityUpdate).toHaveBeenCalledTimes(4)
		expect(internalEntityUpdate).toHaveBeenCalledTimes(2)
	})
})

test('cleanup entities', () => {
	const { list, getEntityDefinition, connectionEntityDelete, internalEntityDelete } = createList('test01')

	getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

	const inputModels = ActionTree

	list.loadStorage(cloneDeep(inputModels), true, false)

	list.cleanup()

	expect(connectionEntityDelete).toHaveBeenCalledTimes(4)
	expect(internalEntityDelete).toHaveBeenCalledTimes(2)

	// Entities should remain
	expect(list.getAllEntities()).toHaveLength(6)
	expect(list.getDirectEntities()).toHaveLength(3)
})

describe('subscribe entities', () => {
	const { list, getEntityDefinition, connectionEntityUpdate, internalEntityUpdate } = createList('test01')

	getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

	getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

	getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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
			upgradeIndex: undefined,
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
			upgradeIndex: undefined,
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
			upgradeIndex: undefined,
		}

		expect(() => list.addEntity(cloneDeep(newFeedback))).toThrowError('EntityList cannot accept this type of entity')
		expect(list.getAllEntities()).toHaveLength(0)
	})

	test('add feedback to feedback list', () => {
		const { list, getEntityDefinition } = createList('test01', null, { type: EntityModelType.Feedback })

		getEntityDefinition.mockReturnValueOnce({
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Boolean,
		} as Partial<ClientEntityDefinition> as any)

		const newFeedback: FeedbackEntityModel = {
			id: 'new01',
			type: EntityModelType.Feedback,
			connectionId: 'my-conn99',
			definitionId: 'something',
			options: {
				test: 123,
			},
			upgradeIndex: undefined,
		}

		const newInstance = list.addEntity(cloneDeep(newFeedback))
		expect(newInstance).not.toBeUndefined()
		expectEntityToMatchModel(newFeedback, newInstance)
	})

	test('add unknown feedback to boolean feedback list', () => {
		const { list } = createList('test01', null, {
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Boolean,
		})

		const newFeedback: FeedbackEntityModel = {
			id: 'new01',
			type: EntityModelType.Feedback,
			connectionId: 'my-conn99',
			definitionId: 'something',
			options: {
				test: 123,
			},
			upgradeIndex: undefined,
		}

		expect(() => list.addEntity(cloneDeep(newFeedback))).toThrowError('EntityList cannot accept this type of entity')
		expect(list.getAllEntities()).toHaveLength(0)
	})

	test('add advanced feedback to boolean feedback list', () => {
		const { list, getEntityDefinition } = createList('test01', null, {
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Boolean,
		})

		getEntityDefinition.mockReturnValueOnce({
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Advanced,
		} as Partial<ClientEntityDefinition> as any)

		const newFeedback: FeedbackEntityModel = {
			id: 'new01',
			type: EntityModelType.Feedback,
			connectionId: 'my-conn99',
			definitionId: 'something',
			options: {
				test: 123,
			},
			upgradeIndex: undefined,
		}

		expect(() => list.addEntity(cloneDeep(newFeedback))).toThrowError('EntityList cannot accept this type of entity')
		expect(list.getAllEntities()).toHaveLength(0)

		expect(getEntityDefinition).toHaveBeenCalledTimes(1)
		expect(getEntityDefinition).toHaveBeenCalledWith(EntityModelType.Feedback, 'my-conn99', 'something')
	})

	test('add boolean feedback to boolean feedback list', () => {
		const { list, getEntityDefinition } = createList('test01', null, {
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Boolean,
		})

		const newFeedback: FeedbackEntityModel = {
			id: 'new01',
			type: EntityModelType.Feedback,
			connectionId: 'my-conn99',
			definitionId: 'something',
			options: {
				test: 123,
			},
			upgradeIndex: undefined,
		}

		getEntityDefinition.mockReturnValueOnce({
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Boolean,
		} as Partial<ClientEntityDefinition> as any)

		const newInstance = list.addEntity(cloneDeep(newFeedback))
		expect(newInstance).not.toBeUndefined()
		expectEntityToMatchModel(newFeedback, newInstance)

		expect(getEntityDefinition).toHaveBeenCalledTimes(1)
		expect(getEntityDefinition).toHaveBeenCalledWith(EntityModelType.Feedback, 'my-conn99', 'something')
	})

	test('non-internal with children', () => {
		const { list, getEntityDefinition } = createList('test01', null, {
			type: EntityModelType.Feedback,
		})

		getEntityDefinition.mockReturnValue({
			entityType: EntityModelType.Feedback,
			feedbackType: FeedbackEntitySubType.Boolean,
		} as Partial<ClientEntityDefinition> as any)

		const newFeedback: FeedbackEntityModel = {
			id: 'new01',
			type: EntityModelType.Feedback,
			connectionId: 'my-conn99',
			definitionId: 'something',
			options: {
				test: 123,
			},
			upgradeIndex: undefined,
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
						upgradeIndex: undefined,
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

		getEntityDefinition.mockReturnValue({
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
			upgradeIndex: undefined,
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
						upgradeIndex: undefined,
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
						upgradeIndex: undefined,
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
		const { list, getEntityDefinition } = createList('test01', null, { type: EntityModelType.Feedback })

		getEntityDefinition.mockReturnValue({
			entityType: EntityModelType.Feedback,
		} satisfies Partial<ClientEntityDefinition> as any)

		const newFeedback: FeedbackEntityModel = {
			id: 'new01',
			type: EntityModelType.Feedback,
			connectionId: 'my-conn99',
			definitionId: 'something',
			options: {
				test: 123,
			},
			upgradeIndex: undefined,
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

		getEntityDefinition.mockReturnValue({
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
			upgradeIndex: undefined,
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
						upgradeIndex: undefined,
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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

describe('pushEntity', () => {
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

describe('duplicateEntity', () => {
	test('duplicate missing', () => {
		const { list, connectionEntityUpdate, internalEntityUpdate } = createList('test01')

		list.loadStorage(cloneDeep(ActionTree), true, false)

		// Starts with correct length
		expect(list.getAllEntities()).toHaveLength(3)

		const newEntity = list.duplicateEntity('not-real')
		expect(newEntity).toBeUndefined()

		// Check ids after push
		expect(list.getAllEntities()).toHaveLength(3)

		// No callbacks
		expect(connectionEntityUpdate).toHaveBeenCalledTimes(0)
		expect(internalEntityUpdate).toHaveBeenCalledTimes(0)
	})

	test('duplicate at root ', () => {
		const { list, connectionEntityUpdate, internalEntityUpdate } = createList('test01')

		list.loadStorage(cloneDeep(ActionTree), true, false)

		// Starts with correct length
		expect(list.getAllEntities()).toHaveLength(3)

		const newEntity = list.duplicateEntity('02')
		expect(newEntity).not.toBeUndefined()

		// Check ids after push
		const afterIds = list.getAllEntities().map((e) => e.id)
		expect(afterIds).toHaveLength(4)
		expect(afterIds[1]).toBe('02')
		expect(afterIds[2]).toBe(newEntity!.id)

		expect(connectionEntityUpdate).toHaveBeenCalledTimes(1)
		expect(connectionEntityUpdate).toHaveBeenCalledWith(newEntity, 'test01')
		expect(internalEntityUpdate).toHaveBeenCalledTimes(0)
	})

	test('duplicate deep', () => {
		const { list, getEntityDefinition, connectionEntityUpdate, internalEntityUpdate } = createList('test01')

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

		list.loadStorage(cloneDeep(ActionTree), true, false)

		// Starts with correct length
		expect(list.getAllEntities()).toHaveLength(6)

		const newEntity = list.duplicateEntity('int1')
		expect(newEntity).not.toBeUndefined()

		// Check ids after push
		const afterIds = list.getAllEntities().map((e) => e.id)
		expect(afterIds).toHaveLength(8)
		expect(afterIds[3]).toBe('int1')
		expect(afterIds[5]).toBe(newEntity!.id)

		const newEntityChild = newEntity?.getAllChildren()[0]
		expect(newEntityChild).toBeTruthy()
		expect(afterIds[6]).toBe(newEntityChild!.id)

		expect(connectionEntityUpdate).toHaveBeenCalledTimes(1)
		expect(connectionEntityUpdate).toHaveBeenCalledWith(newEntityChild, 'test01')
		expect(internalEntityUpdate).toHaveBeenCalledTimes(1)
		expect(internalEntityUpdate).toHaveBeenCalledWith(newEntity!.asEntityModel(), 'test01')
	})
})

describe('forgetForConnection', () => {
	test('cleanup nothing', () => {
		const { list, getEntityDefinition } = createList('test01')

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

		list.loadStorage(cloneDeep(ActionTree), true, false)

		// Starts with correct length
		expect(list.getAllEntities()).toHaveLength(6)

		expect(list.forgetForConnection('missing-connection')).toBe(false)

		// Check ids after cleanup
		expect(list.getAllEntities()).toHaveLength(6)
	})

	test('remove from root', () => {
		const { list, getEntityDefinition, connectionEntityDelete } = createList('test01')

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

describe('getChildBooleanFeedbackValues', () => {
	const { list, getEntityDefinition } = createList('test01', null, {
		type: EntityModelType.Feedback,
		feedbackListType: FeedbackEntitySubType.Boolean,
	})
	getEntityDefinition.mockImplementation(FeedbackTreeEntityDefinitions)

	test('invalid for action list', () => {
		const { list } = createList('test01', null, { type: EntityModelType.Action })

		expect(list.clearCachedValueForConnectionId('internal')).toBe(false)
	})

	test('invalid for non boolean feedbacks list', () => {
		const { list } = createList('test01', null, { type: EntityModelType.Feedback })

		expect(list.clearCachedValueForConnectionId('internal')).toBe(false)
	})

	test('all disabled', () => {
		list.loadStorage(cloneDeep(FeedbackTree), true, false)
		// seed some values for boolean feedabcks
		list.updateFeedbackValues('conn02', { '02': true })

		// Disable all feedbacks
		for (const entity of list.getAllEntities()) {
			entity.setEnabled(false)
		}

		expect(list.clearCachedValueForConnectionId('internal')).toBe(true)
	})

	test('basic boolean values', () => {
		list.loadStorage(cloneDeep(FeedbackTree), true, false)
		// seed some values for boolean feedabcks
		list.updateFeedbackValues('conn02', { '02': true })

		const entity = list.findById('02')
		expect(entity).not.toBeUndefined()
		expect(entity!.feedbackValue).toBe(true)

		expect(list.clearCachedValueForConnectionId(entity!.connectionId)).toBe(true)

		expect(entity!.feedbackValue).toBe(undefined)
	})

	test('advanced value values', () => {
		list.loadStorage(cloneDeep(FeedbackTree), true, false)
		// seed some values for boolean feedabcks
		list.updateFeedbackValues('internal', { int0: 'abc' })

		const entity = list.findById('int0')
		expect(entity).not.toBeUndefined()
		expect(entity!.feedbackValue).toBe('abc')

		expect(list.clearCachedValueForConnectionId(entity!.connectionId)).toBe(true)

		expect(entity!.feedbackValue).toBe(undefined)
	})
})

describe('getBooleanFeedbackValue', () => {
	const { list, getEntityDefinition } = createList('test01', null, {
		type: EntityModelType.Feedback,
		feedbackListType: FeedbackEntitySubType.Boolean,
	})
	getEntityDefinition.mockImplementation(FeedbackTreeEntityDefinitions)

	test('invalid for action list', () => {
		const { list } = createList('test01', null, { type: EntityModelType.Action })

		expect(() => list.getBooleanFeedbackValue()).toThrow('ControlEntityList is not boolean feedbacks')
	})

	test('invalid for non boolean feedbacks list', () => {
		const { list } = createList('test01', null, { type: EntityModelType.Feedback })

		expect(() => list.getBooleanFeedbackValue()).toThrow('ControlEntityList is not boolean feedbacks')
	})

	test('empty list', () => {
		list.loadStorage([], true, false)

		// When empty disabled, should return true
		expect(list.getBooleanFeedbackValue()).toBe(true)
	})

	test('all disabled', () => {
		list.loadStorage(cloneDeep(FeedbackTree), true, false)
		// seed some values for boolean feedabcks
		list.updateFeedbackValues('conn02', { '02': true })

		// Disable all feedbacks
		for (const entity of list.getAllEntities()) {
			entity.setEnabled(false)
		}

		// When all disabled, should return true
		expect(list.getBooleanFeedbackValue()).toBe(true)
	})

	test('boolean values values', () => {
		list.loadStorage(cloneDeep(FeedbackTree), true, false)

		// disable the one set to non-boolean
		list.findById('int0')?.setEnabled(false)

		// set some values
		list.updateFeedbackValues('conn01', { '01': true })

		// check still false
		expect(list.getBooleanFeedbackValue()).toBe(false)

		// set final value
		list.updateFeedbackValues('conn02', { '02': true })
		expect(list.getBooleanFeedbackValue()).toBe(true)
	})
})

describe('getChildBooleanFeedbackValues', () => {
	const { list, getEntityDefinition } = createList('test01', null, {
		type: EntityModelType.Feedback,
		feedbackListType: FeedbackEntitySubType.Boolean,
	})
	getEntityDefinition.mockImplementation(FeedbackTreeEntityDefinitions)

	test('invalid for action list', () => {
		const { list } = createList('test01', null, { type: EntityModelType.Action })

		expect(() => list.getChildBooleanFeedbackValues()).toThrow('ControlEntityList is not boolean feedbacks')
	})

	test('invalid for non boolean feedbacks list', () => {
		const { list } = createList('test01', null, { type: EntityModelType.Feedback })

		expect(() => list.getChildBooleanFeedbackValues()).toThrow('ControlEntityList is not boolean feedbacks')
	})

	test('all disabled', () => {
		list.loadStorage(cloneDeep(FeedbackTree), true, false)
		// seed some values for boolean feedabcks
		list.updateFeedbackValues('conn02', { '02': true })

		// Disable all feedbacks
		for (const entity of list.getAllEntities()) {
			entity.setEnabled(false)
		}

		expect(list.getChildBooleanFeedbackValues()).toHaveLength(0)
	})

	test('basic feedback values', () => {
		list.loadStorage(cloneDeep(FeedbackTree), true, false)
		// seed some values for boolean feedabcks
		list.updateFeedbackValues('conn02', { '02': true })
		list.updateFeedbackValues('internal', { int0: 'abcd' })

		const fb = list.findById('02')
		fb!.setStyleValue('bgcolor', 123)

		const len = list.getDirectEntities().length

		const values = list.getChildBooleanFeedbackValues()
		expect(values).toHaveLength(len)

		expect(values).toEqual([false, true, false])
	})
})

describe('buildFeedbackStyle', () => {
	const { list, getEntityDefinition } = createList('test01', null, { type: EntityModelType.Feedback })
	getEntityDefinition.mockImplementation(FeedbackTreeEntityDefinitions)

	test('invalid for action list', () => {
		const { list } = createList('test01', null, { type: EntityModelType.Action })

		const styleBuilder = mock<FeedbackStyleBuilder>()

		expect(() => list.buildFeedbackStyle(styleBuilder)).toThrow('ControlEntityList is not style feedbacks')
	})

	test('invalid for boolean feedbacks list', () => {
		const { list } = createList('test01', null, {
			type: EntityModelType.Feedback,
			feedbackListType: FeedbackEntitySubType.Boolean,
		})

		const styleBuilder = mock<FeedbackStyleBuilder>()

		expect(() => list.buildFeedbackStyle(styleBuilder)).toThrow('ControlEntityList is not style feedbacks')
	})

	test('disabled', () => {
		list.loadStorage(cloneDeep(FeedbackTree), true, false)
		// seed some values for boolean feedabcks
		list.updateFeedbackValues('conn02', { '02': true })

		// Disable all feedbacks
		for (const entity of list.getAllEntities()) {
			entity.setEnabled(false)
		}

		const styleBuilder = mock<FeedbackStyleBuilder>()
		list.buildFeedbackStyle(styleBuilder)

		expect(styleBuilder.applyComplexStyle).toHaveBeenCalledTimes(0)
		expect(styleBuilder.applySimpleStyle).toHaveBeenCalledTimes(0)
	})

	test('basic feedback values', () => {
		list.loadStorage(cloneDeep(FeedbackTree), true, false)
		// seed some values for boolean feedabcks
		list.updateFeedbackValues('conn02', { '02': true })
		list.updateFeedbackValues('internal', { int0: 'abcd' })

		const fb = list.findById('02')
		fb!.setStyleValue('bgcolor', 123)

		const styleBuilder = mock<FeedbackStyleBuilder>()
		list.buildFeedbackStyle(styleBuilder)

		expect(styleBuilder.applyComplexStyle).toHaveBeenCalledTimes(1)
		expect(styleBuilder.applySimpleStyle).toHaveBeenCalledTimes(1)

		expect(styleBuilder.applyComplexStyle).toHaveBeenCalledWith('abcd')
		expect(styleBuilder.applySimpleStyle).toHaveBeenCalledWith({ bgcolor: 123 })
	})
})

describe('updateFeedbackValues', () => {
	test('no values', () => {
		const { list, getEntityDefinition } = createList('test01')

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

		list.loadStorage(cloneDeep(ActionTree), true, false)

		// Starts with correct length
		expect(list.getAllEntities()).toHaveLength(6)

		expect(list.updateFeedbackValues('internal', {})).toHaveLength(0)
	})

	test('try set value for action', () => {
		const { list, getEntityDefinition } = createList('test01')

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

		list.loadStorage(cloneDeep(ActionTree), true, false)

		// Starts with correct length
		expect(list.getAllEntities()).toHaveLength(6)

		expect(
			list.updateFeedbackValues('internal', {
				int0: 'abc',
			})
		).toHaveLength(0)

		// Ensure value is still undefined
		const entity = list.findById('int0')
		expect(entity).toBeTruthy()
		expect(entity!.feedbackValue).toEqual(undefined)
	})

	test('set value for nested feedback', () => {
		const { list, getEntityDefinition } = createList('test01')

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

		list.loadStorage(cloneDeep(ActionTree), true, false)

		// Starts with correct length
		expect(list.getAllEntities()).toHaveLength(6)

		const entity = list.findById('int2')

		expect(
			list.updateFeedbackValues('conn04', {
				int2: 'abc',
			})
		).toEqual([entity])

		// Ensure value is reflected
		expect(entity).toBeTruthy()
		expect(entity!.feedbackValue).toEqual('abc')
	})

	test('set value unchanged', () => {
		const { list, getEntityDefinition } = createList('test01')

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

		list.loadStorage(cloneDeep(ActionTree), true, false)

		// Starts with correct length
		expect(list.getAllEntities()).toHaveLength(6)

		// Set once
		list.updateFeedbackValues('conn04', {
			int2: 'abc',
		})

		// Try again
		expect(
			list.updateFeedbackValues('conn04', {
				int2: 'abc',
			})
		).toHaveLength(0)

		// Ensure value is reflected
		const entity = list.findById('int2')
		expect(entity).toBeTruthy()
		expect(entity!.feedbackValue).toEqual('abc')
	})
})

describe('getAllEnabledConnectionIds', () => {
	test('default', () => {
		const { list, getEntityDefinition } = createList('test01')

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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

		getEntityDefinition.mockImplementation(ActionTreeEntityDefinitions)

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
