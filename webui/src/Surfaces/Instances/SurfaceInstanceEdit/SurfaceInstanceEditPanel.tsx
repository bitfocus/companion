import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, useRef } from 'react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientSurfaceInstanceConfig } from '@companion-app/shared/Model/SurfaceInstance.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { InstanceGenericEditPanel } from '~/Instances/InstanceEdit/InstanceEditPanel.js'
import type { InstanceEditPanelService } from '~/Instances/InstanceEdit/InstanceEditPanelService.js'
import type { InstanceEditPanelStore } from '~/Instances/InstanceEdit/InstanceEditPanelStore.js'
import { trpc, useMutationExt, type RouterInput } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { getSurfaceInstanceCannotEnableReason } from '../SurfaceInstanceValidation.js'
import { SurfaceInstanceEditPanelHeading } from './SurfaceInstanceEditPanelHeading.js'

interface SurfaceInstanceEditPanelProps {
	instanceId: string
}

export const SurfaceInstanceEditPanel = observer(function SurfaceInstanceEditPanel({
	instanceId,
}: SurfaceInstanceEditPanelProps) {
	const { surfaceInstances, modules } = useContext(RootAppStoreContext)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const service = useInstanceEditPanelService(confirmModalRef, instanceId)

	const instanceInfo = surfaceInstances.getInfo(instanceId)

	if (!instanceInfo) {
		return (
			<Grid.Row className="edit-connection">
				<Grid.Col xs={12}>
					<p>Instance not found</p>
				</Grid.Col>
			</Grid.Row>
		)
	}

	const cannotEnableReason = getSurfaceInstanceCannotEnableReason(instanceId, surfaceInstances.instances, modules)

	return (
		<>
			<GenericConfirmModal ref={confirmModalRef} />

			<SurfaceInstanceEditPanelHeading instanceInfo={instanceInfo} closeConfigurePanel={service.closePanel} />

			<InstanceGenericEditPanel<ClientSurfaceInstanceConfig>
				instanceInfo={instanceInfo}
				service={service}
				changeModuleDangerMessage={
					<>
						Changing the module type can break the linked surfaces. Only use this if you are sure of what you are doing.
					</>
				}
				cannotEnableReason={cannotEnableReason}
			/>
		</>
	)
})

function useInstanceEditPanelService(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>,
	instanceId: string
): InstanceEditPanelService<ClientSurfaceInstanceConfig> {
	const navigate = useNavigate()

	const closePanel = useCallback(() => {
		// it's always safe to return to /surfaces/integrations (i.e. it will always display correctly)
		// if the window is wide-enough, ConfigureSurfacesPage will remove the last part of the path.
		void navigate({ to: '/surfaces/integrations' })
	}, [navigate])

	const setConfigMutation = useMutationExt(trpc.instances.surfaces.setConfig.mutationOptions())
	const deleteMutation = useMutationExt(trpc.instances.surfaces.delete.mutationOptions())

	const deleteInstance = useCallback(
		(currentLabel: string) => {
			confirmModalRef.current?.show(
				'Delete surface integration',
				[
					`Are you sure you want to delete "${currentLabel}"?`,
					'This will disable all surfaces associated with this integration.',
				],
				'Delete',
				() => {
					deleteMutation.mutateAsync({ instanceId }).catch((e) => {
						console.error('Delete failed', e)
					})
					closePanel()
				}
			)
		},
		[deleteMutation, confirmModalRef, instanceId, closePanel]
	)

	const saveConfig = useCallback(
		async (panelStore: InstanceEditPanelStore<ClientSurfaceInstanceConfig>): Promise<string | null> => {
			const saveLabel = panelStore.labelValue

			const saveConfigProps: RouterInput['instances']['surfaces']['setConfig'] = {
				instanceId: instanceId,
				label: saveLabel,
				enabled: panelStore.enabled,
				updatePolicy: panelStore.updatePolicy,
			}

			if (panelStore.isLoading) throw new Error('Surface integration is still loading, cannot save changes')

			// Only present when a running child reported its config fields
			const configAndSecrets = panelStore.configAndSecrets
			if (configAndSecrets) {
				saveConfigProps.config = configAndSecrets.config
				// saveConfigProps.secrets = configAndSecrets.secrets
			}

			const err: string | null = await setConfigMutation.mutateAsync(saveConfigProps)

			if (err === 'invalid label') {
				return `The label "${saveLabel}" is not valid`
			} else if (err === 'duplicate label') {
				return `The label "${saveLabel}" is already in use. Please use a unique label for this surface integration`
			} else if (err) {
				return `Unable to save surface integration config: "${err}"`
			} else {
				// The subscription will deliver the freshly saved config; just clear the dirty tracking
				panelStore.markSaved()

				return null
			}
		},
		[setConfigMutation, instanceId]
	)

	return useMemo(
		() => ({
			moduleType: ModuleInstanceType.Surface,
			instanceId,

			moduleTypeDisplayName: 'surface integration',

			watchConfig: (handlers) => trpc.instances.surfaces.watchEdit.subscriptionOptions({ instanceId }, handlers),

			deleteInstance,

			saveConfig,

			closePanel,
		}),
		[instanceId, deleteInstance, saveConfig, closePanel]
	)
}
