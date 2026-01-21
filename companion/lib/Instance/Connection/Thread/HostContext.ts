import {
	createModuleLogger,
	type CompanionAdvancedFeedbackResult,
	type CompanionPresetDefinitions,
	type CompanionRecordedAction,
	type CompanionVariableValue,
	type Complete,
	type HostActionDefinition,
	type HostFeedbackDefinition,
	type HostFeedbackValue,
	type HostVariableDefinition,
	type HostVariableValue,
	type InstanceStatus,
	type ModuleHostContext,
	type OSCMetaArgument,
	type OSCSomeArguments,
	type SomeCompanionFeedbackInputField,
} from '@companion-module/host'
import type { EncodedOSCArgument, ModuleChildIpcWrapper, RecordActionMessage } from '../IpcTypesNew.js'
import { EntityModelType, isValidFeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { translateEntityInputFields } from './ConfigFields.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type {
	SharedUdpSocketMessageJoin,
	SharedUdpSocketMessageLeave,
	SharedUdpSocketMessageSend,
} from '@companion-module/base/host-api'
import { ConvertPresetDefinition } from './Presets.js'
import type { PresetDefinition } from '@companion-app/shared/Model/Presets.js'
import { uint8ArrayToBuffer } from '../../../Resources/Util.js'

/**
 * The context of methods and properties provided to the surfaces, which they can use to report events or make requests.
 */
export class HostContext<TConfig, TSecrets> implements ModuleHostContext<TConfig, TSecrets> {
	readonly #logger = createModuleLogger()
	readonly #ipcWrapper: ModuleChildIpcWrapper

	readonly #connectionId: string
	readonly #currentUpgradeIndex: number

	constructor(ipcWrapper: ModuleChildIpcWrapper, connectionId: string, currentUpgradeIndex: number) {
		this.#ipcWrapper = ipcWrapper
		this.#connectionId = connectionId
		this.#currentUpgradeIndex = currentUpgradeIndex
	}

