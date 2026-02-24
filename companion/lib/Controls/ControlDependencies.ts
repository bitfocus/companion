import type { SurfaceController } from '../Surface/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { InternalController } from '../Internal/Controller.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { ActionRunner } from './ActionRunner.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { EventEmitter } from 'events'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { TriggersUpdate } from '@companion-app/shared/Model/TriggerModel.js'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type {
	ClientExpressionVariableData,
	ExpressionVariableUpdate,
} from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { VariablesValues } from '../Variables/Values.js'

export interface ControlExternalDependencies {
	readonly surfaces: SurfaceController
	readonly pageStore: IPageStore

	readonly internalModule: InternalController
	readonly instance: InstanceController
	readonly variableValues: VariablesValues
	readonly userconfig: DataUserConfig

	readonly actionRunner: ActionRunner
}

export interface ControlDependencies extends ControlExternalDependencies {
	readonly dbTable: DataStoreTableView<Record<string, SomeControlModel>>

	readonly events: EventEmitter<ControlCommonEvents>

	readonly changeEvents: EventEmitter<ControlChangeEvents>
}

export interface ControlCommonEvents {
	updateButtonState: [location: ControlLocation, pushed: boolean, surfaceId: string | undefined]
	invalidateControlRender: [controlId: string]
	invalidateLocationRender: [location: ControlLocation]
	expressionVariableDefinitionChanged: [id: string, info: ClientExpressionVariableData | null]

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
