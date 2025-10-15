import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { isCollectionEnabled } from '~/Resources/util.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { CRow, CCol, CButton, CFormSelect, CAlert, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCircleExclamation, faGear, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy } from '@companion-app/shared/Model/Instance.js'
import { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ConnectionEditField } from './ConnectionEditField.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { ConnectionChangeVersionButton } from './ConnectionChangeVersionModal.js'
import { doesConnectionVersionExist } from './VersionUtil.js'
import { ConnectionEditPanelHeading } from './ConnectionEditPanelHeading.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ConnectionSecretField } from './ConnectionSecretField.js'
import { useNavigate } from '@tanstack/react-router'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { ConnectionEditPanelStore, isConfigFieldSecret } from './ConnectionEditPanelStore.js'
import { observable } from 'mobx'
import { TextInputField } from '~/Components/TextInputField.js'
import classNames from 'classnames'
import { InlineHelp } from '~/Components/InlineHelp.js'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { getModuleVersionInfo } from '~/Instances/Util.js'

interface ConnectionEditPanelProps {
	connectionId: string
}

export const ConnectionEditPanel = observer(function ConnectionEditPanel({ connectionId }: ConnectionEditPanelProps) {
	const { connections } = useContext(RootAppStoreContext)

	const navigate = useNavigate({ from: `/connections/configured/$connectionId` })
	const closeConfigurePanel = useCallback(() => {
		void navigate({ to: `/connections/configured` })
	}, [navigate])

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
		<ConnectionEditPanelInner
			connectionId={connectionId}
			connectionInfo={connectionInfo}
			closeConfigurePanel={closeConfigurePanel}
		/>
	)
})

interface ConnectionEditPanelInnerProps {
	connectionId: string
	connectionInfo: ClientConnectionConfig
	closeConfigurePanel: () => void
}

const ConnectionEditPanelInner = observer(function ConnectionEditPanelInner({
	connectionId,
	connectionInfo,
	closeConfigurePanel,
}: ConnectionEditPanelInnerProps) {
	const { connections, modules } = useContext(RootAppStoreContext)

	const panelStore = useMemo(
		() => new ConnectionEditPanelStore(connectionId, connectionInfo),
		[connectionId, connectionInfo]
	)

	const moduleInfo = modules.modules.get(panelStore.connectionInfo.moduleId)

	const connectionVersionExists = doesConnectionVersionExist(moduleInfo, panelStore.connectionInfo.moduleVersionId)
	const connectionShouldBeRunning =
		panelStore.connectionInfo.enabled &&
		connectionVersionExists &&
		isCollectionEnabled(connections.rootCollections(), panelStore.connectionInfo.collectionId)

	const setLabelAndVersionMutation = useMutationExt(trpc.instances.connections.setLabelAndVersion.mutationOptions())
	const setLabelAndConfigMutation = useMutationExt(trpc.instances.connections.setLabelAndConfig.mutationOptions())

	const isSaving = observable.box(false)
	const [saveError, setSaveError] = useState<string | null>(null)
	const performSave = useCallback(() => {
		if (isSaving.get()) return
		setSaveError(null)

		// Bail early if the form is not dirty
		if (!panelStore.isDirty()) return

		isSaving.set(true)

		Promise.resolve()
			.then(async () => {
				if (connectionShouldBeRunning) {
					if (panelStore.isLoading) throw new Error('Connection is still loading, cannot save changes')

					const configAndSecrets = panelStore.configAndSecrets
					if (!configAndSecrets) throw new Error('No config and secrets loaded, cannot save changes')

					const saveLabel = panelStore.labelValue
					const err = await setLabelAndConfigMutation.mutateAsync({
						connectionId: panelStore.connectionId,
						label: saveLabel,
						enabled: panelStore.enabled,
						updatePolicy: panelStore.updatePolicy,
						config: configAndSecrets.config,
						secrets: configAndSecrets.secrets,
					})
					if (err === 'invalid label') {
						setSaveError(`The label "${saveLabel}" in not valid`)
					} else if (err === 'duplicate label') {
						setSaveError(`The label "${saveLabel}" is already in use. Please use a unique label for this connection`)
					} else if (err) {
						setSaveError(`Unable to save connection config: "${err as string}"`)
					} else {
						setSaveError(null)

						// Perform a reload of the connection config and secrets
						panelStore.triggerReload()
					}
				} else {
					const saveLabel = panelStore.labelValue
					const err = await setLabelAndVersionMutation.mutateAsync({
						connectionId: panelStore.connectionId,
						label: saveLabel,
						enabled: panelStore.enabled,
						versionId: panelStore.moduleVersionId,
						updatePolicy: panelStore.updatePolicy,
					})
					if (err === 'invalid label') {
						setSaveError(`The label "${saveLabel}" in not valid`)
					} else if (err === 'duplicate label') {
						setSaveError(`The label "${saveLabel}" is already in use. Please use a unique label for this connection`)
					} else if (err) {
						setSaveError(`Unable to save connection config: "${err as string}"`)
					} else {
						setSaveError(null)
					}
				}

				isSaving.set(false)
			})
			.catch((error) => {
				isSaving.set(false)
				setSaveError(`Failed to save connection: ${error.message || error}`)
				console.error('Failed to save connection:', error)
			})
	}, [setLabelAndVersionMutation, setLabelAndConfigMutation, panelStore, isSaving, connectionShouldBeRunning])

	// Trigger a reload/unload of the connection config when the connection transitions to be running
	useEffect(() => {
		if (connectionShouldBeRunning) {
			panelStore.triggerReload()
		} else {
			panelStore.unloadConfigAndSecrets()
		}
	}, [panelStore, connectionShouldBeRunning])

	return (
		<>
			<ConnectionEditPanelHeading connectionInfo={connectionInfo} closeConfigurePanel={closeConfigurePanel} />

			<CForm
				className="secondary-panel-simple-body d-flex flex-column pb-0"
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					performSave()
				}}
			>
				<div className="flex-fill">
					<div className="row edit-connection">
						{saveError && (
							<CCol className="fieldtype-textinput" sm={12}>
								<CAlert color="danger">{saveError}</CAlert>
							</CCol>
						)}

						<ConnectionLabelInputField panelStore={panelStore} />
						<InstanceEnabledInputField panelStore={panelStore} />

						<ConnectionModuleVersionInputField
							panelStore={panelStore}
							connectionShouldBeRunning={connectionShouldBeRunning}
							moduleInfo={moduleInfo}
						/>

						<InstanceVersionUpdatePolicyInputField panelStore={panelStore} />

						{!connectionShouldBeRunning && (
							<CCol xs={12}>
								<NonIdealState icon={faGear}>
									<p>Connection configuration cannot be edited while it is disabled. The fields above can be edited.</p>
								</NonIdealState>
							</CCol>
						)}

						{connectionShouldBeRunning && (panelStore.isLoading || panelStore.loadError) && (
							<CCol xs={12}>
								<LoadingRetryOrError
									error={panelStore.loadError}
									dataReady={!panelStore.isLoading}
									doRetry={panelStore.triggerReload}
									design="pulse"
								/>
							</CCol>
						)}

						{connectionShouldBeRunning && !panelStore.isLoading && <ConnectionConfigFields panelStore={panelStore} />}
					</div>
				</div>

				<ConnectionFormButtons
					panelStore={panelStore}
					connectionShouldBeRunning={connectionShouldBeRunning}
					isSaving={isSaving.get()}
					closeConfigurePanel={closeConfigurePanel}
				/>
			</CForm>
		</>
	)
})