	/** The connection status has changed */
	setStatus(status: InstanceStatus, message: string | null): void {
		this.#ipcWrapper.sendWithNoCb('set-status', { status, message })
	}
	/** The actions available in the connection have changed */
	setActionDefinitions(rawActions: HostActionDefinition[]): void {
		const actions: Record<string, ClientEntityDefinition> = {}

		for (const rawAction of rawActions) {
			actions[rawAction.id] = {
				entityType: EntityModelType.Action,
				label: rawAction.name,
				description: rawAction.description,
				options: translateEntityInputFields(rawAction.options || [], EntityModelType.Action),
				optionsToMonitorForInvalidations: rawAction.optionsToMonitorForSubscribe || null,
				hasLifecycleFunctions: !!rawAction.hasLifecycleFunctions,
				hasLearn: !!rawAction.hasLearn,
				learnTimeout: rawAction.learnTimeout,

				showInvert: false,
				showButtonPreview: false,
				supportsChildGroups: [],

				feedbackType: null,
				feedbackStyle: undefined,

				optionsSupportExpressions: false, // Future: follow up to enable for modules!
			} satisfies Complete<ClientEntityDefinition>
		}

		this.#ipcWrapper.sendWithNoCb('setActionDefinitions', { actions })
	}
	/** The feedbacks available in the connection have changed */
	setFeedbackDefinitions(rawFeedbacks: HostFeedbackDefinition[]): void {
		const feedbacks: Record<string, ClientEntityDefinition> = {}

		for (const rawFeedback of rawFeedbacks) {
			if (!isValidFeedbackEntitySubType(rawFeedback.type)) continue

			feedbacks[rawFeedback.id] = {
				entityType: EntityModelType.Feedback,
				label: rawFeedback.name,
				description: rawFeedback.description,
				options: translateEntityInputFields(rawFeedback.options || [], EntityModelType.Feedback),
				optionsToMonitorForInvalidations: null,
				feedbackType: rawFeedback.type,
				feedbackStyle: rawFeedback.defaultStyle,
				hasLifecycleFunctions: true, // Feedbacks always have lifecycle functions
				hasLearn: !!rawFeedback.hasLearn,
				learnTimeout: rawFeedback.learnTimeout,
				showInvert: rawFeedback.showInvert ?? shouldShowInvertForFeedback(rawFeedback.options || []),

				showButtonPreview: false,
				supportsChildGroups: [],

				optionsSupportExpressions: false, // Future: follow up to enable for modules!
			} satisfies Complete<ClientEntityDefinition>
		}

		this.#ipcWrapper.sendWithNoCb('setFeedbackDefinitions', { feedbacks })
	}
	/** The variables available in the connection have changed */
	setVariableDefinitions(definitions: HostVariableDefinition[], values: HostVariableValue[]): void {
		this.#ipcWrapper.sendWithNoCb('setVariableDefinitions', {
			variables: definitions.map((d) => ({ name: d.id, description: d.name })),
			newValues: values,
		})
	}
	/** The presets provided by the connection have changed */
	setPresetDefinitions(presets: CompanionPresetDefinitions): void {
		const convertedPresets: PresetDefinition[] = []

		for (const [id, rawPreset] of Object.entries(presets)) {
			if (!rawPreset) continue

			const convertedPreset = ConvertPresetDefinition(
				this.#logger,
				this.#connectionId,
				this.#currentUpgradeIndex,
				id,
				rawPreset
			)
			if (convertedPreset) convertedPresets.push(convertedPreset)
		}

		this.#ipcWrapper.sendWithNoCb('setPresetDefinitions', {
			presets: convertedPresets,
		})
	}
	/** The connection has some new values for variables */
	setVariableValues(values: HostVariableValue[]): void {
		this.#ipcWrapper.sendWithNoCb('setVariableValues', { newValues: values })
	}
	/** The connection has some new values for feedbacks it is running */
	updateFeedbackValues(values: HostFeedbackValue[]): void {
		// Transform advanced feedback imageBuffers from Uint8Array to base64 strings, to make them json serializable
		const safeValues: HostFeedbackValue[] = values.map((val) => {
			if (val.feedbackType === 'advanced' && val.value && typeof val.value === 'object') {
				const valueObject = val.value as CompanionAdvancedFeedbackResult
				if ('imageBuffer' in valueObject && valueObject.imageBuffer) {
					const imageBuffer = valueObject.imageBuffer as unknown // Do some type trickery, as the types say it can't be a Buffer, but we want to support that for now
					if (imageBuffer instanceof Uint8Array) {
						return {
							...val,
							value: {
								...valueObject,
								// Backwards compatibility fixup, ensure the imageBuffer is a string
								imageBuffer: uint8ArrayToBuffer(imageBuffer).toString('base64'),
							},
						}
					} else {
						return val
					}
				} else {
					return val
				}
			} else {
				return val
			}
		})

		this.#ipcWrapper.sendWithNoCb('updateFeedbackValues', { values: safeValues })
	}
	/** The connection has updated its config, which should be persisted */
	saveConfig(newConfig: TConfig | undefined, newSecrets: TSecrets | undefined): void {
		this.#ipcWrapper.sendWithNoCb('saveConfig', { config: newConfig, secrets: newSecrets })
	}
	/** Send an OSC message from the default osc listener in companion */
	sendOSC(host: string, port: number, path: string, args: OSCSomeArguments): void {
		const encodedArgs: EncodedOSCArgument[] = []

		if (args !== undefined && args !== null) {
			// Simplify as an array
			if (!Array.isArray(args)) args = [args as OSCMetaArgument]

			for (const arg of args) {
				if (typeof arg === 'string') {
					encodedArgs.push({ type: 's', value: arg })
				} else if (typeof arg === 'number') {
					encodedArgs.push({ type: 'f', value: arg })
				} else if (arg instanceof Uint8Array) {
					// Future: use native toBase64 when available
					encodedArgs.push({ type: 'b', value: uint8ArrayToBuffer(arg).toString('base64') })
				} else if (arg && typeof arg === 'object') {
					if (arg.type === 's' || arg.type === 'f' || arg.type === 'i') {
						encodedArgs.push(arg)
					} else if (arg.type === 'b' && arg.value instanceof Uint8Array) {
						// Future: use native toBase64 when available
						encodedArgs.push({ type: 'b', value: uint8ArrayToBuffer(arg.value).toString('base64') })
					} else {
						throw new Error(`Unsupported OSC argument type: ${JSON.stringify(arg)}`)
					}
				} else {
					throw new Error(`Unsupported OSC argument type: ${arg}`)
				}
			}
		}

		this.#ipcWrapper.sendWithNoCb('send-osc', { host, port, path, args: encodedArgs })
	}
	/** When the action-recorder is running, the module has recorded an action to add to the recorded stack */
	recordAction(action: CompanionRecordedAction, uniquenessId: string | undefined): void {
		this.#ipcWrapper.sendWithNoCb('recordAction', {
			uniquenessId: uniquenessId || null,
			actionId: action.actionId,
			options: action.options,
			delay: action.delay,
		} satisfies Complete<RecordActionMessage>)
	}
	/**
	 * The connection has a new value for a custom variable
	 * Note: This should only be used by a few internal modules, it is not intended for general use
	 */
	setCustomVariable(controlId: string, customVariableId: string, value: CompanionVariableValue | undefined): void {
		this.#ipcWrapper.sendWithNoCb('setCustomVariable', { controlId, customVariableId, value })
	}

	async sharedUdpSocketJoin(msg: SharedUdpSocketMessageJoin): Promise<string> {
		return this.#ipcWrapper.sendWithCb('sharedUdpSocketJoin', {
			family: msg.family,
			portNumber: msg.portNumber,
		})
	}
	async sharedUdpSocketLeave(msg: SharedUdpSocketMessageLeave): Promise<void> {
		await this.#ipcWrapper.sendWithCb('sharedUdpSocketLeave', { handleId: msg.handleId })
	}
	async sharedUdpSocketSend(msg: SharedUdpSocketMessageSend): Promise<void> {
		await this.#ipcWrapper.sendWithCb('sharedUdpSocketSend', {
			handleId: msg.handleId,
			message: msg.message.toString('base64'),
			address: msg.address,
			port: msg.port,
		})
	}
}

function shouldShowInvertForFeedback(options: SomeCompanionFeedbackInputField[]): boolean {
	for (const option of options) {
		if (option.type === 'checkbox' && (option.id === 'invert' || option.id === 'inverted')) {
			// It looks like there is already a matching field
			return false
		}
	}

	// Nothing looked to be a user defined invert field
	return true
}
