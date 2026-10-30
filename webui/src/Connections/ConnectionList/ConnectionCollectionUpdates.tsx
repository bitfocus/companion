import { faCircleUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useContext, useEffect } from 'react'
import type { ConnectionCollection } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { getInstanceUpdateMessage } from '~/Instances/InstanceUpdate.js'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export const ConnectionCollectionUpdates = observer(function ConnectionCollectionUpdates({
	collection,
}: {
	collection: ConnectionCollection
}) {
	const { connections, modules } = useContext(RootAppStoreContext)
	const instances = useComputed(() => {
		const collectionIds = new Set<string>()
		const collect = (group: ConnectionCollection): void => {
			collectionIds.add(group.id)
			group.children.forEach(collect)
		}
		collect(collection)
		return Array.from(connections.connections.values()).filter(
			(instance) =>
				instance.collectionId !== null &&
				collectionIds.has(instance.collectionId) &&
				instance.moduleVersionId !== 'dev' &&
				instance.updatePolicy !== InstanceVersionUpdatePolicy.Manual
		)
	}, [collection, connections])
	const moduleIds = useComputed(() => Array.from(new Set(instances.map((instance) => instance.moduleId))), [instances])

	// Collapsed collections unmount their rows. Keep the version information subscribed here too.
	// The store shares subscriptions with row badges and other collection headers.
	useEffect(() => {
		const unsubscribers = moduleIds.flatMap((moduleId) => [
			modules.storeVersions.subscribeToModuleStoreVersions(ModuleInstanceType.Connection, moduleId),
			modules.storeVersions.subscribeToModuleUpgradeToVersions(ModuleInstanceType.Connection, moduleId),
		])
		return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
	}, [modules, moduleIds])

	const count = instances.filter((instance) =>
		getInstanceUpdateMessage(
			instance,
			modules.storeVersions.getModuleStoreVersions(instance.moduleType, instance.moduleId)?.versions,
			modules.storeVersions.getModuleUpgradeToVersions(instance.moduleType, instance.moduleId).length > 0
		)
	).length
	if (!count) return null

	return (
		<span
			className="inline-flex items-center gap-1 rounded-md bg-tone-info-fill/10 px-1.5 py-0.5 text-2xs font-medium text-tone-info-text whitespace-nowrap"
			title={`${count} connection${count === 1 ? '' : 's'} in this collection or its nested collections ${count === 1 ? 'has' : 'have'} module updates available`}
		>
			<FontAwesomeIcon icon={faCircleUp} />
			{count} {count === 1 ? 'update' : 'updates'}
		</span>
	)
})
