import type { EventEmitter } from 'node:events'
import type {
	BankControlId,
	CustomActionControlId,
	CustomFeedbackControlId,
	CustomPresetControlId,
	PresetControlId,
	SomeControlId,
} from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { SomeControlModelSchema } from '@companion-app/shared/Model/Controls.js'
import type { CustomActionsUpdate } from '@companion-app/shared/Model/CustomActionModel.js'
import type { CustomFeedbacksUpdate } from '@companion-app/shared/Model/CustomFeedbackModel.js'
import type { CustomPresetsUpdate } from '@companion-app/shared/Model/CustomPresetModel.js'
import type {
	ClientExpressionVariableData,
	ExpressionVariableUpdate,
} from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { TriggersUpdate } from '@companion-app/shared/Model/TriggerModel.js'
import type { DataStoreSchemaTableView } from '../Data/Tables/SchemaTableView.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { InternalController } from '../Internal/Controller.js'
import type { LinkButtonClient } from '../Link/ButtonClient.js'
import type { IPageStore } from '../Page/Store.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { VariableDependencyRegistry } from '../Variables/DependencyRegistry.js'
import type { VariablesValues } from '../Variables/Values.js'
import type { ActionRunner } from './ActionRunner.js'
import type { ControlCustomAction } from './ControlTypes/CustomAction.js'
import type { CustomActionInstanceManager } from './CustomActions/CustomActionInstanceManager.js'
import type { CustomFeedbackInstanceManager } from './CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlEntityInstance } from './Entities/EntityInstance.js'
import type { ExpressionVariableNameMap } from './ExpressionVariableNameMap.js'
import type { SomeControl } from './IControlFragments.js'
import type { ReferencedLocationsIndex } from './ReferencedLocationsIndex.js'
import type { RenderClock } from './RenderClock.js'
import type { TriggerEvents } from './TriggerEvents.js'

/**
 * A narrow accessor letting one control reach other controls (to press/rotate a target, or read its model).
 */
export interface ControlsAccessor {
	getControl(controlId: SomeControlId): SomeControl | undefined
	pressControl(controlId: SomeControlId, pressed: boolean, surfaceId: string | undefined, force?: boolean): boolean
	rotateControl(controlId: SomeControlId, delta: number, surfaceId: string | undefined): boolean
}

export interface ControlExternalDependencies {
	readonly surfaces: SurfaceController
	readonly pageStore: IPageStore

	readonly internalModule: InternalController
	readonly instance: InstanceController
	readonly variableValues: VariablesValues
	/** Where entities and drawing register the variables they read, to be told when those change */
	readonly variableDependencies: VariableDependencyRegistry
	readonly userconfig: DataUserConfig
	readonly graphics: GraphicsController

	readonly actionRunner: ActionRunner

	readonly renderClock: RenderClock

	/** Subscribes link buttons to the remote buttons they show */
	readonly linkButtons: LinkButtonClient

	/** Builds and runs the copies of custom actions held by the actions which call them */
	readonly customActionInstances: CustomActionInstanceManager

	/** Builds the copies of custom feedbacks held by the feedbacks which use them, and gives those their values */
	readonly customFeedbackInstances: CustomFeedbackInstanceManager
}

export interface ControlDependencies extends ControlExternalDependencies {
	readonly dbTable: DataStoreSchemaTableView<typeof SomeControlModelSchema, SomeControlId>

	/** Narrow access to other controls (for controls that forward to or read a target control). */
	readonly controlsAccessor: ControlsAccessor

	readonly events: EventEmitter<ControlCommonEvents>

	readonly changeEvents: EventEmitter<ControlChangeEvents>

	/** Resolve the given page's local-variable entities (its `page:<pageId>` control), for `$(page:x)`. */
	readonly getPageVariableEntities: (pageNumber: number) => ControlEntityInstance[] | null

	/** The shared trigger event bus (used only by trigger controls). */
	readonly triggerEvents: TriggerEvents

	/** The expression-variable name registry (used only by expression-variable controls). */
	readonly expressionVariableNamesMap: ExpressionVariableNameMap

	/** Where drawers report the button locations their last draw referenced, so only those get told of a render. */
	readonly referencedLocations: ReferencedLocationsIndex
}

export interface ControlCommonEvents {
	updateButtonState: [location: ControlLocation, pushed: boolean, surfaceId: string | undefined]
	invalidateControlRender: [controlId: SomeControlId]
	invalidateLocationRender: [location: ControlLocation]
	expressionVariableDefinitionChanged: [id: string, info: ClientExpressionVariableData | null]
	/** Emitted when a custom action is changed, or deleted when it is null, so that its action definition can be updated */
	customActionDefinitionChanged: [controlId: CustomActionControlId, customAction: ControlCustomAction | null]
	/** Emitted when the local variable of an output of a custom action is renamed, as callers know the output by it */
	customActionOutputRenamed: [controlId: CustomActionControlId, fromId: string, toId: string]
	/** Emitted when a custom feedback is changed or deleted, so that its feedback definition can be updated */
	customFeedbackDefinitionChanged: [controlId: CustomFeedbackControlId]
	/** Emitted when a custom preset is changed or deleted, so that its preset definition can be updated */
	customPresetDefinitionChanged: [controlId: CustomPresetControlId]
	layeredStyleElementChanged: [controlId: SomeControlId, elementId: string]

	presetDrawn: [controlId: PresetControlId, render: ImageResult]

	/**
	 * Emitted when a control is added or removed, to notify that the total control count has changed
	 */
	controlCountChanged: []

	/**
	 * Emitted when a control is placed at a grid location (create or import)
	 */
	controlPlacedAt: [location: ControlLocation, controlId: BankControlId]

	/**
	 * Emitted when a control is removed from a grid location (delete)
	 */
	controlRemovedFrom: [location: ControlLocation]
}

export type ControlChangeEvents = {
	triggerChange: [controlId: SomeControlId, diff: TriggersUpdate]
	expressionVariableChange: [controlId: SomeControlId, diff: ExpressionVariableUpdate]
	customActionChange: [controlId: CustomActionControlId, diff: CustomActionsUpdate]
	customFeedbackChange: [controlId: CustomFeedbackControlId, diff: CustomFeedbacksUpdate]
	customPresetChange: [controlId: CustomPresetControlId, diff: CustomPresetsUpdate]
}
