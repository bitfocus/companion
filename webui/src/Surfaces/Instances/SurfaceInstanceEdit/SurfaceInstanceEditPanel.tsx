import React, { useCallback, useContext, useMemo, useRef } from 'react'
import { isCollectionEnabled } from '~/Resources/util.js'
import { CRow, CCol } from '@coreui/react'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { SurfaceInstanceEditPanelHeading } from './SurfaceInstanceEditPanelHeading.js'
import { useNavigate } from '@tanstack/react-router'
import { type RouterInputs, trpc, trpcClient, useMutationExt } from '~/Resources/TRPC.js'
import type { InstanceEditPanelStore } from '~/Instances/InstanceEdit/InstanceEditPanelStore.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import type { InstanceEditPanelService } from '~/Instances/InstanceEdit/InstanceEditPanelService.js'
import { InstanceGenericEditPanel } from '~/Instances/InstanceEdit/InstanceEditPanel.js'
import type { ClientEditInstanceConfig } from '@companion-app/shared/Model/Common.js'
import type { ClientSurfaceInstanceConfig } from '@companion-app/shared/Model/SurfaceInstance.js'

interface SurfaceInstanceEditPanelProps {
	instanceId: string
}

export const SurfaceInstanceEditPanel = observer(function SurfaceInstanceEditPanel({
	instanceId,
}: SurfaceInstanceEditPanelProps) {
	const { surfaceInstances } = useContext(RootAppStoreContext)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const service = useInstanceEditPanelService(confirmModalRef, instanceId)

	const instanceInfo = surfaceInstances.getInfo(instanceId)

	if (!instanceInfo) {
		return (
			<CRow className="edit-connection">
				<CCol xs={12}>
					<p>Instance not found</p>
				</CCol>
			</CRow>
		)
	}

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
			/>
		</>
	)
})

function useInstanceEditPanelService(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>,
	instanceId: string
): InstanceEditPanelService<ClientSurfaceInstanceConfig> {
	const { surfaceInstances } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: `/surfaces/instances/$instanceId` })
	const closePanel = useCallback(() => {
		void navigate({ to: `/surfaces/instances` })
	}, [navigate])

	const setConfigMutation = useMutationExt(trpc.instances.surfaces.setConfig.mutationOptions())
	const deleteMutation = useMutationExt(trpc.instances.surfaces.delete.mutationOptions())

	const deleteInstance = useCallback(
		(currentLabel: string) => {
			confirmModalRef.current?.show(
				'Delete surface instance',
				[
					`Are you sure you want to delete "${currentLabel}"?`,
					'This will disable all surfaces associated with this instance.',
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
		async (
			instanceShouldBeRunning: boolean,
			panelStore: InstanceEditPanelStore<ClientSurfaceInstanceConfig>
		): Promise<string | null> => {
			const saveLabel = panelStore.labelValue

			const saveConfigProps: RouterInputs['instances']['surfaces']['setConfig'] = {
				instanceId: instanceId,
				label: saveLabel,
				enabled: panelStore.enabled,
				updatePolicy: panelStore.updatePolicy,
			}

			if (instanceShouldBeRunning) {
				if (panelStore.isLoading) throw new Error('Surface instance is still loading, cannot save changes')

				const configAndSecrets = panelStore.configAndSecrets
				if (configAndSecrets) {
					saveConfigProps.config = configAndSecrets.config
					// saveConfigProps.secrets = configAndSecrets.secrets
				}
			}

			const err: string | null = await setConfigMutation.mutateAsync(saveConfigProps)

			if (err === 'invalid label') {
				return `The label "${saveLabel}" is not valid`
			} else if (err === 'duplicate label') {
				return `The label "${saveLabel}" is already in use. Please use a unique label for this surface instance`
			} else if (err) {
				return `Unable to save surface instance config: "${err}"`
			} else {
				if (instanceShouldBeRunning) {
					// Perform a reload of the surface instance config and secrets
					panelStore.triggerReload()
				}

				return null
			}
		},
		[setConfigMutation, instanceId]
	)

	return useMemo(
		() => ({
			moduleType: ModuleInstanceType.Surface,
			instanceId,

			moduleTypeDisplayName: 'surface instance',

			fetchConfig: async () =>
				trpcClient.instances.surfaces.edit.query({
					instanceId,
				}) as Promise<ClientEditInstanceConfig | null>,

			isCollectionEnabled: (collectionId) => isCollectionEnabled(surfaceInstances.rootCollections(), collectionId),

			deleteInstance,

			saveConfig,

			closePanel,
		}),
		[instanceId, surfaceInstances, deleteInstance, saveConfig, closePanel]
	)
}
