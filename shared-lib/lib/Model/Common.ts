import type { SomeCompanionInputField } from './Options.js'
import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export interface ObjectsDiff<T> {
	added: Record<string, T>
	changed: Record<string, JsonPatchOperation<T>[]>
	removed: string[]
}

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

export type EmulatorImageCache = Record<number, Record<number, string | false | undefined> | undefined>

export interface ClientBonjourService {
	subId: string
	fqdn: string
	name: string
	port: number
	addresses: string[]
}

export type ClientBonjourEvent =
	| {
			type: 'up'
			service: ClientBonjourService
	  }
	| {
			type: 'down'
			fqdn: string
	  }

export interface EventDefinition {
	name: string
	description?: string
	options: SomeCompanionInputField[]
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClientEventDefinition extends EventDefinition {}

export interface WrappedImage {
	image: string | null
	isUsed: boolean
}

export interface ClientEditInstanceConfig {
	fields: Array<SomeCompanionInputField>
	config: unknown
	secrets: unknown
}
