import { vi } from 'vitest'
import { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	ActionEntityModel,
	EntityModelType,
	FeedbackEntityModel,
	FeedbackEntitySubType,
} from '@companion-app/shared/Model/EntityModel.js'
import { ControlEntityListPoolButton } from '../../../lib/Controls/Entities/EntityListPoolButton.js'
import type {
	ControlEntityListChangeProps,
	ControlEntityListPoolProps,
} from '../../../lib/Controls/Entities/EntityListPoolBase.js'

/**
 * Shared harness for exercising `ControlEntityListPoolButton` (and the `ControlEntityListPoolBase`
 * logic it inherits) without standing up the full application. The pool delegates the heavy lifting
 * to `ControlEntityList`/`ControlEntityInstance` (covered in detail by EntityList.test.ts), so these
 * helpers focus on giving the pool just enough mocked collaborators that real entities can be added,
 * letting the tests assert on the pool's own orchestration: list routing, `reportChange` shapes,
 * return values and step/set bookkeeping.
 */

export interface CreatePoolOptions {
	controlId?: string
	isLayered?: boolean
	getEntityDefinition?: (
		entityType: EntityModelType,
		connectionId: string,
		definitionId: string
	) => ClientEntityDefinition | undefined
}

/** A permissive definition lookup: booleans for feedbacks, plain actions otherwise. */
export function defaultGetEntityDefinition(
	entityType: EntityModelType,
	_connectionId: string,
	_definitionId: string
): ClientEntityDefinition | undefined {
	if (entityType === EntityModelType.Feedback) {
		return { entityType, feedbackType: FeedbackEntitySubType.Boolean } as Partial<ClientEntityDefinition> as any
	}
	return { entityType } as Partial<ClientEntityDefinition> as any
}

export function createPool(options: CreatePoolOptions = {}) {
	const controlId = options.controlId ?? 'test01'
	const isLayered = options.isLayered ?? false

	const reportChange = vi.fn<(options: ControlEntityListChangeProps) => void>()
	const sendRuntimeProps = vi.fn()
	const executeExpressionInControl = vi.fn(() => ({ ok: true, value: 1, variableIds: new Set<string>() }) as any)

	const getEntityDefinition = vi.fn(options.getEntityDefinition ?? defaultGetEntityDefinition)

	const internalModule = {
		entityUpdate: vi.fn(),
		entityDelete: vi.fn(),
		entityUpgrade: vi.fn(),
		executeLogicFeedback: vi.fn(),
		onVariablesChanged: vi.fn(),
	}
	const processManager = {
		connectionEntityUpdate: vi.fn(async () => false),
		connectionEntityDelete: vi.fn(async () => false),
		connectionEntityLearnOptions: vi.fn(async () => null),
	}
	const variableValues = {
		emit: vi.fn(),
		createVariablesAndExpressionParser: vi.fn(() => ({}) as any),
	}
	const pageStore = {
		getLocationOfControlId: vi.fn(() => null),
	}

	const deps: ControlEntityListPoolProps = {
		instanceDefinitions: { getEntityDefinition } as any,
		internalModule: internalModule as any,
		processManager: processManager as any,
		variableValues: variableValues as any,
		pageStore: pageStore as any,
		controlId,
		reportChange,
	}

	const pool = new ControlEntityListPoolButton(deps, sendRuntimeProps, executeExpressionInControl, isLayered)

	return {
		pool,
		controlId,
		reportChange,
		sendRuntimeProps,
		executeExpressionInControl,
		getEntityDefinition,
		internalModule,
		processManager,
		variableValues,
		pageStore,
		deps,
	}
}

let nextEntityId = 0
function makeEntityId(prefix: string): string {
	nextEntityId += 1
	return `${prefix}-${nextEntityId}`
}

export function actionModel(overrides: Partial<ActionEntityModel> = {}): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: makeEntityId('action'),
		connectionId: 'conn01',
		definitionId: 'def01',
		options: {},
		upgradeIndex: undefined,
		...overrides,
	}
}

export function feedbackModel(overrides: Partial<FeedbackEntityModel> = {}): FeedbackEntityModel {
	return {
		type: EntityModelType.Feedback,
		id: makeEntityId('feedback'),
		connectionId: 'conn01',
		definitionId: 'def01',
		options: {},
		upgradeIndex: undefined,
		...overrides,
	}
}

/** A step/set location for the default 'down' action set of a given step. */
export function downSet(stepId = '0') {
	return { stepId, setId: 'down' as const }
}
