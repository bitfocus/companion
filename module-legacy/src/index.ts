import { InstanceBase, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base'
import type InstanceSkel = require('../instance_skel')
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

	constructor(internal: unknown, id: string) {
		super(internal, id)

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

runEntrypoint(MockModule)
