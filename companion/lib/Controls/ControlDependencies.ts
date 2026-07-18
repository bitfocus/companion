import type { EventEmitter } from 'node:events'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type {
	ClientExpressionVariableData,
	ExpressionVariableUpdate,
} from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { TriggersUpdate } from '@companion-app/shared/Model/TriggerModel.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { InternalController } from '../Internal/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { VariablesValues } from '../Variables/Values.js'
import type { ActionRunner } from './ActionRunner.js'
import type { ControlEntityInstance } from './Entities/EntityInstance.js'
import type { ExpressionVariableNameMap } from './ExpressionVariableNameMap.js'
import type { SomeControl } from './IControlFragments.js'
import type { TriggerEvents } from './TriggerEvents.js'

/**
 * A narrow accessor letting one control reach other controls (to press/rotate a target, or read its model).
 */
export interface ControlsAccessor {
	getControl(controlId: string): SomeControl<any> | undefined
	pressControl(controlId: string, pressed: boolean, surfaceId: string | undefined, force?: boolean): boolean
	rotateControl(controlId: string, rightward: boolean, surfaceId: string | undefined): boolean
}

export interface ControlExternalDependencies {
	readonly surfaces: SurfaceController
	readonly pageStore: IPageStore

	readonly internalModule: InternalController
	readonly instance: InstanceController
	readonly variableValues: VariablesValues
	readonly userconfig: DataUserConfig
	readonly graphics: GraphicsController

	readonly actionRunner: ActionRunner
}

export interface ControlDependencies extends ControlExternalDependencies {
	readonly dbTable: DataStoreTableView<Record<string, SomeControlModel>>

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
}

export interface ControlCommonEvents {
	updateButtonState: [location: ControlLocation, pushed: boolean, surfaceId: string | undefined]
	invalidateControlRender: [controlId: string]
	invalidateLocationRender: [location: ControlLocation]
	expressionVariableDefinitionChanged: [id: string, info: ClientExpressionVariableData | null]
	layeredStyleElementChanged: [controlId: string, elementId: string]

	presetDrawn: [controlId: string, render: ImageResult]

	/**
	 * Emitted when a control is added or removed, to notify that the total control count has changed
	 */
	controlCountChanged: []

	/**
	 * Emitted when a control is placed at a grid location (create or import)
	 */
	controlPlacedAt: [location: ControlLocation, controlId: string]

	/**
	 * Emitted when a control is removed from a grid location (delete)
	 */
	controlRemovedFrom: [location: ControlLocation]
}

export type ControlChangeEvents = {
	triggerChange: [controlId: string, diff: TriggersUpdate]
	expressionVariableChange: [controlId: string, diff: ExpressionVariableUpdate]
}
