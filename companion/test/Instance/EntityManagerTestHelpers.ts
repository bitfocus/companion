import { vi } from 'vitest'
import type {
	ActionEntityModel,
	EntityModelType,
	FeedbackEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { CompanionOptionValues } from '@companion-module/host'
import { ActionEntityManager } from '../../lib/Instance/Connection/ActionEntityManager.js'
import type { EntityManagerAdapter } from '../../lib/Instance/Connection/EntityManagerBase.js'
import { FeedbackEntityManager } from '../../lib/Instance/Connection/FeedbackEntityManager.js'
import type { VariableDependencyRegistry } from '../../lib/Variables/DependencyRegistry.js'

/** What the managers send to the module, for both types so that a test can check one type is left alone */
export const mockAdapter = {
	updateActions: vi.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(null),
	updateFeedbacks: vi.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(null),

	upgradeActions: vi.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]),
	upgradeFeedbacks: vi.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]),
}
const mockActionAdapter: EntityManagerAdapter<ActionEntityModel> = {
	update: async (actions) => mockAdapter.updateActions(actions),
	upgrade: async (actions, currentUpgradeIndex) => mockAdapter.upgradeActions(actions, currentUpgradeIndex),
}
const mockFeedbackAdapter: EntityManagerAdapter<FeedbackEntityModel> = {
	update: async (feedbacks) => mockAdapter.updateFeedbacks(feedbacks),
	upgrade: async (feedbacks, currentUpgradeIndex) => mockAdapter.upgradeFeedbacks(feedbacks, currentUpgradeIndex),
}

export const mockControl = {
	entities: {
		entityReplaceForUpgrade: vi.fn<(...args: any[]) => void>(),
	},
	supportsEntities: true,
}

/** Parses each option of the definition to `value-<index>` */
const parseEntityOptionsToIndexes = (entityDefinition: any, _options: any) => {
	const parsedOptions: CompanionOptionValues = {}

	let i = 0
	for (const option of entityDefinition.options) {
		parsedOptions[option.id] = `value-${i++}`
	}

	return {
		ok: true,
		parsedOptions: parsedOptions,
		referencedVariableIds: new Set(['var1', 'var2']),
	}
}

export const mockVariablesParser = {
	parseEntityOptions: vi.fn<(...args: any[]) => any>().mockImplementation(parseEntityOptionsToIndexes),
}

export const mockControlsController = {
	getControl: vi.fn<(controlId: string) => any>().mockReturnValue(mockControl),
	createVariablesAndExpressionParser: vi.fn<(...args: any[]) => any>().mockReturnValue(mockVariablesParser),
	updateFeedbackValues: vi.fn<(...args: any[]) => void>(),
}

export const mockRenderClock = {
	subscribe: vi.fn<(callback: () => void) => () => void>().mockReturnValue(() => {}),
	destroy: vi.fn<() => void>(),
}

/** Reset the mocks to their defaults, as clearAllMocks only clears the call history */
export function resetEntityManagerMocks(): void {
	vi.clearAllMocks()

	mockVariablesParser.parseEntityOptions.mockImplementation(parseEntityOptionsToIndexes)
	mockControlsController.getControl.mockReturnValue(mockControl)
	mockControlsController.createVariablesAndExpressionParser.mockReturnValue(mockVariablesParser)
	mockAdapter.updateActions.mockResolvedValue(null)
	mockAdapter.updateFeedbacks.mockResolvedValue(null)
	mockAdapter.upgradeActions.mockResolvedValue([])
	mockAdapter.upgradeFeedbacks.mockResolvedValue([])
}

export function createActionManager(variableDependencies: VariableDependencyRegistry): ActionEntityManager {
	return new ActionEntityManager(
		mockActionAdapter,
		mockControlsController as any,
		'test-connection-id',
		variableDependencies
	)
}

export function createFeedbackManager(variableDependencies: VariableDependencyRegistry): FeedbackEntityManager {
	return new FeedbackEntityManager(
		mockFeedbackAdapter,
		mockControlsController as any,
		'test-connection-id',
		variableDependencies,
		mockRenderClock as any
	)
}

/** An entity with a single text option, so that entities can be made to differ by their options */
export const createMockEntity = (
	id: string,
	type: EntityModelType,
	options: Record<string, any>,
	extraModel: Record<string, any> = {}
) => ({
	id,
	type,
	definitionId: 'def-1',
	upgradeIndex: 5,
	asEntityModel: vi.fn<(deep: boolean) => any>().mockReturnValue({
		id,
		type,
		definitionId: 'def-1',
		connectionId: 'connection-1',
		options,
		upgradeIndex: 5,
		...extraModel,
	}),
	getEntityDefinition: vi.fn<() => any>().mockReturnValue({
		hasLifecycleFunctions: true,
		options: [{ id: 'field1', type: 'textinput' }],
		optionsToIgnoreForSubscribe: [],
	}),
})
