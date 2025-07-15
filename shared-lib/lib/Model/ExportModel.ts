import type { UserConfigGridSize } from './UserConfigModel.js'
import type { ConnectionCollection, ConnectionConfig, ConnectionUpdatePolicy } from './Connections.js'
import type { CustomVariableCollection, CustomVariableModel } from './CustomVariableModel.js'
import type { TriggerCollection } from './TriggerModel.js'
import type { ImageLibraryExportData, ImageLibraryCollection } from './ImageLibraryModel.js'

export type SomeExportv10 = ExportFullv10 | ExportPageModelv10 | ExportTriggersListv10

export interface ExportBase<Type extends string> {
	readonly version: 10
	readonly type: Type
	readonly companionBuild: string // The build of the companion that exported this
}

export interface ExportFullv10 extends ExportBase<'full'> {
	pages?: Record<number, ExportPageContentv10>
	triggers?: Record<string, ExportTriggerContentv10>
	triggerCollections?: TriggerCollection[]
	customVariables?: ExportCustomVariablesContentv10
	customVariablesCollections?: CustomVariableCollection[]
	connections?: ExportConnectionsv10
	connectionCollections?: ConnectionCollection[]
	surfaces?: unknown // Record<number, SurfaceConfig>
	surfaceGroups?: unknown // Record<number, SurfaceGroupConfig>
	imageLibrary?: ImageLibraryExportData[]
	imageLibraryCollections?: ImageLibraryCollection[]
}

export interface ExportPageModelv10 extends ExportBase<'page'> {
	page: ExportPageContentv10
	connections: ExportConnectionsv10
	connectionCollections: ConnectionCollection[]
	oldPageNumber: number
	imageLibrary?: ImageLibraryExportData[]
	imageLibraryCollections?: ImageLibraryCollection[]
}

export interface ExportTriggersListv10 extends ExportBase<'trigger_list'> {
	triggers: Record<string, ExportTriggerContentv10>
	triggerCollections: TriggerCollection[]
	connections: ExportConnectionsv10
	connectionCollections: ConnectionCollection[]
	imageLibrary?: ImageLibraryExportData[]
	imageLibraryCollections?: ImageLibraryCollection[]
}

export type ExportTriggerContentv10 = Record<string, any> // TODO

export type ExportCustomVariablesContentv10 = Record<string, CustomVariableModel> // TODO

export interface ExportPageContentv10 {
	id: string
	name: string
	controls: Record<number, Record<number, ExportControlv10>>

	gridSize: UserConfigGridSize
}

export type ExportControlv10 = Record<string, any> // TODO

export type ExportConnectionsv10 =
	| Record<string, ExportConnectionFullv10 | ExportConnectionMinimalv10>
	| Record<string, ConnectionConfig | undefined> // TODO - tidy

export type ExportConnectionFullv10 = {
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

export type ExportConnectionMinimalv10 = {
	label: string
	instance_type: string
	lastUpgradeIndex: number
	moduleVersionId?: string // Added in v4.0
	updatePolicy?: ConnectionUpdatePolicy // Added in v4.0
	sortOrder?: number
}
