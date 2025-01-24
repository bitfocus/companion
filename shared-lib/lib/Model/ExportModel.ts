import type { UserConfigGridSize } from './UserConfigModel.js'
import type { ConnectionConfig, ConnectionUpdatePolicy } from './Connections.js'
import type { CustomVariablesModel } from './CustomVariableModel.js'

export type SomeExportv6 = ExportFullv6 | ExportPageModelv6 | ExportTriggersListv6

export interface ExportBase<Type extends string> {
	readonly version: 6 | 7
	readonly type: Type
}

export interface ExportFullv6 extends ExportBase<'full'> {
	pages?: Record<number, ExportPageContentv6>
	triggers?: Record<string, ExportTriggerContentv6>
	custom_variables?: CustomVariablesModel
	instances?: ExportInstancesv6
	surfaces?: unknown
	surfaceGroups?: unknown
}

export interface ExportPageModelv6 extends ExportBase<'page'> {
	page: ExportPageContentv6
	instances: ExportInstancesv6
	oldPageNumber: number
}

export interface ExportTriggersListv6 extends ExportBase<'trigger_list'> {
	triggers: Record<string, ExportTriggerContentv6>
	instances: ExportInstancesv6
}

export type ExportTriggerContentv6 = Record<string, any> // TODO

export interface ExportPageContentv6 {
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
	moduleVersionId?: string // Added in v3.5
	updatePolicy?: ConnectionUpdatePolicy // Added in v3.5
	instance_type: string
	enabled: boolean
	sortOrder?: number
}

export type ExportInstanceMinimalv6 = {
	label: string
	instance_type: string
	lastUpgradeIndex: number
	moduleVersionId?: string // Added in v3.5
	updatePolicy?: ConnectionUpdatePolicy // Added in v3.5
	sortOrder?: number
}
