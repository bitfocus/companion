import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useMemo } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { AddInstancePanel } from '~/Instances/AddInstancePanel.js'
import type { AddInstanceService } from '~/Instances/AddInstanceService'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export const AddSurfaceInstancePanel = observer(function AddSurfaceInstancePanel() {
	const service = useAddSurfaceInstanceService()

	return (
		<AddInstancePanel
			service={service}
			isModal={true}
			title="Add Surface Integration"
			helpAction="/user-guide/surfaces/"
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
				// it's always safe to return to /surfaces/integrations (i.e. it will always display correctly)
				// if the window is wide-enough, ConfigureSurfacesPage will remove the last part of the path.
				void navigate({ to: '/surfaces/integrations' })
			},
			openConfigureInstance: (instanceId) => {
				void navigate({ to: '/surfaces/integrations/$instanceId', params: { instanceId } })
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
