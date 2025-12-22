import type { UserConfigGridSize } from './UserConfigModel.js'
import type { ConnectionCollection } from './Connections.js'
import type { InstanceConfig, InstanceVersionUpdatePolicy } from './Instance.js'
import type { CustomVariableCollection, CustomVariablesModel } from './CustomVariableModel.js'
import type { TriggerCollection } from './TriggerModel.js'
import type { ExpressionVariableCollection, ExpressionVariableModel } from './ExpressionVariableModel.js'
import type { SurfaceInstanceCollection } from './SurfaceInstance.js'
import type { OutboundSurfaceInfo } from './Surfaces.js'

export type SomeExportv6 = ExportFullv6 | ExportPageModelv6 | ExportTriggersListv6

export interface ExportBase<Type extends string> {
	readonly version: 6 | 7 | 8 | 9 | 10
	readonly type: Type
	readonly companionBuild: string | undefined // The build of the companion that exported this
}

export interface ExportFullv6 extends ExportBase<'full'> {
	pages?: Record<number, ExportPageContentv6>
	triggers?: Record<string, ExportTriggerContentv6>
	triggerCollections?: TriggerCollection[] // Added in v4.1
	custom_variables?: CustomVariablesModel
	customVariablesCollections?: CustomVariableCollection[] // Added in v4.1
	expressionVariables?: Record<string, ExpressionVariableModel> // Added in v4.1
	expressionVariablesCollections?: ExpressionVariableCollection[] // Added in v4.1
	instances?: ExportInstancesv6
	connectionCollections?: ConnectionCollection[] // Added in v4.1
	surfaces?: unknown // Record<number, SurfaceConfig>
	surfaceGroups?: unknown // Record<number, SurfaceGroupConfig>
	surfacesRemote?: Record<string, OutboundSurfaceInfo> // Added in v4.2
	surfaceInstances?: ExportInstancesv6 // Added in v4.2
	surfaceInstanceCollections?: SurfaceInstanceCollection[] // Added in v4.2
}

export interface ExportPageModelv6 extends ExportBase<'page'> {
	page: ExportPageContentv6
	instances: ExportInstancesv6
	connectionCollections: ConnectionCollection[] | undefined // Added in v4.1
	oldPageNumber: number
}

export interface ExportTriggersListv6 extends ExportBase<'trigger_list'> {
	triggers: Record<string, ExportTriggerContentv6>
	triggerCollections: TriggerCollection[] | undefined // Added in v4.1
	instances: ExportInstancesv6
	connectionCollections: ConnectionCollection[] | undefined // Added in v4.1
}

export type ExportTriggerContentv6 = Record<string, any> // TODO

export interface ExportPageContentv6 {
	id?: string // Added in v4.0.4
	name: string
	controls: Record<number, Record<number, ExportControlv6>>

	gridSize: UserConfigGridSize
}

export type ExportControlv6 = Record<string, any> // TODO

export type ExportInstancesv6 =
	| Record<string, ExportInstanceFullv6 | ExportInstanceMinimalv6>
	| Record<string, InstanceConfig | undefined> // TODO - tidy

export type ExportInstanceFullv6 = {
	label: string
	config: unknown
	secrets?: unknown
	isFirstInit: boolean
	lastUpgradeIndex: number
	moduleVersionId?: string // Added in v4.0
	updatePolicy?: InstanceVersionUpdatePolicy // Added in v4.0
	moduleId: string
	enabled: boolean
	sortOrder?: number
	collectionId?: string
}

export type ExportInstanceMinimalv6 = {
	label: string
	moduleId: string
	lastUpgradeIndex: number
	moduleVersionId?: string // Added in v4.0
	updatePolicy?: InstanceVersionUpdatePolicy // Added in v4.0
	sortOrder?: number
	collectionId?: string
}
