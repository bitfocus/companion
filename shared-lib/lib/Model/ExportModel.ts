import type { UserConfigGridSize } from './UserConfigModel.js'
import type { ConnectionCollection, ConnectionConfig, ConnectionUpdatePolicy } from './Connections.js'
import type { CustomVariableCollection, CustomVariablesModel } from './CustomVariableModel.js'
import type { TriggerCollection } from './TriggerModel.js'
import type { ImageLibraryExportData, ImageLibraryCollection } from './ImageLibraryModel.js'

export type SomeExportv6 = ExportFullv6 | ExportPageModelv6 | ExportTriggersListv6

export interface ExportBase<Type extends string> {
	readonly version: 6 | 7 | 8 | 9
	readonly type: Type
	readonly companionBuild: string | undefined // The build of the companion that exported this
}

export interface ExportFullv6 extends ExportBase<'full'> {
	pages?: Record<number, ExportPageContentv6>
	triggers?: Record<string, ExportTriggerContentv6>
	triggerCollections?: TriggerCollection[] // Added in v4.1
	custom_variables?: CustomVariablesModel
	customVariablesCollections?: CustomVariableCollection[] // Added in v4.1
	instances?: ExportInstancesv6
	connectionCollections?: ConnectionCollection[] // Added in v4.1
	surfaces?: unknown
	surfaceGroups?: unknown
	imageLibrary?: ImageLibraryExportData[]
	imageLibraryCollections?: ImageLibraryCollection[]
}

export interface ExportPageModelv6 extends ExportBase<'page'> {
	page: ExportPageContentv6
	instances: ExportInstancesv6
	connectionCollections: ConnectionCollection[] | undefined // Added in v4.1
	oldPageNumber: number
	imageLibrary?: ImageLibraryExportData[]
	imageLibraryCollections?: ImageLibraryCollection[]
}

export interface ExportTriggersListv6 extends ExportBase<'trigger_list'> {
	triggers: Record<string, ExportTriggerContentv6>
	triggerCollections: TriggerCollection[] | undefined // Added in v4.1
	instances: ExportInstancesv6
	connectionCollections: ConnectionCollection[] | undefined // Added in v4.1
	imageLibrary?: ImageLibraryExportData[]
	imageLibraryCollections?: ImageLibraryCollection[]
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
	| Record<string, ConnectionConfig | undefined> // TODO - tidy

export type ExportInstanceFullv6 = {
	label: string
	config: unknown
	isFirstInit: boolean
	lastUpgradeIndex: number
	moduleVersionId?: string // Added in v4.0
	updatePolicy?: ConnectionUpdatePolicy // Added in v4.0
	instance_type: string
	enabled: boolean
	sortOrder?: number
}

export type ExportInstanceMinimalv6 = {
	label: string
	instance_type: string
	lastUpgradeIndex: number
	moduleVersionId?: string // Added in v4.0
	updatePolicy?: ConnectionUpdatePolicy // Added in v4.0
	sortOrder?: number
}
