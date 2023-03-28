import * as ModuleApi from '@companion-module/base'
import { EventEmitter } from 'events'
import type {
	CompanionActionEvent,
	CompanionBankPreset,
	CompanionFeedbackAdvanced,
	CompanionFeedbackBoolean,
	CompanionFeedbackEvent,
	CompanionInputField,
	CompanionPreset,
	SomeCompanionInputField,
} from '../instance_skel_types'
import type InstanceSkel = require('../instance_skel')
import { assertNever, literal, InstanceStatus } from '@companion-module/base'
import { ServiceRest } from './rest.js'

// @ts-expect-error Not typescript
import Image from '../../lib/Graphics/Image.js'
import { nanoid } from 'nanoid'

/**
 * Make all optional properties be required and `| undefined`
 * This is useful to ensure that no property is missed, when manually converting between types, but allowing fields to be undefined
 */
type Complete<T> = {
	[P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : T[P] | undefined
}

function convertPresetAction(action: CompanionPreset['actions'][0]): Complete<ModuleApi.CompanionPresetAction> {
	return {
		actionId: action.action,
		delay: action.delay,
		options: action.options ?? {},
	}
}
function convertPresetFeedback(feedback: CompanionPreset['feedbacks'][0]): Complete<ModuleApi.CompanionPresetFeedback> {
	return {
		feedbackId: feedback.type,
		options: feedback.options ?? {},
		style: feedback.style,
	}
}
function convertPresetBank(bank: CompanionBankPreset): Complete<ModuleApi.CompanionButtonStyleProps> {
	const res: Complete<ModuleApi.CompanionButtonStyleProps> = {
		text: bank.text,
		size: bank.size,
		color: bank.color,
		bgcolor: bank.bgcolor,
		alignment: bank.alignment,
		png64: bank.png64,
		pngalignment: bank.pngalignment,
	}

	// Fix up some pre 2.0 styles
	const legacyStyle = bank.style as string
	if (legacyStyle == 'bigtext') {
		res.size = '14'
	} else if (legacyStyle == 'smalltext') {
		res.size = '7'
	}

	return res
}
function convertInputFieldBase(input: CompanionInputField): Complete<Omit<ModuleApi.CompanionInputFieldBase, 'type'>> {
	return {
		id: input.id,
		label: input.label,
		tooltip: input.tooltip,
		isVisible: input.isVisible,
	}
}

export function convertInputField(input: SomeCompanionInputField): Complete<ModuleApi.CompanionInputFieldBase> {
	const inputType = input.type
	switch (input.type) {
		case 'text':
			return literal<Complete<ModuleApi.CompanionInputFieldStaticText>>({
				...convertInputFieldBase(input),
				type: 'static-text',
				value: input.value,
			})
		case 'textinput':
			return literal<Complete<ModuleApi.CompanionInputFieldTextInput>>({
				...convertInputFieldBase(input),
				type: 'textinput',
				default: input.default,
				required: input.required,
				regex: input.regex,
				useVariables: false,
			})
		case 'textwithvariables':
			return literal<Complete<ModuleApi.CompanionInputFieldTextInput>>({
				...convertInputFieldBase(input),
				type: 'textinput',
				default: input.default,
				required: undefined,
				regex: undefined,
				useVariables: true,
			})
		case 'number':
			return literal<Complete<ModuleApi.CompanionInputFieldNumber>>({
				...convertInputFieldBase(input),
				type: 'number',
				default: input.default,
				min: input.min,
				max: input.max,
				step: input.step,
				range: input.range,
				required: input.required,
			})
		case 'colorpicker':
			return literal<Complete<ModuleApi.CompanionInputFieldColor>>({
				...convertInputFieldBase(input),
				type: 'colorpicker',
				default: input.default,
			})
		case 'checkbox':
			return literal<Complete<ModuleApi.CompanionInputFieldCheckbox>>({
				...convertInputFieldBase(input),
				type: 'checkbox',
				default: input.default,
			})
		case 'dropdown':
			if (input.multiple) {
				return literal<Complete<ModuleApi.CompanionInputFieldMultiDropdown>>({
					...convertInputFieldBase(input),
					type: 'multidropdown',
					choices: input.choices,
					default: input.default,
					minChoicesForSearch: input.minChoicesForSearch,
					minSelection: input.minSelection,
					maxSelection: input.maxSelection,
				})
			} else {
				return literal<Complete<ModuleApi.CompanionInputFieldDropdown>>({
					...convertInputFieldBase(input),
					type: 'dropdown',
					choices: input.choices,
					default: input.default,
					minChoicesForSearch: input.minChoicesForSearch,
					allowCustom: input.allowCustom,
					regex: input.regex,
				})
			}
		default:
			assertNever(input)
			return literal<Complete<ModuleApi.CompanionInputFieldStaticText>>({
				...convertInputFieldBase(input),
				type: 'static-text',
				value: `Unknown input field type "${inputType}"`,
			})
	}
}

function wrapActionSubscriptionCallback<T>(
	id: string,
	cb: ((event: CompanionActionEvent) => T) | undefined
): ((action: ModuleApi.CompanionActionInfo) => T) | undefined {
	if (cb) {
		return (event) =>
			cb({
				id: event.actionId,
				action: id,
				options: event.options ?? {},
			})
	} else {
		return undefined
	}
}

function wrapFeedbackSubscriptionCallback<T>(
	id: string,
	cb: ((event: CompanionFeedbackEvent) => T) | undefined
): ((feedback: ModuleApi.CompanionFeedbackInfo) => T) | undefined {
	if (cb) {
		return (event) =>
			cb({
				id: event.feedbackId,
				type: id,
				options: event.options ?? {},
			})
	} else {
		return undefined
	}
}

export class FakeSystem extends EventEmitter {
	#rest: ServiceRest

	readonly Image = Image

	constructor(public readonly parent: ModuleApi.InstanceBase<any>, moduleName: string) {
		super()

		this.#rest = new ServiceRest(this, moduleName)
	}

	destroy() {
		this.#rest.destroy()
	}

	sendStatus: InstanceSkel<any>['status'] = (level, message) => {
		if (typeof message === 'string') {
			// Attempt to tidy up some common statuses
			const messageSafe = message.trim().toLowerCase()
			switch (messageSafe) {
				case 'connecting':
					this.parent.updateStatus(InstanceStatus.Connecting)
					return
				case 'disconnected':
					this.parent.updateStatus(InstanceStatus.Disconnected)
					return
			}
		}

		switch (level) {
			case 0:
				this.parent.updateStatus(InstanceStatus.Ok, message)
				break
			case 1:
				this.parent.updateStatus(InstanceStatus.UnknownWarning, message)
				break
			case 2:
				this.parent.updateStatus(InstanceStatus.UnknownError, message)
				break
			case null:
			case 0:
				this.parent.updateStatus(InstanceStatus.UnknownWarning, message)
				break
			default:
				assertNever(level)
				this.parent.updateStatus(InstanceStatus.UnknownWarning, message)
				break
		}
	}

	sendLog: InstanceSkel<any>['log'] = (level, info) => {
		switch (level) {
			case 'debug':
			case 'info':
			case 'warn':
			case 'error':
				this.parent.log(level, info)
				break
			default:
				this.parent.log('info', info)
				assertNever(level)
				break
		}
	}

	checkFeedbacks: InstanceSkel<any>['checkFeedbacks'] = (...types) => {
		this.parent.checkFeedbacks(...types)
	}

	checkFeedbacksById: InstanceSkel<any>['checkFeedbacksById'] = (...ids) => {
		this.parent.checkFeedbacksById(...ids)
	}

	getAllFeedbacks: InstanceSkel<any>['getAllFeedbacks'] = () => {
		return this.parent._getAllFeedbacks().map((fb) => ({
			id: fb.id,
			type: fb.feedbackId,
			options: fb.options,
		}))
	}

	subscribeFeedbacks: InstanceSkel<any>['subscribeFeedbacks'] = (type) => {
		const args = type ? [type] : []
		this.parent.subscribeFeedbacks(...args)
	}

	unsubscribeFeedbacks: InstanceSkel<any>['unsubscribeFeedbacks'] = (type) => {
		const args = type ? [type] : []
		this.parent.unsubscribeFeedbacks(...args)
	}

	getAllActions: InstanceSkel<any>['getAllActions'] = () => {
		return this.parent._getAllActions().map((act) => ({
			id: act.id,
			action: act.actionId,
			options: act.options,
		}))
	}

	subscribeActions: InstanceSkel<any>['subscribeActions'] = (type) => {
		const args = type ? [type] : []
		this.parent.subscribeActions(...args)
	}

	unsubscribeActions: InstanceSkel<any>['unsubscribeActions'] = (type) => {
		const args = type ? [type] : []
		this.parent.unsubscribeActions(...args)
	}

	oscSend: InstanceSkel<any>['oscSend'] = (host, port, path, args) => {
		this.parent.oscSend(host, port, path, args)
	}

	// setActions: InstanceSkel<any>['setActions'] = (actions) => {
	setActions = (actions: Parameters<InstanceSkel<any>['setActions']>[0], defaultHandler: any) => {
		const newActions: ModuleApi.CompanionActionDefinitions = {}

		for (const [id, action] of Object.entries(actions)) {
			if (action) {
				const rawCb = action.callback ?? defaultHandler
				const cb: ModuleApi.CompanionActionDefinition['callback'] = (event) => {
					if (rawCb) {
						rawCb(
							{
								id: event.actionId,
								action: id,
								options: event.options ?? {},
							},
							{
								deviceId: event._deviceId,
								page: event._page,
								bank: event._bank,
							}
						)
					}
				}

				newActions[id] = literal<Complete<ModuleApi.CompanionActionDefinition>>({
					name: action.label,
					description: action.description,
					options: (action.options ?? []).map(convertInputField) as ModuleApi.SomeCompanionActionInputField[],
					callback: cb,
					subscribe: wrapActionSubscriptionCallback(id, action.subscribe),
					unsubscribe: wrapActionSubscriptionCallback(id, action.unsubscribe),
					learn: wrapActionSubscriptionCallback(id, action.learn),
				})
			}
		}

		this.parent.setActionDefinitions(newActions)
	}

	// setFeedbackDefinitions: InstanceSkel<any>['setFeedbackDefinitions'] = (feedbacks) => {
	setFeedbackDefinitions = (
		feedbacks: Parameters<InstanceSkel<any>['setFeedbackDefinitions']>[0],
		defaultHandler: any
	) => {
		const newFeedbacks: ModuleApi.CompanionFeedbackDefinitions = {}

		for (const [id, feedback] of Object.entries(feedbacks)) {
			if (feedback) {
				switch (feedback.type) {
					case 'boolean': {
						const rawCb = (feedback.callback ?? defaultHandler) as CompanionFeedbackBoolean['callback']
						const cb: ModuleApi.CompanionBooleanFeedbackDefinition['callback'] = (event) => {
							if (rawCb) {
								return rawCb(
									{
										id: event.feedbackId,
										type: id,
										options: event.options ?? {},
									},
									event._rawBank,
									null
								)
							} else {
								return false
							}
						}

						newFeedbacks[id] = literal<Complete<ModuleApi.CompanionBooleanFeedbackDefinition>>({
							type: 'boolean',
							name: feedback.label,
							description: feedback.description,
							options: (feedback.options ?? []).map(convertInputField) as ModuleApi.SomeCompanionFeedbackInputField[],
							defaultStyle: feedback.style,
							callback: cb,
							subscribe: wrapFeedbackSubscriptionCallback(id, feedback.subscribe),
							unsubscribe: wrapFeedbackSubscriptionCallback(id, feedback.unsubscribe),
							learn: wrapFeedbackSubscriptionCallback(id, feedback.learn),
						})
						break
					}
					case 'advanced':
					case undefined:
					default: {
						const rawCb = (feedback.callback ?? defaultHandler) as CompanionFeedbackAdvanced['callback']
						const cb: ModuleApi.CompanionAdvancedFeedbackDefinition['callback'] = (event) => {
							if (rawCb) {
								return rawCb(
									{
										id: event.feedbackId,
										type: id,
										options: event.options ?? {},
									},
									event._rawBank,
									{
										page: event._page,
										bank: event._bank,
										width: event.image?.width ?? 72,
										height: event.image?.height ?? 72,
									}
								)
							} else {
								return {}
							}
						}

						newFeedbacks[id] = literal<Complete<ModuleApi.CompanionAdvancedFeedbackDefinition>>({
							type: 'advanced',
							name: feedback.label,
							description: feedback.description,
							options: (feedback.options ?? []).map(convertInputField) as ModuleApi.SomeCompanionFeedbackInputField[],
							callback: cb,
							subscribe: wrapFeedbackSubscriptionCallback(id, feedback.subscribe),
							unsubscribe: wrapFeedbackSubscriptionCallback(id, feedback.unsubscribe),
							learn: wrapFeedbackSubscriptionCallback(id, feedback.learn),
						})
						break
					}
				}
			}
		}

		this.parent.setFeedbackDefinitions(newFeedbacks)
	}

	setPresetDefinitions: InstanceSkel<any>['setPresetDefinitions'] = (presets) => {
		const newPresets: ModuleApi.CompanionPresetDefinitions = {}

		presets.forEach((preset, index) => {
			let steps: ModuleApi.CompanionButtonPresetDefinition['steps'] = []
			if (preset.bank.latch) {
				steps = [
					{
						down: preset.actions?.map(convertPresetAction) ?? [],
						up: [],
					},
					{
						down: preset.release_actions?.map(convertPresetAction) ?? [],
						up: [],
					},
				]
			} else {
				steps = [
					{
						down: preset.actions?.map(convertPresetAction) ?? [],
						up: preset.release_actions?.map(convertPresetAction) ?? [],
					},
				]
			}
			newPresets[index] = literal<ModuleApi.CompanionButtonPresetDefinition>({
				category: preset.category,
				name: preset.label,
				type: 'button',
				style: convertPresetBank(preset.bank),
				options: {
					relativeDelay: preset.bank.relative_delay,
					stepAutoProgress: true,
				},
				feedbacks: preset.feedbacks?.map(convertPresetFeedback) ?? [],
				steps,
			})
		})

		this.parent.setPresetDefinitions(newPresets)
	}

	saveConfig = (config: any) => {
		this.parent.saveConfig(config)
	}

	setVariableDefinitions: InstanceSkel<any>['setVariableDefinitions'] = (variables) => {
		const newVariables: ModuleApi.CompanionVariableDefinition[] = []

		for (const variable of variables) {
			newVariables.push({
				variableId: variable.name,
				name: variable.label,
			})
		}

		this.parent.setVariableDefinitions(newVariables)
	}

	setVariable: InstanceSkel<any>['setVariable'] = (variableId, value) => {
		this.setVariables({ [variableId]: value })
	}
	setVariables: InstanceSkel<any>['setVariables'] = (variables) => {
		this.parent.setVariableValues(variables)
	}

	getVariable: InstanceSkel<any>['getVariable'] = (variableId, cb) => {
		const value = this.parent.getVariableValue(variableId)
		cb(value as any)
	}

	parseVariables: InstanceSkel<any>['parseVariables'] = (text, cb) => {
		// Note: this is now async, and not sync as it previously behaved. This will break some modules
		this.parent
			.parseVariablesInString(text)
			.then((res) => cb(res))
			.catch((e) => {
				this.parent.log('warn', `parseVariables failed: ${e?.message ?? e}`)
			})
	}
}
