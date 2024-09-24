import type { ModuleVersionMode } from './ModuleInfo.js'

export interface ConnectionConfig {
	label: string
	config: unknown
	isFirstInit: boolean
	lastUpgradeIndex: number
	instance_type: string
	enabled: boolean
	sortOrder: number
	/**
	 * Which version of the module to use
	 */
	moduleVersionMode: ModuleVersionMode
	moduleVersionId: string | null
}
