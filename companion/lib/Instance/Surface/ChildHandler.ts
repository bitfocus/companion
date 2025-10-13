import type { InstanceConfig } from '@companion-app/shared/Model/Instance.js'
import type { ChildProcessHandlerBase } from '../ProcessManager.js'

export class SurfaceChildHandler implements ChildProcessHandlerBase {
	async init(_config: InstanceConfig): Promise<void> {
		throw new Error('Method not implemented.')
	}
	async destroy(): Promise<void> {
		throw new Error('Method not implemented.')
	}
	cleanup(): void {
		throw new Error('Method not implemented.')
	}
}
