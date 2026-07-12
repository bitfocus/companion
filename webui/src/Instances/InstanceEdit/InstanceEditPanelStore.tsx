import { isEqual } from 'lodash-es'
import { action, observable } from 'mobx'
import { computedFn } from 'mobx-utils'
import type { JsonValue } from 'type-fest'
import { isLabelValid } from '@companion-app/shared/Label.js'
import type { ClientEditInstanceConfigState } from '@companion-app/shared/Model/Common.js'
import { InstanceVersionUpdatePolicy, type ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { parseIsVisibleFn } from '~/Hooks/useOptionsAndIsVisible'
import type { InstanceEditPanelService } from './InstanceEditPanelService'

export interface InstanceBasicInfoChanges {
	label?: string
	enabled?: boolean
	versionId?: string | null
	updatePolicy?: InstanceVersionUpdatePolicy
}
export interface InstanceConfigAndSecrets {
	fields: Array<SomeCompanionInputField>

	useNewLayout: boolean

	config: CompanionOptionValues
	secrets: CompanionOptionValues
}

/**
 * Store for the Instance Edit Panel
 * This used to use tanstack/react-form, but that was challenging because of the complex flows and changing form fields, often leaving the form in an invalid state.
 * Instead, this uses MobX to manage the state of the form and the instance configuration in a more predictable way.
 *
 * The config fields are driven by a single subscription (`service.watchConfig`): the backend reports the current
 * state (loading / running-with-config / not-running / error) and this store just applies it, keeping any of the
 * user's in-progress edits intact.
 */
export class InstanceEditPanelStore<TConfig extends ClientInstanceConfigBase> {
	readonly service: InstanceEditPanelService<TConfig>
	readonly instanceInfo: TConfig

	/** The latest state reported by the config subscription. null = not yet received. */
	#state = observable.box<ClientEditInstanceConfigState | null>(null)

	/** The working copy of the config/secret values the user is editing */
	#config = observable.box<CompanionOptionValues>({})
	#secrets = observable.box<CompanionOptionValues>({})
	/** The ids of fields the user has edited but not yet saved */
	#dirtyFields = observable.set<string>()
	/** Set when a config update arrives from elsewhere while the user has unsaved edits */
	#externalChangeWarning = observable.box(false)

	#basicChanges = observable.box<InstanceBasicInfoChanges>({})

	get configAndSecrets(): InstanceConfigAndSecrets | null {
		const state = this.#state.get()
		if (state?.type !== 'config') return null

		return {
			fields: state.fields,
			useNewLayout: state.useNewLayout,
			config: this.#config.get(),
			secrets: this.#secrets.get(),
		}
	}

	get loadError(): string | null {
		const state = this.#state.get()
		return state?.type === 'error' ? state.message : null
	}

	get isLoading(): boolean {
		const state = this.#state.get()
		return state === null || state.type === 'loading'
	}

	/** If the instance is not running, why. null when it is running (or still loading). */
	get notRunningReason(): 'disabled' | 'missing' | 'starting' | 'crashed' | null {
		const state = this.#state.get()
		return state?.type === 'notRunning' ? state.reason : null
	}

	get externalChangeWarning(): boolean {
		return this.#externalChangeWarning.get()
	}

	dismissExternalChangeWarning = action(() => {
		this.#externalChangeWarning.set(false)
	})

	constructor(service: InstanceEditPanelService<TConfig>, instanceInfo: TConfig) {
		this.service = service
		this.instanceInfo = instanceInfo
	}

	/**
	 * Apply a new state from the config subscription. Incoming values are taken for fields the user has not
	 * edited; the user's edits to dirty fields are preserved. If an untouched field changes while the user has
	 * unsaved edits, flag that the config was changed elsewhere.
	 */
	applyState = action((newState: ClientEditInstanceConfigState | null) => {
		this.#state.set(newState)

		if (newState?.type === 'config') {
			const incomingConfig = (newState.config ?? {}) as CompanionOptionValues
			const incomingSecrets = (newState.secrets ?? {}) as CompanionOptionValues

			// Detect an external change: an untouched field whose value differs from what we currently show
			if (this.#dirtyFields.size > 0) {
				const localConfig = this.#config.get()
				const localSecrets = this.#secrets.get()
				const changedElsewhere =
					Object.entries(incomingConfig).some(
						([id, value]) => !this.#dirtyFields.has(id) && !isEqual(localConfig[id], value)
					) ||
					Object.entries(incomingSecrets).some(
						([id, value]) => !this.#dirtyFields.has(id) && !isEqual(localSecrets[id], value)
					)
				if (changedElsewhere) this.#externalChangeWarning.set(true)
			}

			// Merge: take incoming values, but keep the user's edits for dirty fields
			const mergedConfig: CompanionOptionValues = { ...incomingConfig }
			const mergedSecrets: CompanionOptionValues = { ...incomingSecrets }
			for (const fieldId of this.#dirtyFields) {
				if (fieldId in this.#config.get()) mergedConfig[fieldId] = this.#config.get()[fieldId]
				if (fieldId in this.#secrets.get()) mergedSecrets[fieldId] = this.#secrets.get()[fieldId]
			}
			this.#config.set(mergedConfig)
			this.#secrets.set(mergedSecrets)
		} else {
			// Not running / error - drop the working copy and any edits
			this.#config.set({})
			this.#secrets.set({})
			this.#dirtyFields.clear()
			this.#externalChangeWarning.set(false)
		}
	})

	/**
	 * Mark the current config as saved: clear the dirty tracking so the form is no longer considered dirty.
	 * Called after a successful save; the working copy already holds the saved values.
	 */
	markSaved = action(() => {
		this.#basicChanges.set({})
		this.#dirtyFields.clear()
		this.#externalChangeWarning.set(false)
	})

	isDirty = computedFn((): boolean => {
		const basicChanges = this.#basicChanges.get()
		if (Object.keys(basicChanges).length > 0) {
			return true
		}

		return this.#dirtyFields.size > 0
	})

	isValid = computedFn(() => {
		if (!this.checkLabelIsValid(this.labelValue)) return false

		// Validate the config and secrets
		const configAndSecrets = this.configAndSecrets
		if (configAndSecrets) {
			for (const field of configAndSecrets.fields) {
				if (!this.#isFieldValueValid(configAndSecrets, field)) {
					return false
				}
			}
		}

		return true
	})

	isVisibleFn = computedFn(parseIsVisibleFn)

	isVisible = computedFn((field: SomeCompanionInputField): boolean => {
		const isVisibleFn = this.isVisibleFn(field)
		if (isVisibleFn) {
			const configAndSecrets = this.configAndSecrets
			if (configAndSecrets) {
				return isVisibleFn(configAndSecrets.config)
			}
		}

		return true // If no isVisibleFn, assume visible
	})

	#isFieldValueValid(configAndSecrets: InstanceConfigAndSecrets, field: SomeCompanionInputField): boolean {
		if (!this.isVisible(field)) {
			return true // If the field is not visible, it is considered valid
		}

		if (!isConfigFieldSecret(field)) {
			return !validateInputValue(field, configAndSecrets.config[field.id]).validationError
		} else {
			return !validateInputValue(field, configAndSecrets.secrets[field.id]).validationError
		}
	}

	get enabled(): boolean {
		return this.#basicChanges.get().enabled ?? this.instanceInfo.enabled
	}
	setEnabled = action((value: boolean) => {
		this.#basicChanges.set({
			...this.#basicChanges.get(),
			enabled: value,
		})
	})

	get labelValue(): string {
		return this.#basicChanges.get().label ?? this.instanceInfo.label
	}
	setLabelValue = action((value: string) => {
		this.#basicChanges.set({
			...this.#basicChanges.get(),
			label: value,
		})
	})
	checkLabelIsValid = (value: string): boolean => isLabelValid(value)

	get updatePolicy(): InstanceVersionUpdatePolicy {
		return (
			this.#basicChanges.get().updatePolicy ?? (this.instanceInfo.updatePolicy || InstanceVersionUpdatePolicy.Manual)
		)
	}
	setUpdatePolicy = action((value: InstanceVersionUpdatePolicy) => {
		this.#basicChanges.set({
			...this.#basicChanges.get(),
			updatePolicy: value,
		})
	})

	setConfigValue = action((fieldId: string, value: JsonValue | undefined) => {
		const state = this.#state.get()
		if (state?.type !== 'config') return

		const field = state.fields.find((f) => f.id === fieldId)
		if (!field) return

		if (isConfigFieldSecret(field)) {
			this.#secrets.set({ ...this.#secrets.get(), [fieldId]: value })
		} else {
			this.#config.set({ ...this.#config.get(), [fieldId]: value })
		}
		this.#dirtyFields.add(fieldId)
	})
}

export function isConfigFieldSecret(field: SomeCompanionInputField): boolean {
	return field.type.startsWith('secret')
}
