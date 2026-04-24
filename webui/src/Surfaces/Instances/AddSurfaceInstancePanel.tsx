import { Link, useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useMemo } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { AddInstancePanel } from '~/Instances/AddInstancePanel.js'
import type { AddInstanceService } from '~/Instances/AddInstanceService'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { makeAbsolutePath } from '~/Resources/util.js'

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
			helpAction="/user-guide/surfaces/"
			description={(modulesCount) =>
				modulesCount > 0 ? (
					<>
						<div className="intro-text">
							<p className="mb-2">
								<strong>Companion supports over {modulesCount} different surfaces</strong>, and the list grows every
								day.
							</p>
						</div>
						<div>
							<span className="text-muted">
								Can't find your surface?{' '}
								<a
									target="_blank"
									href={makeAbsolutePath('/user-guide/config/modules')}
									className="text-decoration-none"
								>
									Check our guidance for getting device support
								</a>
								.<br /> To import an offline module, go to the <Link to="/modules">Modules page</Link>.
							</span>
						</div>
					</>
				) : (
					<div>
						<strong>You can use many different surfaces to control</strong> Companion. Ensure you have an internet
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

function useAddSurfaceInstanceService(): AddInstanceService {
	const addMutation = useMutationExt(trpc.instances.surfaces.add.mutationOptions())
	const navigate = useNavigate() // from: is only needed to resolve relative paths, so not needed here...

	return useMemo(
		() => ({
			moduleType: ModuleInstanceType.Surface,

			closeAddInstance: () => {
				// it's always safe to return to /surfaces/configured/integrations (i.e. it will always display correctly)
				// if the window is wide-enough, ConfigureSurfacesPage will remove the last part of the path.
				void navigate({ to: '/surfaces/configured/integrations' })
			},
			openConfigureInstance: (instanceId) => {
				void navigate({ to: '/surfaces/configured/integrations/$instanceId', params: { instanceId } })
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
		[navigate, addMutation]
	)
}
