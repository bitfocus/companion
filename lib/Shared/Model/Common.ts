import type { InternalActionInputField } from './Options.js'

export interface AppVersionInfo {
	appVersion: string
	appBuild: string
}
export interface AppUpdateInfo {
	message: string
	link: string | undefined
}

export interface ControlLocation {
	pageNumber: number
	row: number
	column: number
}

export interface EmulatorConfig {
	emulator_control_enable: boolean
	emulator_prompt_fullscreen: boolean
	emulator_columns: number
	emulator_rows: number
}

export interface EmulatorImage {
	x: number
	y: number
	buffer: string | false
}

export interface ModuleDisplayInfo {
	id: string
	name: string
	version: string
	hasHelp: boolean
	bugUrl: string
	shortname: string
	manufacturer: string
	products: string[]
	keywords: string[]
	isLegacy?: boolean
}

export interface ConnectionStatusEntry {
	category: string | null
	level: string | null
	message: string | undefined
}

export interface ClientConnectionConfig {
	label: string
	instance_type: string
	enabled: boolean
	sortOrder: number
	hasRecordActionsHandler: boolean
}

export interface ClientBonjourService {
	subId: string
	fqdn: string
	name: string
	port: number
	addresses: string[]
}

export interface EventDefinition {
	name: string
	description?: string
	options: InternalActionInputField[]
}

export interface ClientEventDefinition extends EventDefinition {}
