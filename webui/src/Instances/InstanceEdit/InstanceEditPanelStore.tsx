import { isLabelValid } from '@companion-app/shared/Label.js'
import { InstanceVersionUpdatePolicy, type ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { action, observable, runInAction } from 'mobx'
import { computedFn } from 'mobx-utils'
import { nanoid } from 'nanoid'
import { validateInputValue } from '~/Helpers/validateInputValue'
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
	configDirty: boolean
	secrets: CompanionOptionValues
	secretsDirty: boolean
}

/**
 * Store for the Instance Edit Panel
 * This used to use tanstack/react-form, but that was challenging because of the complex flows and changing form fields, often leaving the form in an invalid state.
 * Instead, this uses MobX to manage the state of the form and the instance configuration in a more predictable way.
 */
export class InstanceEditPanelStore<TConfig extends ClientInstanceConfigBase> {
	readonly service: InstanceEditPanelService<TConfig>
	readonly instanceInfo: TConfig

	#isLoading = observable.box<string | null>(null)
	#loadError = observable.box<string | null>(null)

	#configAndSecrets = observable.box<InstanceConfigAndSecrets | null>(null)

	#basicChanges = observable.box<InstanceBasicInfoChanges>({})

	get configAndSecrets(): InstanceConfigAndSecrets | null {
		return this.#configAndSecrets.get()
	}

	get loadError(): string | null {
		return this.#loadError.get()
	}

	get isLoading(): boolean {
		return this.#isLoading.get() !== null
	}

	constructor(service: InstanceEditPanelService<TConfig>, instanceInfo: TConfig) {
		this.service = service
		this.instanceInfo = instanceInfo

		this.triggerReload()
	}

	unloadConfigAndSecrets = action(() => {
		this.#isLoading.set(null)
		this.#configAndSecrets.set(null)
		this.#loadError.set(null)
	})

	triggerReload = (retryCount = 0): void => {
		if (this.#isLoading.get() && retryCount === 0) return

		const loadingId = nanoid()

		runInAction(() => {
			this.#isLoading.set(loadingId)
			this.#configAndSecrets.set(null)
			this.#loadError.set(null)
		})

		this.service
			.fetchConfig()
			.then((data) => {
				runInAction(() => {
					const currentLoadingId = this.#isLoading.get()
					// If the loading ID has changed, this means that a new reload has been triggered
					if (currentLoadingId !== loadingId) return

					if (!data) {
						if (retryCount > 5) {
							this.#isLoading.set(null)
							this.#configAndSecrets.set(null)
							this.#loadError.set('Connection not found or not running')
						} else {
							setTimeout(() => {
								if (this.#isLoading.get() !== loadingId) return
								this.triggerReload(retryCount + 1)
							}, 500)
						}
					} else {
						this.#isLoading.set(null)
						this.#configAndSecrets.set({
							fields: data.fields,

							useNewLayout: data.useNewLayout,

							config: data.config as CompanionOptionValues,
							configDirty: false,
							secrets: data.secrets as CompanionOptionValues,
							secretsDirty: false,
						})
					}
				})
			})
			.catch((err) => {
				runInAction(() => {
					const currentLoadingId = this.#isLoading.get()
					// If the loading ID has changed, this means that a new reload has been triggered
					if (currentLoadingId !== loadingId) return

					this.#isLoading.set(null)
					this.#loadError.set(err.message)
					this.#configAndSecrets.set(null)
				})
			})
	}

	isDirty = computedFn((): boolean => {
		const basicChanges = this.#basicChanges.get()
		if (Object.keys(basicChanges).length > 0) {
			return true
		}

		// Check if the config or secrets have changed
		const configAndSecrets = this.#configAndSecrets.get()
		if (configAndSecrets) {
			if (configAndSecrets.configDirty || configAndSecrets.secretsDirty) {
				return true
			}
		}

		return false
	})

	isValid = computedFn(() => {
		if (!this.checkLabelIsValid(this.labelValue)) return false

		// Validate the config and secrets
		const configAndSecrets = this.#configAndSecrets.get()
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
			const configAndSecrets = this.#configAndSecrets.get()
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
			return !validateInputValue(field, configAndSecrets.config[field.id])
		} else {
			return !validateInputValue(field, configAndSecrets.secrets[field.id])
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

	setConfigValue = action((fieldId: string, value: any) => {
		const configAndSecrets = this.#configAndSecrets.get()
		if (!configAndSecrets) return

		const field = configAndSecrets.fields.find((f) => f.id === fieldId)
		if (!field) return

		if (isConfigFieldSecret(field)) {
			configAndSecrets.secrets[fieldId] = value
			configAndSecrets.secretsDirty = true
		} else {
			configAndSecrets.config[fieldId] = value
			configAndSecrets.configDirty = true
		}
	})
}

export function isConfigFieldSecret(field: SomeCompanionInputField): boolean {
	return field.type.startsWith('secret')
}
