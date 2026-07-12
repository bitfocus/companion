import type { ClientEditInstanceConfigState } from '@companion-app/shared/Model/Common.js'
import { type InstanceConfig, type ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { InstanceConfigStore } from './ConfigStore.js'
import type { InstanceController } from './Controller.js'

/**
 * Compute the current state of the config-fields editor for an instance (connection or surface).
 *
 * This owns all of the shared lifecycle reasoning that both types have in common: does the instance
 * exist, is it enabled (directly and via its collection), is a child process ready, and if not why
 * (still starting / crashed / a terminal 'system' error such as an incompatible module api version).
 */
export async function computeInstanceConfigState<TChild>(
	instanceController: InstanceController,
	configStore: InstanceConfigStore,
	moduleType: ModuleInstanceType,
	instanceId: string,
	getChild: () => TChild | undefined,
	loadRunningConfig: (
		child: TChild,
		instanceConf: InstanceConfig
	) => ClientEditInstanceConfigState | Promise<ClientEditInstanceConfigState>
): Promise<ClientEditInstanceConfigState> {
	const instanceConf = configStore.getConfigOfTypeForId(instanceId, moduleType)
	if (!instanceConf) return { type: 'notRunning', reason: 'missing' }

	// Not running because it is disabled directly, or its collection is disabled
	if (!instanceController.isInstanceEnabled(instanceConf)) return { type: 'notRunning', reason: 'disabled' }

	const child = getChild()
	if (!child) {
		// Enabled but no ready child. Use the instance status to tell apart a transient start from a
		// terminal failure (crashed, or a 'system' error such as an incompatible module api version) so the
		// UI shows a meaningful message rather than a spinner that never resolves.
		const status = instanceController.status.getInstanceStatus(instanceId)
		if (status?.level === 'Crashed') return { type: 'notRunning', reason: 'crashed' }
		if (status?.level === 'system') return { type: 'error', message: status.message || 'Instance is not running' }
		return { type: 'notRunning', reason: 'starting' }
	}

	return loadRunningConfig(child, instanceConf)
}
