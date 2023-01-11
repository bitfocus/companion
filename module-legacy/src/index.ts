import {
	combineRgb,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	InstanceBase,
	runEntrypoint,
	splitRgb,
	SomeCompanionConfigField,
} from '@companion-module/base'
import { CompanionHTTPRequest, CompanionHTTPResponse } from '@companion-module/base/dist/module-api/http'
import { literal } from '@companion-module/base/dist/util.js'
import type InstanceSkel = require('../instance_skel')
import type {
	CompanionStaticUpgradeScript as CompanionStaticUpgradeScriptOld,
	CompanionUpgradeContext as CompanionUpgradeContextOld,
	CompanionMigrationAction as CompanionMigrationActionOld,
	CompanionMigrationFeedback as CompanionMigrationFeedbackOld,
	SomeCompanionConfigField as SomeCompanionConfigFieldOld,
} from '../instance_skel_types'
import { convertInputField, FakeSystem } from './fakeSystem.js'

// @ts-ignore
const modName = global.moduleName
// @ts-ignore
const LegacyModule = global.moduleFactory

if (!modName || !LegacyModule) throw new Error('Missing globals!')

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MockConfig {}

export default class MockModule extends InstanceBase<MockConfig> {
	#legacy: InstanceSkel<MockConfig> | undefined
	readonly #system: FakeSystem

	constructor(internal: unknown) {
		super(internal)

		this.#system = new FakeSystem(this, modName)
	}

	async handleHttpRequest2(req: CompanionHTTPRequest): Promise<CompanionHTTPResponse> {
		if (!this.#legacy?.handleHttpRequest) throw new Error('handleHttpRequest has disappeared!')
		return this.#legacy.handleHttpRequest(req)
	}

	async init(config: MockConfig, isFirstInit: boolean): Promise<void> {
		if (this.#legacy) throw new Error('Already initialized')

		this.#legacy = new LegacyModule(this.#system, this.id, config)
		if (!this.#legacy) throw new Error('Failed to initialize')

		if (this.#legacy.handleHttpRequest) {
			// Setup the http request handler, if it is implemented
			this.handleHttpRequest = this.handleHttpRequest2.bind(this)
		}

		if (typeof this.#legacy.init == 'function') {
			// Match behaviour of 2.x, and log but ignore any errors during init()
			try {
				this.#legacy.init()
			} catch (e: any) {
				this.log('error', 'Error initalizing module: ' + (e?.message ?? String(e)))
			}
		}

		// Ensure config fields are defined.
		// Approximates the behaviour from before of it being done after the first `init()` call, by the user clicking save
		if (isFirstInit) {
			const newConfig: any = this.#legacy.config
			const fields = this.getConfigFields()
			for (const field of fields) {
				if ('default' in field && newConfig[field.id] === undefined) {
					newConfig[field.id] = field.default
				}
			}
			config = newConfig as MockConfig
			this.saveConfig(config)
			try {
				this.#legacy.updateConfig(config)
			} catch (e: any) {
				this.log('error', 'Error updating instance config: ' + (e?.message ?? String(e)))
			}
		}
	}
	async destroy(): Promise<void> {
		if (!this.#legacy) throw new Error('Not yet initialized')

		this.#legacy.destroy()

		this.#system.destroy()
	}
	async configUpdated(config: MockConfig): Promise<void> {
		if (!this.#legacy) throw new Error('Not yet initialized')

		this.#legacy.updateConfig(config)
	}
	getConfigFields(): SomeCompanionConfigField[] {
		if (!this.#legacy) return []
		const rawFields = this.#legacy.config_fields()

		return rawFields.map((input) => {
			const input2 = input as SomeCompanionConfigFieldOld
			return {
				...(convertInputField(input2) as SomeCompanionConfigField),
				width: input2.width,
			}
		})
	}
}

function from15to32Keys(key: number): number {
	key = key - 1

	const rows = Math.floor(key / 5)
	const col = (key % 5) + 1
	const res = rows * 8 + col

	if (res >= 32) {
		//debug('from15to32: assert: old config had bigger pages than expected')
		return 31
	}
	return res
}

const UpgradeScripts: Array<CompanionStaticUpgradeScript<any>> = []
if (LegacyModule.GetUpgradeScripts) {
	const innerScripts: Array<CompanionStaticUpgradeScriptOld> = LegacyModule.GetUpgradeScripts() || []

	for (const fcn of innerScripts) {
		UpgradeScripts.push((_context, props) => {
			const tmpContext = _context as any

			const context: CompanionUpgradeContextOld = {
				convert15to32: from15to32Keys,
				rgb: combineRgb,
				rgbRev: splitRgb,
			}

			// TODO - translate config

			const actionControlIds = new Map<string, string>()
			const feedbackControlIds = new Map<string, string>()

			const actions2: CompanionMigrationActionOld[] = props.actions.map((act) => {
				actionControlIds.set(act.id, act.controlId)
				return {
					id: act.id,
					action: act.actionId,
					instance: tmpContext.instanceId,
					label: `${tmpContext.instanceId}:${act.actionId}`,
					options: act.options,
				}
			})
			const feedbacks2: CompanionMigrationFeedbackOld[] = props.feedbacks.map((fb) => {
				feedbackControlIds.set(fb.id, fb.controlId)
				return {
					id: fb.id,
					type: fb.feedbackId,
					instance_id: tmpContext.instanceId,
					options: fb.options,
				}
			})

			const changed = fcn(context, props.config, actions2, feedbacks2)

			if (changed) {
				return literal<CompanionStaticUpgradeResult<any>>({
					updatedConfig: props.config,
					updatedActions: actions2.map((act) => ({
						id: act.id,
						controlId: actionControlIds.get(act.id) || '',
						actionId: act.action,
						options: act.options,
					})),
					updatedFeedbacks: feedbacks2.map((fb) => ({
						id: fb.id,
						controlId: feedbackControlIds.get(fb.id) || '',
						feedbackId: fb.type,
						options: fb.options,
					})),
				})
			} else {
				return literal<CompanionStaticUpgradeResult<any>>({
					updatedConfig: null,
					updatedActions: [],
					updatedFeedbacks: [],
				})
			}
		})
	}
}

runEntrypoint(MockModule, UpgradeScripts)
