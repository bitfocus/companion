import type { UserConfigGridSize } from './UserConfigModel.js'
import type { CustomVariablesModel } from './CustomVariableModel.js'

export type SomeExportv4 = ExportFullv4 | ExportPageModelv4 | ExportTriggersListv4

export interface ExportBase<Type extends string> {
	readonly version: 4
	readonly type: Type
}

export interface ExportFullv4 extends ExportBase<'full'> {
	pages?: Record<number, ExportPageContentv4>
	triggers?: Record<string, ExportTriggerContentv4>
	custom_variables?: CustomVariablesModel
	instances?: ExportInstancesv4
	surfaces?: unknown
	surfaceGroups?: unknown
}

export interface ExportPageModelv4 extends ExportBase<'page'> {
	page: ExportPageContentv4
	instances: ExportInstancesv4
	oldPageNumber: number
}

export interface ExportTriggersListv4 extends ExportBase<'trigger_list'> {
	triggers: Record<string, ExportTriggerContentv4>
	instances: ExportInstancesv4
}

export type ExportTriggerContentv4 = Record<string, any> // TODO

export interface ExportPageContentv4 {
	name: string
	controls: Record<number, Record<number, ExportControlv4>>

	gridSize: UserConfigGridSize
}

export type ExportControlv4 = Record<string, any> // TODO

export type ExportInstancesv4 = Record<string, ExportInstanceFullv4 | ExportInstanceMinimalv4>

export type ExportInstanceFullv4 = {
	label: string
	config: unknown
	isFirstInit: boolean
	lastUpgradeIndex: number
	instance_type: string
	enabled: boolean
	sortOrder?: number
}

export type ExportInstanceMinimalv4 = {
	label: string
	instance_type: string
	lastUpgradeIndex: number
	sortOrder?: number
}