function ConnectionFieldLabel({ fieldInfo }: { fieldInfo: SomeCompanionInputField }) {
	return (
		<>
			{fieldInfo.label}
			{fieldInfo.tooltip && (
				<InlineHelp help={fieldInfo.tooltip}>
					<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
				</InlineHelp>
			)}
		</>
	)
}

const ConnectionLabelInputField = observer(function ConnectionLabelInputField({
	panelStore,
}: {
	panelStore: ConnectionEditPanelStore
}): React.JSX.Element {
	return (
		<>
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Label</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<TextInputField
					setValue={panelStore.setLabelValue}
					checkValid={panelStore.checkLabelIsValid}
					value={panelStore.labelValue}
				/>
			</CCol>
		</>
	)
})

const ConnectionModuleVersionInputField = observer(function ConnectionModuleVersionInputField({
	panelStore,
	moduleInfo,
}: {
	panelStore: ConnectionEditPanelStore
	connectionShouldBeRunning: boolean
	moduleInfo: ClientModuleInfo | undefined
}): React.JSX.Element {
	const moduleVersion = getModuleVersionInfo(moduleInfo, panelStore.connectionInfo.moduleVersionId)

	return (
		<>
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Module Version</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<ConnectionChangeVersionButton
					connectionId={panelStore.connectionId}
					currentModuleId={panelStore.connectionInfo.moduleId}
					currentVersionId={panelStore.connectionInfo.moduleVersionId}
					currentVersionLabel={moduleVersion?.displayName ?? panelStore.connectionInfo.moduleVersionId}
				/>
			</CCol>
		</>
	)
})

const InstanceEnabledInputField = observer(function InstanceEnabledInputField({
	panelStore,
}: {
	panelStore: ConnectionEditPanelStore
}): React.JSX.Element {
	return (
		<>
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Enabled</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<CFormSwitch checked={panelStore.enabled} onChange={(e) => panelStore.setEnabled(e.target.checked)} size="xl" />
			</CCol>
		</>
	)
})

