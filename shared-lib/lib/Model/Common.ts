import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { SomeCompanionInputField } from './Options.js'

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
	message2: string | undefined
	link: string | undefined
}

/**
 * Status of the Linux udev rules that grant access to USB surfaces.
 * On non-Linux platforms `supported` is false and nothing else is meaningful.
 */
export interface UdevRulesStatus {
	/** Whether udev rules are relevant on this platform (linux only) */
	supported: boolean
	/** Which build/file is in use */
	mode: 'desktop' | 'headless'
	/** Whether the installed rules are out of date and need (re)applying */
	needsApply: boolean
	/** Absolute path to the generated rules file */
	generatedPath: string
	/** Absolute path the rules should be installed to */
	installedPath: string
	/** A shell command the user can run manually to apply the rules */
	applyCommand: string
	/** Whether Companion can apply the rules itself (desktop, pkexec available, local client) */
	canAutoApply: boolean
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

export interface EmulatorLockedState {
	characterCount: number
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
	useNewLayout: boolean
	config: unknown
	secrets: unknown
}

export type DropdownChoiceId = string | number
/**
 * An option for a dropdown input
 *
 * Available for actions/feedbacks/config
 */
export interface DropdownChoice {
	/** Value of the option */
	id: DropdownChoiceId
	/** Label to show to users */
	label: string
}
