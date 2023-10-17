import type { ConnectionConfig } from '../../Instance/Controller.js'
import type { CustomVariablesModel } from './CustomVariableModel.js'

export type SomeExport4 = ExportFull4 | ExportPageModel4 | ExportTriggersList4

export interface ExportBase<Type extends string> {
    readonly version: 4
    readonly type: Type
}

export interface ExportFull4 extends ExportBase<'full'> {
    pages?: Record<number, ExportPageContent4>
    triggers?: Record<string, ExportTriggerContent4>
    custom_variables?: CustomVariablesModel
    instances?: ExportInstances4
    surfaces?: unknown
}

export interface ExportPageModel4 extends ExportBase<'page'> {
    page: ExportPageContent4
    instances: ExportInstances4
    oldPageNumber: number
}


export interface ExportTriggersList4 extends ExportBase<'trigger_list'> {
    triggers: Record<string, ExportTriggerContent4>
    instances: ExportInstances4
}

export type ExportTriggerContent4 = Record<string, any> // TODO

export interface ExportPageContent4 {
    name: string
    controls: Record<number, Record<number, ExportControl4>>

    gridSize: { columns: number; rows: number }
}

export type ExportControl4 = Record<string, any> // TODO

export type ExportInstances4 =
    | Record<string, ExportInstanceFull4 | ExportInstanceMinimal4>
    | Record<string, ConnectionConfig | undefined> // TODO - tidy

export type ExportInstanceFull4 = {
    label: string
    config: unknown
    isFirstInit: boolean
    lastUpgradeIndex: number
    instance_type: string
    enabled: boolean
    sortOrder: number
}

export type ExportInstanceMinimal4 = {
    label: string
    instance_type: string
    lastUpgradeIndex: number
}

export interface ExportGridSize {
    minColumn: number
    maxColumn: number
    minRow: number
    maxRow: number
}
