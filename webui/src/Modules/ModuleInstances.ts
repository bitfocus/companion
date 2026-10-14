import { ModuleInstanceType, type ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import type { RootAppStore } from '~/Stores/RootAppStore.js'

/** The connections or surface instances using a module, of any version, sorted by label. */
export function getModuleInstances(
	store: Pick<RootAppStore, 'connections' | 'surfaceInstances'>,
	moduleType: ModuleInstanceType,
	moduleId: string
): ClientInstanceConfigBase[] {
	const instances: Iterable<ClientInstanceConfigBase> =
		moduleType === ModuleInstanceType.Connection
			? store.connections.connections.values()
			: store.surfaceInstances.instances.values()

	return Array.from(instances)
		.filter((instance) => instance.moduleType === moduleType && instance.moduleId === moduleId)
		.sort((a, b) => a.label.localeCompare(b.label))
}
