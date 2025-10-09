import React, { useCallback, useRef, useState } from 'react'
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ClientSurfaceInstanceConfig } from '@companion-app/shared/Model/Connections.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useSubscription } from '@trpc/tanstack-react-query'
import { SurfaceInstancesTable } from './SurfaceModulesTable.js'

interface SurfaceModulesListProps {
	selectedModuleId: string | null
}

export interface ClientSurfaceInstanceConfigWithId extends ClientSurfaceInstanceConfig {
	id: string
}

export const SurfaceModulesList = observer(function SurfaceModulesList({ selectedModuleId }: SurfaceModulesListProps) {
	const [surfaceModules, setSurfaceModules] = useState<Record<string, ClientSurfaceInstanceConfig>>({})

	// Subscribe to surface instances updates
	useSubscription(
		trpc.instances.surfaces.watch.subscriptionOptions(undefined, {
			onData: (data) => {
				for (const update of data) {
					if (update.type === 'init') {
						setSurfaceModules(update.info)
					} else if (update.type === 'remove') {
						setSurfaceModules((prev) => {
							const newModules = { ...prev }
							delete newModules[update.id]
							return newModules
						})
					} else if (update.type === 'update') {
						setSurfaceModules((prev) => ({
							...prev,
							[update.id]: update.info,
						}))
					}
				}
			},
		})
	)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	const doConfigureModule = useCallback((moduleId: string | null) => {
		// TODO: Implement proper navigation to configure surface module
		console.log('Configure module', moduleId)
	}, [])

	// Convert to array with IDs for display
	const allModules: ClientSurfaceInstanceConfigWithId[] = React.useMemo(() => {
		return Object.entries(surfaceModules).map(([id, config]) => ({
			...config,
			id,
		}))
	}, [surfaceModules])

	const deleteModule = useMutationExt(trpc.instances.surfaces.delete.mutationOptions())

	const doDelete = useCallback(
		async (moduleId: string) => {
			await deleteModule.mutateAsync({ instanceId: moduleId })
		},
		[deleteModule]
	)

	const doAskDelete = useCallback(
		(moduleId: string) => {
			const module = allModules.find((m) => m.id === moduleId)
			if (module) {
				confirmModalRef.current?.show(
					'Delete Surface Instance',
					`Are you sure you want to delete the surface instance "${module.label}"?`,
					'Delete',
					() => {
						doDelete(moduleId).catch((e: any) => {
							console.error('Surface instance delete failed', e)
						})
					}
				)
			}
		},
		[allModules, doDelete]
	)

	const noModulesContent = <NonIdealState icon={faLayerGroup} text="No surface instances have been configured yet." />

	return (
		<div className="surface-instances-list-container flex-column-layout">
			<div className="surface-instances-list-header fixed-header">
				<h4>Surface Instances</h4>

				<p>
					Surface instances are configured surface modules that handle different surface types and protocols. Configure
					and manage your active surface instances here.
				</p>

				<GenericConfirmModal ref={confirmModalRef} />
			</div>

			<div className="surface-instances-list-table-container scrollable-content">
				{allModules.length === 0 ? (
					noModulesContent
				) : (
					<SurfaceInstancesTable
						modules={allModules}
						selectedModuleId={selectedModuleId}
						doConfigureModule={doConfigureModule}
						doAskDelete={doAskDelete}
					/>
				)}
			</div>
		</div>
	)
})
