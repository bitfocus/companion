import { describe, test, expect, vi } from 'vitest'
import { ControlEntityList, ControlEntityListDefinition } from '../../../lib/Controls/Entities/EntityList.js'
import { EntityModelType, EntityOwner } from '@companion-app/shared/Model/EntityModel.js'
import { mockDeep } from 'vitest-mock-extended'
import { cloneDeep } from 'lodash-es'
import { ActionTree, ActionTreeEntityDefinitions, getAllModelsInTree } from './EntityListModels.js'
import {
	InstanceDefinitionsForEntity,
	InternalControllerForEntity,
	ModuleHostForEntity,
} from '../../../lib/Controls/Entities/Types.js'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

describe('EntityList', () => {
	function createList(controlId: string, ownerId?: EntityOwner | null, listId?: ControlEntityListDefinition | null) {
		const getEntityDefinition = vi.fn<InstanceDefinitionsForEntity['getEntityDefinition']>()
		const connectionEntityUpdate = vi.fn<ModuleHostForEntity['connectionEntityUpdate']>(async () => false)
		const internalEntityUpdate = vi.fn<InternalControllerForEntity['entityUpdate']>(async () => false)

		const list = new ControlEntityList(
			{
				getEntityDefinition,
			},
			{
				entityUpdate: internalEntityUpdate,
				entityDelete: null as any,
				entityUpgrade: null as any,
				executeLogicFeedback: null as any,
			},
			{
				connectionEntityUpdate,
				connectionEntityDelete: null as any,
				connectionLearnOptions: null as any,
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
			internalEntityUpdate,
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
})
