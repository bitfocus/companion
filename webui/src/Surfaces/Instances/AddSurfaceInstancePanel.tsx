import React, { useMemo } from 'react'
import { observer } from 'mobx-react-lite'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { makeAbsolutePath } from '~/Resources/util.js'
import { AddInstancePanel } from '~/Instances/AddInstancePanel.js'
import type { AddInstanceService } from '~/Instances/AddInstanceService'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

interface AddSurfaceInstancePanelProps {
	isSubpanel?: boolean
}
export const AddSurfaceInstancePanel = observer(function AddSurfaceInstancePanel({
	isSubpanel,
}: AddSurfaceInstancePanelProps) {
	const service = useAddSurfaceInstanceService()

	return (
		<AddInstancePanel
			service={service}
			isSubpanel={!!isSubpanel}
			title="Add Surface Integration"
			description={(storeCount) =>
				storeCount > 0 ? (
					<>
						<div className="intro-text">
							<p className="mb-2">
								<strong>Companion supports over {storeCount} different surfaces</strong> and the list grows every day.
							</p>
						</div>
						<div>
							<span className="text-muted">
								Can't find your surface?{' '}
								<a
									target="_blank"
									href={makeAbsolutePath('/getting-started#6_modules.md')}
									className="text-decoration-none"
								>
									Check our guidance for getting device support
								</a>
							</span>
						</div>
					</>
				) : (
					<div>
						<strong>You can use many different surfaces to control</strong> Companion. Ensure you have an internet
						connection to search and install modules, or{' '}
						<a target="_blank" href="https://user.bitfocus.io/download" className="text-decoration-none">
							download a module bundle
						</a>
					</div>
				)
			}
		/>
	)
})

function useAddSurfaceInstanceService(): AddInstanceService {
	const addMutation = useMutationExt(trpc.instances.surfaces.add.mutationOptions())
	const navigate = useNavigate() // from: is only needed to resolve relative paths, so not needed here...
	const { pathname } = useLocation()

	const homepage = pathname.split('/', 3).join('/') // first two elements of the path ex: /surfaces/configured
	// this is not pretty but should do for the moment
	let instancePage: string
	if (pathname.endsWith('add')) {
		// /surfaces/configured/integration/add
		instancePage = pathname.replace('add', '$instanceId') // replace the filename part of the path
	} else {
		// /surfaces/integrations
		instancePage = homepage + '/$instanceId' // add to the path
	}

	return useMemo(
		() => ({
			moduleType: ModuleInstanceType.Surface,

			closeAddInstance: () => {
				void navigate({ to: homepage })
			},
			openConfigureInstance: (instanceId) => {
				void navigate({ to: instancePage, params: { instanceId } })
			},

			performAddInstance: async (moduleInfo, label, versionId) => {
				return addMutation.mutateAsync({
					moduleId: moduleInfo.moduleId,
					label: label,
					versionId: versionId,
				})
			},

			findNextLabel: (moduleInfo) => {
				// There are no exclusivity rules on these (yet?)
				return moduleInfo.shortname
			},
		}),
		[navigate, addMutation, homepage, instancePage]
	)
}
