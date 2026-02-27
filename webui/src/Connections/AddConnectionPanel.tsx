import React, { useContext, useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { useNavigate } from '@tanstack/react-router'
import { makeAbsolutePath } from '~/Resources/util.js'
import { AddInstancePanel } from '~/Instances/AddInstancePanel.js'
import type { AddInstanceService } from '~/Instances/AddInstanceService'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { makeLabelSafe } from '@companion-app/shared/Label.js'

export const AddConnectionsPanel = observer(function AddConnectionsPanel() {
	const service = useAddConnectionService()

	return (
		<AddInstancePanel
			service={service}
			title="Add New Connection"
			description={(storeCount) =>
				storeCount > 0 ? (
					<>
						<div className="intro-text">
							<p className="mb-2">
								<strong>Companion supports over {storeCount} different devices</strong> and the list grows every day.
							</p>
						</div>
						<div>
							<span className="text-muted">
								Can't find your device?{' '}
								<a
									target="_blank"
									href={makeAbsolutePath('/user-guide/config/modules')}
									className="text-decoration-none"
								>
									Check our guidance for getting device support
								</a>
							</span>
						</div>
					</>
				) : (
					<div>
						<strong>Connect to hundreds of devices</strong> with Companion modules. Ensure you have an internet
						connection to search and install modules, or{' '}
						<a target="_blank" href="https://l.companion.free/q/lp68nsiV4" className="text-decoration-none">
							download a module bundle
						</a>
					</div>
				)
			}
		/>
	)
})

function useAddConnectionService(): AddInstanceService {
	const { connections } = useContext(RootAppStoreContext)
	const navigate = useNavigate({ from: '/connections' })
	const addMutation = useMutationExt(trpc.instances.connections.add.mutationOptions())

	return useMemo(
		() => ({
			moduleType: ModuleInstanceType.Connection,

			closeAddInstance: () => {
				void navigate({ to: '/connections' })
			},
			openConfigureInstance: (connectionId) => {
				void navigate({ to: '/connections/$connectionId', params: { connectionId } })
			},

			performAddInstance: async (moduleInfo, label, versionId) => {
				return addMutation.mutateAsync({
					module: {
						type: moduleInfo.moduleId,
						product: moduleInfo.product,
					},
					label: label,
					versionId: versionId,
				})
			},

			findNextLabel: (moduleInfo) => {
				return findNextConnectionLabel(connections.connections, moduleInfo.shortname)
			},
		}),
		[navigate, connections, addMutation]
	)
}

// TODO: this is a copy of the function from companion/lib/Instance/ConnectionConfigStore.ts
function findNextConnectionLabel(
	connections: ReadonlyMap<string, ClientConnectionConfig>,
	shortname: string,
	ignoreId?: string
): string {
	let prefix = shortname

	const knownLabels = new Set()
	for (const [id, obj] of connections) {
		if (id !== ignoreId && obj && obj.label) {
			knownLabels.add(obj.label)
		}
	}

	prefix = makeLabelSafe(prefix)

	let label = prefix
	let i = 1
	while (knownLabels.has(label)) {
		// Try the next
		label = `${prefix}_${++i}`
	}

	return label
}
