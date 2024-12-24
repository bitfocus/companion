import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { ControlEntityList, ControlEntityListDefinition } from '../../../lib/Controls/Entities/EntityList.js'
import { EntityModelType, EntityOwner } from '@companion-app/shared/Model/EntityModel.js'
import { cloneDeep } from 'lodash-es'
import { ActionTree, ActionTreeEntityDefinitions, getAllModelsInTree } from './EntityListModels.js'
import {
	InstanceDefinitionsForEntity,
	InternalControllerForEntity,
	ModuleHostForEntity,
} from '../../../lib/Controls/Entities/Types.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'

describe('EntityList', () => {
	function createList(controlId: string, ownerId?: EntityOwner | null, listId?: ControlEntityListDefinition | null) {
		const getEntityDefinition = vi.fn<InstanceDefinitionsForEntity['getEntityDefinition']>()
		const connectionEntityUpdate = vi.fn<ModuleHostForEntity['connectionEntityUpdate']>(async () => false)
		const connectionEntityDelete = vi.fn<ModuleHostForEntity['connectionEntityDelete']>(async () => false)
		const internalEntityUpdate = vi.fn<InternalControllerForEntity['entityUpdate']>()
		const internalEntityDelete = vi.fn<InternalControllerForEntity['entityDelete']>()

		const list = new ControlEntityList(
			{
				getEntityDefinition,
			},
			{
				entityUpdate: internalEntityUpdate,
				entityDelete: internalEntityDelete,
				entityUpgrade: null as any,
				executeLogicFeedback: null as any,
			},
			{
				connectionEntityUpdate,
				connectionEntityDelete,
				connectionEntityLearnOptions: null as any,
			},
			controlId,
			ownerId ?? null,
			listId ?? {
				type: EntityModelType.Action,
			}
		)

		return {
			list,
			getEntityDefinition,
			connectionEntityUpdate,
			connectionEntityDelete,
			internalEntityUpdate,
			internalEntityDelete,
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
		const { list, getEntityDefinition, connectionEntityUpdate, internalEntityUpdate } = createList('test01')

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

	// describe('addEntity', () => {
	// 	//TODO
	// })
})
