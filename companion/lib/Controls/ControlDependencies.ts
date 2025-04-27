import type { GraphicsController } from '../Graphics/Controller.js'
import type { UIHandler } from '../UI/Handler.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { InternalController } from '../Internal/Controller.js'
import type { InstanceController } from '../Instance/Controller.js'
import type { ActionRunner } from './ActionRunner.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { EventEmitter } from 'events'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'

export type SomeControlModel = SomeButtonModel | TriggerModel

export interface ControlDependencies {
	readonly dbTable: DataStoreTableView<SomeControlModel>
	readonly io: UIHandler

	readonly graphics: GraphicsController
	readonly surfaces: SurfaceController
	readonly page: PageController

	readonly internalModule: InternalController
	readonly instance: InstanceController
	readonly variables: VariablesController
	readonly userconfig: DataUserConfig

	readonly actionRunner: ActionRunner

	readonly events: EventEmitter<ControlCommonEvents>
}

export interface ControlCommonEvents {
	updateButtonState: [location: ControlLocation, pushed: boolean, surfaceId: string | undefined]
}
