import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faCogs, faQuestionCircle, faStethoscope } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { Badge, badgeToneForStatusCategory } from '~/Components/Badge'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { InstanceGenericEditPanel } from '~/Instances/InstanceEdit/InstanceEditPanel.js'
import type { InstanceEditPanelService } from '~/Instances/InstanceEdit/InstanceEditPanelService.js'
import type { InstanceEditPanelStore } from '~/Instances/InstanceEdit/InstanceEditPanelStore.js'
import { ModuleHelpContent, resolveModuleHelpUrl } from '~/Instances/ModuleHelpContent.js'
import { getModuleVersionInfo } from '~/Instances/Util.js'
import { trpc, useMutationExt, type RouterInput } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ConnectionEditPanelHeading } from './ConnectionEditPanelHeading.js'

interface ConnectionEditPanelProps {
	connectionId: string
}

type EditTab = 'settings' | 'help' | 'diagnostics'

interface EditTabButtonProps {
	tab: EditTab
	activeTab: EditTab
	setActiveTab: (tab: EditTab) => void
	icon: IconDefinition
	label: string
	showAttentionDot?: boolean
}

function EditTabButton({ tab, activeTab, setActiveTab, icon, label, showAttentionDot }: EditTabButtonProps) {
	return (
		<button
			type="button"
			onClick={() => setActiveTab(tab)}
			className={classNames(
				'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all border cursor-pointer whitespace-nowrap',
				activeTab === tab
					? 'bg-surface border-border text-body shadow-xs font-semibold'
					: 'bg-transparent border-transparent text-muted hover:text-body hover:bg-surface/50'
			)}
		>
			<FontAwesomeIcon icon={icon} className="text-muted" />
			<span>{label}</span>
			{showAttentionDot && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
		</button>
	)
}

function SidebarHelpTab({ helpPath }: { helpPath: string }) {
	const helpUrl = resolveModuleHelpUrl(helpPath)

	const {
		data: markdown,
		isLoading,
		error,
	} = useQuery({
		queryKey: ['module-help', helpUrl],
		queryFn: async () => {
			const response = await fetch(helpUrl)
			return response.text()
		},
		staleTime: Infinity,
	})

	if (isLoading) {
		return <div className="p-4 text-xs text-muted">Loading documentation...</div>
	}

	if (error || !markdown) {
		return (
			<div className="p-4 text-xs text-rose-500">
				{error ? `Failed to load help documentation: ${error}` : 'No help documentation available.'}
			</div>
		)
	}

	return (
		<div className="page-scroll p-4 text-sm text-body leading-relaxed space-y-3">
			<ModuleHelpContent markdown={markdown} helpUrl={helpUrl} />
		</div>
	)
}

export const ConnectionEditPanel = observer(function ConnectionEditPanel({ connectionId }: ConnectionEditPanelProps) {
	const { connections, instanceStatuses, modules } = useContext(RootAppStoreContext)
	const [activeTab, setActiveTab] = useState<EditTab>('settings')

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)
	const service = useInstanceEditPanelService(confirmModalRef, connectionId)

	const connectionInfo: ClientConnectionConfig | undefined = connections.getInfo(connectionId)
	const status = instanceStatuses.getStatus(connectionId)
	const moduleInfo = connectionInfo
		? modules.getModuleInfo(connectionInfo.moduleType, connectionInfo.moduleId)
		: undefined
	const moduleVersion = getModuleVersionInfo(moduleInfo, connectionInfo ? connectionInfo.moduleVersionId : null)

	if (!connectionInfo) {
		return (
			<Grid.Row className="edit-connection">
				<Grid.Col xs={12}>
					<p>Connection not found</p>
				</Grid.Col>
			</Grid.Row>
		)
	}

	return (
		<div className="flex flex-col h-full min-h-0 grow overflow-hidden">
			<GenericConfirmModal ref={confirmModalRef} />

			<ConnectionEditPanelHeading connectionInfo={connectionInfo} closeConfigurePanel={service.closePanel} />

			{/* Segmented Tab Bar */}
			<div className="px-4 py-2 border-b border-border bg-surface-muted/20 flex items-center gap-1.5 shrink-0 select-none overflow-x-auto">
				<EditTabButton
					tab="settings"
					activeTab={activeTab}
					setActiveTab={setActiveTab}
					icon={faCogs}
					label="Settings"
				/>

				{moduleVersion?.helpPath && (
					<EditTabButton
						tab="help"
						activeTab={activeTab}
						setActiveTab={setActiveTab}
						icon={faQuestionCircle}
						label="Help"
					/>
				)}

				<EditTabButton
					tab="diagnostics"
					activeTab={activeTab}
					setActiveTab={setActiveTab}
					icon={faStethoscope}
					label="Diagnostics"
					showAttentionDot={!!status?.category && status.category !== 'good'}
				/>
			</div>

			{/* Tab 1: Settings Form */}
			{activeTab === 'settings' && (
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
			)}

			{/* Tab 2: Help */}
			{activeTab === 'help' && moduleVersion?.helpPath && <SidebarHelpTab helpPath={moduleVersion.helpPath} />}

			{/* Tab 3: Diagnostics */}
			{activeTab === 'diagnostics' && (
				<div className="page-scroll p-4 space-y-4 flex flex-col">
					<div className="rounded-md border border-border bg-surface-muted/20 p-4 space-y-3 shrink-0">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-semibold text-body mb-0">Connection Health</h4>
							<Badge tone={badgeToneForStatusCategory(status?.category)} className="capitalize">
								{status?.level || status?.category || 'Unknown'}
							</Badge>
						</div>

						{status?.message && (
							<div className="p-3 rounded-lg bg-surface border border-border/60 text-xs font-mono text-body">
								{typeof status.message === 'string' ? status.message : JSON.stringify(status.message, null, 2)}
							</div>
						)}
					</div>

					<div className="rounded-md border border-border bg-surface-muted/20 p-4 space-y-3">
						<h4 className="text-sm font-semibold text-body mb-0">Module Metadata</h4>
						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="text-muted">Module Type:</div>
							<div className="font-medium text-body">{moduleInfo?.display?.name ?? connectionInfo.moduleId}</div>
							<div className="text-muted">Module Version:</div>
							<div className="font-mono text-body">{moduleVersion?.displayName ?? connectionInfo.moduleVersionId}</div>
							<div className="text-muted">Connection ID:</div>
							<div className="font-mono text-body select-all">{connectionInfo.id}</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
})

function useInstanceEditPanelService(
	confirmModalRef: React.RefObject<GenericConfirmModalRef | null>,
	instanceId: string
): InstanceEditPanelService<ClientConnectionConfig> {
	const navigate = useNavigate({ from: `/connections/$connectionId` })
	const closePanel = useCallback(() => {
		void navigate({ to: `/connections` })
	}, [navigate])

	const setConfigMutation = useMutationExt(trpc.instances.connections.setConfig.mutationOptions())
	const setModuleAndVersionMutation = useMutationExt(trpc.instances.connections.setModuleAndVersion.mutationOptions())
	const deleteMutation = useMutationExt(trpc.instances.connections.delete.mutationOptions())

	const setModuleAndVersion = useCallback(
		async (moduleId: string, versionId: string | null): Promise<string | null> =>
			setModuleAndVersionMutation.mutateAsync({ connectionId: instanceId, moduleId, versionId }),
		[setModuleAndVersionMutation, instanceId]
	)

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
		async (panelStore: InstanceEditPanelStore<ClientConnectionConfig>): Promise<string | null> => {
			const saveLabel = panelStore.labelValue

			const saveConfigProps: RouterInput['instances']['connections']['setConfig'] = {
				connectionId: instanceId,
				label: saveLabel,
				enabled: panelStore.enabled,
				updatePolicy: panelStore.updatePolicy,
			}

			if (panelStore.isLoading) throw new Error('Connection is still loading, cannot save changes')

			// Only present when a running child reported its config fields
			const configAndSecrets = panelStore.configAndSecrets
			if (configAndSecrets) {
				saveConfigProps.config = configAndSecrets.config
				saveConfigProps.secrets = configAndSecrets.secrets
			}

			const err: string | null = await setConfigMutation.mutateAsync(saveConfigProps)

			if (err === 'invalid label') {
				return `The label "${saveLabel}" is not valid`
			} else if (err === 'duplicate label') {
				return `The label "${saveLabel}" is already in use. Please use a unique label for this connection`
			} else if (err) {
				return `Unable to save connection config: "${err}"`
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
			moduleType: ModuleInstanceType.Connection,
			instanceId,

			moduleTypeDisplayName: 'connection',

			watchConfig: (handlers) =>
				trpc.instances.connections.watchEdit.subscriptionOptions({ connectionId: instanceId }, handlers),

			deleteInstance,

			saveConfig,

			setModuleAndVersion,

			closePanel,
		}),
		[instanceId, deleteInstance, saveConfig, setModuleAndVersion, closePanel]
	)
}
