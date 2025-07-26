import { isLabelValid } from '@companion-app/shared/Label.js'
import { ClientConnectionConfig, ConnectionUpdatePolicy } from '@companion-app/shared/Model/Connections.js'
import type { ConnectionInputField } from '@companion-app/shared/Model/Options.js'
import type { CompanionOptionValues } from '@companion-module/base'
import { action, observable, runInAction, toJS } from 'mobx'
import { computedFn } from 'mobx-utils'
import { nanoid } from 'nanoid'
import { validateInputValue } from '~/Helpers/validateInputValue'
import { parseIsVisibleFn } from '~/Hooks/useOptionsAndIsVisible'
import { trpcClient } from '~/Resources/TRPC'

export interface ConnectionBasicInfoChanges {
	label?: string
	versionId?: string | null
	updatePolicy?: ConnectionUpdatePolicy
}
export interface ConnectionConfigAndSecrets {
	fields: Array<ConnectionInputField & { width: number }>

	config: CompanionOptionValues
	configDirty: boolean
	hasSecrets: Record<string, boolean>
	updatedSecrets: CompanionOptionValues
}

/**
 * Store for the Connection Edit Panel
 * This used to use tanstack/react-form, but that was challenging because of the complex flows and changing form fields, often leaving the form in an invalid state.
 * Instead, this uses MobX to manage the state of the form and the connection configuration in a more predictable way.
 */
export class ConnectionEditPanelStore {
	readonly connectionId: string
	readonly connectionInfo: ClientConnectionConfig

	#isLoading = observable.box<string | null>(null)
	#loadError = observable.box<string | null>(null)

	#configAndSecrets = observable.box<ConnectionConfigAndSecrets | null>(null)

	#basicChanges = observable.box<ConnectionBasicInfoChanges>({})

	get configAndSecrets(): ConnectionConfigAndSecrets | null {
		return this.#configAndSecrets.get()
	}

	get loadError(): string | null {
		return this.#loadError.get()
	}

	get isLoading(): boolean {
		return this.#isLoading.get() !== null
	}

	constructor(connectionId: string, connectionInfo: ClientConnectionConfig) {
		this.connectionId = connectionId
		this.connectionInfo = connectionInfo

		console.log('store factory', connectionId, connectionInfo)

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

		trpcClient.connections.edit
			.query({
				connectionId: this.connectionId,
			})
			.then((data) => {
				runInAction(() => {
					const currentLoadingId = this.#isLoading.get()
					// If the loading ID has changed, this means that a new reload has been triggered
					if (currentLoadingId !== loadingId) return

					if (!data) {
						if (retryCount > 5) {
							this.#isLoading.set(null)
							this.#configAndSecrets.set(null)
							this.#loadError.set('Connection not found or running')
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

							config: data.config as CompanionOptionValues,
							configDirty: false,
							hasSecrets: data.hasSecrets,
							updatedSecrets: {},
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
			if (configAndSecrets.configDirty || Object.keys(configAndSecrets.updatedSecrets).length > 0) {
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
					console.log('is valid', toJS(field), toJS(configAndSecrets))
					return false
				}
			}
		}

		return true
	})

	isVisibleFn = computedFn(parseIsVisibleFn)

	isVisible = computedFn((field: ConnectionInputField): boolean => {
		const isVisibleFn = this.isVisibleFn(field)
		if (isVisibleFn) {
			const configAndSecrets = this.#configAndSecrets.get()
			if (configAndSecrets) {
				return isVisibleFn(configAndSecrets.config)
			}
		}

		return true // If no isVisibleFn, assume visible
	})

	#isFieldValueValid(configAndSecrets: ConnectionConfigAndSecrets, field: ConnectionInputField): boolean {
		if (!this.isVisible(field)) {
			return true // If the field is not visible, it is considered valid
		}

		if (!isConfigFieldSecret(field)) {
			return !validateInputValue(field, configAndSecrets.config[field.id])
		} else {
			const hasChangedValue = field.id in configAndSecrets.updatedSecrets

			// Validate the value if it has changed
			if (hasChangedValue) {
				return !validateInputValue(field, configAndSecrets.updatedSecrets[field.id])
			}

			// If the secret has not changed, assume it is valid
			return true
		}
	}

	get labelValue(): string {
		return this.#basicChanges.get().label ?? this.connectionInfo.label
	}
	setLabelValue = action((value: string) => {
		this.#basicChanges.set({
			...this.#basicChanges.get(),
			label: value,
		})
	})
	checkLabelIsValid = (value: string): boolean => isLabelValid(value)

	get moduleVersionId(): string | null {
		return this.#basicChanges.get().versionId ?? this.connectionInfo.moduleVersionId
	}
	setModuleVersionId = action((value: string | null) => {
		this.#basicChanges.set({
			...this.#basicChanges.get(),
			versionId: value,
		})
	})

	get updatePolicy(): ConnectionUpdatePolicy {
		return this.#basicChanges.get().updatePolicy ?? (this.connectionInfo.updatePolicy || ConnectionUpdatePolicy.Manual)
	}
	setUpdatePolicy = action((value: ConnectionUpdatePolicy) => {
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
			configAndSecrets.updatedSecrets[fieldId] = value
		} else {
			configAndSecrets.config[fieldId] = value
			configAndSecrets.configDirty = true
		}
	})

	clearSecretValue = action((fieldId: string) => {
		const configAndSecrets = this.#configAndSecrets.get()
		if (!configAndSecrets) return

		delete configAndSecrets.updatedSecrets[fieldId]
	})
}

export function isConfigFieldSecret(field: ConnectionInputField): boolean {
	return field.type.startsWith('secret')
}