const InstanceVersionUpdatePolicyInputField = observer(function InstanceVersionUpdatePolicyInputField({
	panelStore,
}: {
	panelStore: ConnectionEditPanelStore
}): React.JSX.Element {
	return (
		<>
			<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
				Update Policy
				<InlineHelp help="How to check whether there are updates available for this connection">
					<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} />
				</InlineHelp>
			</CFormLabel>
			<CCol className={`fieldtype-textinput`} sm={8}>
				<CFormSelect
					name="colFormUpdatePolicy"
					value={panelStore.updatePolicy}
					onChange={(e) => panelStore.setUpdatePolicy(e.currentTarget.value as InstanceVersionUpdatePolicy)}
				>
					<option value="manual">Disabled</option>
					<option value="stable">Stable</option>
					<option value="beta">Stable and Beta</option>
				</CFormSelect>
			</CCol>
		</>
	)
})

const ConnectionConfigFields = observer(function ConnectionConfigFields({
	panelStore,
}: {
	panelStore: ConnectionEditPanelStore
}): React.JSX.Element {
	const configData = panelStore.configAndSecrets

	if (!configData) {
		return <NonIdealState icon={faCircleExclamation}>No config data loaded</NonIdealState>
	}

	if (configData.fields.length === 0) {
		return <NonIdealState icon={faCheck}>Connection has no configuration</NonIdealState>
	}

	return (
		<>
			<hr className="my-3" />
			{configData.fields.map((fieldInfo) => {
				const isVisible = panelStore.isVisible(fieldInfo)
				if (!isVisible) return null

				const isSecret = isConfigFieldSecret(fieldInfo)
				if (isSecret) {
					return (
						<CCol
							className={`fieldtype-${fieldInfo.type}`}
							sm={fieldInfo.width}
							style={{ display: !isVisible ? 'none' : undefined }}
						>
							<CFormLabel>
								<ConnectionFieldLabel fieldInfo={fieldInfo} />
							</CFormLabel>
							<ConnectionSecretField
								definition={fieldInfo}
								value={configData.secrets[fieldInfo.id]}
								setValue={(value) => panelStore.setConfigValue(fieldInfo.id, value)}
							/>
							{fieldInfo.description && <div className="form-text">{fieldInfo.description}</div>}
						</CCol>
					)
				} else {
					// Hide certain fields when in 'xs' column size, to avoid unexpected padding
					const hideInXs = fieldInfo.type === 'static-text' && !fieldInfo.label && !fieldInfo.value

					return (
						<CCol
							className={classNames(`fieldtype-${fieldInfo.type}`, { 'd-none': hideInXs, 'd-sm-block': hideInXs })}
							sm={fieldInfo.width}
							style={{ display: !isVisible ? 'none' : undefined }}
						>
							<CFormLabel>
								<ConnectionFieldLabel fieldInfo={fieldInfo} />
							</CFormLabel>
							<ConnectionEditField
								definition={fieldInfo}
								value={configData.config[fieldInfo.id]}
								setValue={(value) => panelStore.setConfigValue(fieldInfo.id, value)}
								connectionId={panelStore.connectionId}
							/>
							{fieldInfo.description && <div className="form-text">{fieldInfo.description}</div>}
						</CCol>
					)
				}
			})}
		</>
	)
})

const ConnectionFormButtons = observer(function ConnectionFormButtons({
	panelStore,
	isSaving,
	connectionShouldBeRunning,
	closeConfigurePanel,
}: {
	panelStore: ConnectionEditPanelStore
	isSaving: boolean
	connectionShouldBeRunning: boolean
	closeConfigurePanel: () => void
}): React.JSX.Element {
	const isValid = panelStore.isValid()

	const navigate = useNavigate()

	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	const isLoading = connectionShouldBeRunning && panelStore.isLoading

	const deleteMutation = useMutationExt(trpc.instances.connections.delete.mutationOptions())

	const doDelete = useCallback(() => {
		confirmModalRef.current?.show(
			'Delete connection',
			[
				`Are you sure you want to delete "${panelStore.labelValue}"?`,
				'This will remove all actions and feedbacks associated with this connection.',
			],
			'Delete',
			() => {
				deleteMutation.mutateAsync({ connectionId: panelStore.connectionId }).catch((e) => {
					console.error('Delete failed', e)
				})
				void navigate({ to: '/connections/configured' })
			}
		)
	}, [deleteMutation, confirmModalRef, panelStore, navigate])

	return (
		<div className="row connection-form-buttons border-top">
			<CCol sm={12}>
				<div className="flex flex-row">
					<GenericConfirmModal ref={confirmModalRef} />

					<div className="grow">
						<CButton
							color="success"
							className="me-md-1"
							disabled={isLoading || isSaving || !isValid || !panelStore.isDirty()}
							type="submit"
							title={!isValid ? 'Please fix the errors before saving' : undefined}
						>
							Save {isSaving ? '...' : ''}
						</CButton>

						<CButton color="secondary" onClick={closeConfigurePanel} disabled={isSaving || isLoading}>
							Cancel
						</CButton>
					</div>

					<div>
						<CButton color="danger" onClick={doDelete} disabled={isSaving || isLoading}>
							Delete
						</CButton>
					</div>
				</div>
			</CCol>
		</div>
	)
})
