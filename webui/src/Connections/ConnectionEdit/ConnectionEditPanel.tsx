import React, { useCallback, useContext, useMemo, useRef } from 'react'
import { isCollectionEnabled } from '~/Resources/util.js'
import { CRow, CCol } from '@coreui/react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ConnectionEditPanelHeading } from './ConnectionEditPanelHeading.js'
import { useNavigate } from '@tanstack/react-router'
import { trpc, trpcClient, useMutationExt, type RouterInputs } from '~/Resources/TRPC.js'
import type { InstanceEditPanelStore } from '~/Instances/InstanceEdit/InstanceEditPanelStore.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import type { InstanceEditPanelService } from '~/Instances/InstanceEdit/InstanceEditPanelService.js'
import { InstanceGenericEditPanel } from '~/Instances/InstanceEdit/InstanceEditPanel.js'
import type { ClientEditInstanceConfig } from '@companion-app/shared/Model/Common.js'

interface ConnectionEditPanelProps {
	connectionId: string
}

export const ConnectionEditPanel = observer(function ConnectionEditPanel({ connectionId }: ConnectionEditPanelProps) {
	const { connections } = useContext(RootAppStoreContext)

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const service = useInstanceEditPanelService(confirmModalRef, connectionId)

	const connectionInfo: ClientConnectionConfig | undefined = connections.getInfo(connectionId)

	if (!connectionInfo) {
		return (
			<CRow className="edit-connection">
				<CCol xs={12}>
					<p>Connection not found</p>
				</CCol>
			</CRow>
		)
	}

	return (
		<>
			<GenericConfirmModal ref={confirmModalRef} />

			<ConnectionEditPanelHeading connectionInfo={connectionInfo} closeConfigurePanel={service.closePanel} />

			<InstanceGenericEditPanel<ClientConnectionConfig>
				instanceInfo={connectionInfo}
				service={service}
				changeModuleDangerMessage={
					<>
						Changing the module type can break the connection and corrupt any existing actions and feedbacks. Only use
						this if you are sure of what you are doing.
					</>
				}
			/>
		</>
	)
})

function useInstanceEditPanelService(
	confirmModalRef: React.RefObject<GenericConfirmModalRef>,
	instanceId: string
): InstanceEditPanelService<ClientConnectionConfig> {
	const { connections } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: `/connections/$connectionId` })
	const closePanel = useCallback(() => {
		void navigate({ to: `/connections` })
	}, [navigate])

	const setConfigMutation = useMutationExt(trpc.instances.connections.setConfig.mutationOptions())
	const deleteMutation = useMutationExt(trpc.instances.connections.delete.mutationOptions())

	const deleteInstance = useCallback(
		(currentLabel: string) => {
			confirmModalRef.current?.show(
				'Delete connection',
				[
					`Are you sure you want to delete "${currentLabel}"?`,
					'This will remove all actions and feedbacks associated with this connection.',
				],
				'Delete',
				() => {
					deleteMutation.mutateAsync({ connectionId: instanceId }).catch((e) => {
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
			panelStore: InstanceEditPanelStore<ClientConnectionConfig>
		): Promise<string | null> => {
			const saveLabel = panelStore.labelValue

			const saveConfigProps: RouterInputs['instances']['connections']['setConfig'] = {
				connectionId: instanceId,
				label: saveLabel,
				enabled: panelStore.enabled,
				updatePolicy: panelStore.updatePolicy,
			}

			if (instanceShouldBeRunning) {
				if (panelStore.isLoading) throw new Error('Connection is still loading, cannot save changes')

				const configAndSecrets = panelStore.configAndSecrets
				if (configAndSecrets) {
					saveConfigProps.config = configAndSecrets.config
					saveConfigProps.secrets = configAndSecrets.secrets
				}
			}

			const err: string | null = await setConfigMutation.mutateAsync(saveConfigProps)

			if (err === 'invalid label') {
				return `The label "${saveLabel}" is not valid`
			} else if (err === 'duplicate label') {
				return `The label "${saveLabel}" is already in use. Please use a unique label for this connection`
			} else if (err) {
				return `Unable to save connection config: "${err}"`
			} else {
				if (instanceShouldBeRunning) {
					// Perform a reload of the connection config and secrets
					panelStore.triggerReload()
				}

				return null
			}
		},
		[setConfigMutation, instanceId]
	)

	return useMemo(
		() => ({
			moduleType: ModuleInstanceType.Connection,
			instanceId,

			moduleTypeDisplayName: 'connection',

			fetchConfig: async () =>
				trpcClient.instances.connections.edit.query({
					connectionId: instanceId,
				}) as Promise<ClientEditInstanceConfig | null>,

			isCollectionEnabled: (collectionId) => isCollectionEnabled(connections.rootCollections(), collectionId),

			deleteInstance,

			saveConfig,

			closePanel,
		}),
		[instanceId, connections, deleteInstance, saveConfig, closePanel]
	)
}
