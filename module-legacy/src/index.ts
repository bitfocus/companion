import {
	combineRgb,
	CompanionStaticUpgradeResult,
	CompanionStaticUpgradeScript,
	InstanceBase,
	runEntrypoint,
	SomeCompanionConfigField,
	splitRgb,
} from '@companion-module/base'
import { from15to32Keys, literal } from '@companion-module/base/dist/util'
import type InstanceSkel = require('../instance_skel')
import type {
	CompanionStaticUpgradeScript as CompanionStaticUpgradeScriptOld,
	CompanionUpgradeContext as CompanionUpgradeContextOld,
	CompanionMigrationAction as CompanionMigrationActionOld,
	CompanionMigrationFeedback as CompanionMigrationFeedbackOld,
} from '../instance_skel_types'
import { FakeSystem } from './fakeSystem.js'

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

	async init(config: MockConfig): Promise<void> {
		if (this.#legacy) throw new Error('Already initialized')

		this.#legacy = new LegacyModule(this.#system, this.id, config)
		if (!this.#legacy) throw new Error('Failed to initialize')

		if (typeof this.#legacy.init == 'function') {
			this.#legacy.init()
		}
	}
	destroy(): void | Promise<void> {
		if (!this.#legacy) throw new Error('Not yet initialized')

		this.#legacy.destroy()

		this.#system.destroy()
	}
	configUpdated(config: MockConfig): void | Promise<void> {
		if (!this.#legacy) throw new Error('Not yet initialized')

		this.#legacy.updateConfig(config)
	}
	getConfigFields(): SomeCompanionConfigField[] {
		if (!this.#legacy) throw new Error('Not yet initialized')
		return this.#legacy.config_fields() as SomeCompanionConfigField[]
	}
}

const UpgradeScripts: Array<CompanionStaticUpgradeScript<any>> = []
if (LegacyModule.GetUpgradeScripts) {
	const innerScripts: Array<CompanionStaticUpgradeScriptOld> = LegacyModule.GetUpgradeScripts()

	for (const fcn of innerScripts) {
		UpgradeScripts.push((_context, props) => {
			const tmpContext = _context as any

			const context: CompanionUpgradeContextOld = {
				convert15to32: from15to32Keys,
				rgb: combineRgb,
				rgbRev: splitRgb,
			}

			// TODO - translate config

			const actions2: CompanionMigrationActionOld[] = props.actions.map((act) => ({
				id: act.id,
				action: act.actionId,
				instance: tmpContext.instanceId,
				label: `${tmpContext.instanceId}:${act.actionId}`,
				options: act.options,
			}))
			const feedbacks2: CompanionMigrationFeedbackOld[] = props.feedbacks.map((fb) => ({
				id: fb.id,
				type: fb.feedbackId,
				instance_id: tmpContext.instanceId,
				options: fb.options,
			}))

			const changed = fcn(context, props.config, actions2, feedbacks2)

			if (changed) {
				return literal<CompanionStaticUpgradeResult<any>>({
					updatedConfig: props.config,
					updatedActions: actions2.map((act) => ({
						id: act.id,
						controlId: '',
						actionId: act.action,
						options: act.options,
					})),
					updatedFeedbacks: feedbacks2.map((fb) => ({
						id: fb.id,
						controlId: '',
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
