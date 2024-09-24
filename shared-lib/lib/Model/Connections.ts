import { ModuleVersion } from './ModuleInfo.js'

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
	moduleVersion: ModuleVersion | null
}
