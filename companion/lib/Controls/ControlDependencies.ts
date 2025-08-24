import type { SurfaceController } from '../Surface/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { InternalController } from '../Internal/Controller.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { ActionRunner } from './ActionRunner.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { EventEmitter } from 'events'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { TriggersUpdate } from '@companion-app/shared/Model/TriggerModel.js'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type {
	ClientComputedVariableData,
	ComputedVariableUpdate,
} from '@companion-app/shared/Model/ComputedVariableModel.js'
import type { ImageResult } from '../Graphics/ImageResult.js'

export interface ControlDependencies {
	readonly dbTable: DataStoreTableView<Record<string, SomeControlModel>>

	readonly surfaces: SurfaceController
	readonly pageStore: IPageStore

	readonly internalModule: InternalController
	readonly instance: InstanceController
	readonly variables: VariablesController
	readonly userconfig: DataUserConfig

	readonly actionRunner: ActionRunner

	readonly events: EventEmitter<ControlCommonEvents>

	readonly changeEvents: EventEmitter<ControlChangeEvents>
}

export interface ControlCommonEvents {
	updateButtonState: [location: ControlLocation, pushed: boolean, surfaceId: string | undefined]
	invalidateControlRender: [controlId: string]
	invalidateLocationRender: [location: ControlLocation]
	computedVariableDefinitionChanged: [id: string, info: ClientComputedVariableData | null]

	presetDrawn: [controlId: string, render: ImageResult]
}

export type ControlChangeEvents = {
	triggerChange: [controlId: string, diff: TriggersUpdate]
	computedVariableChange: [controlId: string, diff: ComputedVariableUpdate]
}
