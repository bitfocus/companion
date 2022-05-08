import * as ModuleApi from '@companion-module/base'
import { EventEmitter } from 'events'
import type {
	CompanionActionEvent,
	CompanionBankPreset,
	CompanionFeedbackAdvanced,
	CompanionFeedbackBoolean,
	CompanionFeedbackEvent,
	CompanionPreset,
} from '../instance_skel_types'
import type InstanceSkel = require('../instance_skel')
import { assertNever, literal } from '@companion-module/base'
import { ServiceRest } from './rest.js'

// @ts-expect-error Not typescript
import Image from '../../lib/Graphics/Image.js'

/**
 * Make all optional properties be required and `| undefined`
 * This is useful to ensure that no property is missed, when manually converting between types, but allowing fields to be undefined
 */
type Complete<T> = {
	[P in keyof Required<T>]: Pick<T, P> extends Required<Pick<T, P>> ? T[P] : T[P] | undefined
}

function wrapActionSubscriptionCallback(
	id: string,
	cb: ((event: CompanionActionEvent) => void) | undefined
): ((action: ModuleApi.CompanionActionInfo) => void) | undefined {
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

function wrapFeedbackSubscriptionCallback(
	id: string,
	cb: ((event: CompanionFeedbackEvent) => void) | undefined
): ((action: ModuleApi.CompanionFeedbackEvent) => void) | undefined {
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
		this.parent.updateStatus(level, message)
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
		return this.parent.getAllFeedbacks().map((fb) => ({
			id: fb.id,
			type: fb.feedbackId,
			options: fb.options,
		}))
	}

	subscribeFeedbacks: InstanceSkel<any>['subscribeFeedbacks'] = (type) => {
		this.parent.subscribeFeedbacks(type)
	}

	unsubscribeFeedbacks: InstanceSkel<any>['unsubscribeFeedbacks'] = (type) => {
		this.parent.unsubscribeFeedbacks(type)
	}

	getAllActions: InstanceSkel<any>['getAllActions'] = () => {
		return this.parent.getAllActions().map((act) => ({
			id: act.id,
			action: act.actionId,
			options: act.options,
		}))
	}

	subscribeActions: InstanceSkel<any>['subscribeActions'] = (type) => {
		this.parent.subscribeActions(type)
	}

	unsubscribeActions: InstanceSkel<any>['unsubscribeActions'] = (type) => {
		this.parent.unsubscribeActions(type)
	}

	oscSend: InstanceSkel<any>['oscSend'] = (host, port, path, args) => {
		this.parent.oscSend(host, port, path, args).catch((e) => {
			this.parent.log('debug', `oscSend failed: ${e?.message ?? e}`)
		})
	}

	// setActions: InstanceSkel<any>['setActions'] = (actions) => {
	setActions = (actions: Parameters<InstanceSkel<any>['setActions']>[0], defaultHandler: any) => {
		const newActions: ModuleApi.CompanionActions = {}

		for (const [id, action] of Object.entries(actions)) {
			if (action) {
				const rawCb = action.callback ?? defaultHandler
				const cb: ModuleApi.CompanionAction['callback'] = (event) => {
					if (rawCb) {
						rawCb(
							{
								id: event.actionId,
								action: id,
								options: event.options ?? {},
							},
							{
								deviceId: event.deviceId,
								page: event.page,
								bank: event.bank,
							}
						)
					}
				}

				newActions[id] = literal<Complete<ModuleApi.CompanionAction>>({
					name: action.label,
					description: action.description,
					options: action.options ?? [],
					callback: cb,
					subscribe: wrapActionSubscriptionCallback(id, action.subscribe),
					unsubscribe: wrapActionSubscriptionCallback(id, action.unsubscribe),
				})
			}
		}

		this.parent.setActionDefinitions(newActions).catch((e) => {
			this.parent.log('warn', `setActionDefinitions failed: ${e?.message ?? e}`)
		})
	}

	// setFeedbackDefinitions: InstanceSkel<any>['setFeedbackDefinitions'] = (feedbacks) => {
	setFeedbackDefinitions = (
		feedbacks: Parameters<InstanceSkel<any>['setFeedbackDefinitions']>[0],
		defaultHandler: any
	) => {
		const newFeedbacks: ModuleApi.CompanionFeedbacks = {}

		for (const [id, feedback] of Object.entries(feedbacks)) {
			if (feedback) {
				switch (feedback.type) {
					case 'boolean': {
						const rawCb = (feedback.callback ?? defaultHandler) as CompanionFeedbackBoolean['callback']
						const cb: ModuleApi.CompanionFeedbackBoolean['callback'] = (event) => {
							if (rawCb) {
								return rawCb(
									{
										id: event.feedbackId,
										type: id,
										options: event.options ?? {},
									},
									event.rawBank,
									null
								)
							} else {
								return false
							}
						}

						newFeedbacks[id] = literal<Complete<ModuleApi.CompanionFeedbackBoolean>>({
							type: 'boolean',
							name: feedback.label,
							description: feedback.description,
							options: feedback.options ?? [],
							defaultStyle: feedback.style,
							callback: cb,
							subscribe: wrapFeedbackSubscriptionCallback(id, feedback.subscribe),
							unsubscribe: wrapFeedbackSubscriptionCallback(id, feedback.unsubscribe),
						})
						break
					}
					case 'advanced':
					case undefined:
					default: {
						const rawCb = (feedback.callback ?? defaultHandler) as CompanionFeedbackAdvanced['callback']
						const cb: ModuleApi.CompanionFeedbackAdvanced['callback'] = (event) => {
							if (rawCb) {
								return rawCb(
									{
										id: event.feedbackId,
										type: id,
										options: event.options ?? {},
									},
									event.rawBank,
									{
										page: event.page,
										bank: event.bank,
										width: event.image?.width ?? 72,
										height: event.image?.height ?? 72,
									}
								)
							} else {
								return {}
							}
						}

						newFeedbacks[id] = literal<Complete<ModuleApi.CompanionFeedbackAdvanced>>({
							type: 'advanced',
							name: feedback.label,
							description: feedback.description,
							options: feedback.options ?? [],
							callback: cb,
							subscribe: wrapFeedbackSubscriptionCallback(id, feedback.subscribe),
							unsubscribe: wrapFeedbackSubscriptionCallback(id, feedback.unsubscribe),
						})
						break
					}
				}
			}
		}

		this.parent.setFeedbackDefinitions(newFeedbacks).catch((e) => {
			this.parent.log('warn', `setFeedbackDefinitions failed: ${e?.message ?? e}`)
		})
	}

	setPresetDefinitions: InstanceSkel<any>['setPresetDefinitions'] = (presets) => {
		const newPresets: ModuleApi.SomeCompanionPreset[] = []

		function convertPresetAction(action: CompanionPreset['actions'][0]): Complete<ModuleApi.CompanionPresetAction> {
			return {
				actionId: action.action,
				options: action.options ?? {},
			}
		}
		function convertPresetFeedback(
			feedback: CompanionPreset['feedbacks'][0]
		): Complete<ModuleApi.CompanionPresetFeedback> {
			return {
				feedbackId: feedback.type,
				options: feedback.options ?? {},
				style: feedback.style,
			}
		}
		function convertPresetBank<T extends string>(
			t: T,
			bank: CompanionBankPreset
		): Complete<ModuleApi.CompanionBankPresetBase<T>> {
			const res = {
				style: t,
				text: bank.text,
				size: bank.size,
				color: bank.color,
				bgcolor: bank.bgcolor,
				alignment: bank.alignment,
				png64: bank.png64,
				pngalignment: bank.pngalignment,
				relative_delay: bank.relative_delay,
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

		for (const preset of presets) {
			if (preset.bank.latch) {
				newPresets.push(
					literal<ModuleApi.CompanionPresetStepped>({
						category: preset.category,
						label: preset.label,
						bank: {
							...convertPresetBank('step', preset.bank),
							step_auto_progress: true,
						},
						feedbacks: preset.feedbacks?.map(convertPresetFeedback) ?? [],
						action_sets: {
							[0]: preset.actions?.map(convertPresetAction) ?? [],
							[1]: preset.release_actions?.map(convertPresetAction) ?? [],
						},
					})
				)
			} else {
				newPresets.push(
					literal<ModuleApi.CompanionPresetPress>({
						category: preset.category,
						label: preset.label,
						bank: convertPresetBank('press', preset.bank),
						feedbacks: preset.feedbacks?.map(convertPresetFeedback) ?? [],
						action_sets: {
							down: preset.actions?.map(convertPresetAction) ?? [],
							up: preset.release_actions?.map(convertPresetAction) ?? [],
						},
					})
				)
			}
		}

		this.parent.setPresetDefinitions(newPresets)
	}

	saveConfig = (config: any) => {
		this.parent.saveConfig(config).catch((e) => {
			this.parent.log('warn', `saveConfig failed: ${e?.message ?? e}`)
		})
	}

	setVariableDefinitions: InstanceSkel<any>['setVariableDefinitions'] = (variables) => {
		const newVariables: ModuleApi.CompanionVariable[] = []

		for (const variable of variables) {
			newVariables.push({
				variableId: variable.name,
				name: variable.label,
			})
		}

		this.parent.setVariableDefinitions(newVariables).catch((e) => {
			this.parent.log('warn', `setVariableDefinitions failed: ${e?.message ?? e}`)
		})
	}

	setVariable: InstanceSkel<any>['setVariable'] = (variableId, value) => {
		this.setVariables({ [variableId]: value })
	}
	setVariables: InstanceSkel<any>['setVariables'] = (variables) => {
		const newValues: ModuleApi.CompanionVariableValue2[] = []

		for (const [id, value] of Object.entries(variables)) {
			newValues.push({
				variableId: id,
				value: value,
			})
		}

		this.parent.setVariableValues(newValues)
	}

	getVariable: InstanceSkel<any>['getVariable'] = (variableId, cb) => {
		const value = this.parent.getVariableValue(variableId)
		cb(value)
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
