import React, { useCallback, useContext, useEffect, useState } from 'react'
import { LoadingRetryOrError } from '~/util.js'
import { CRow, CCol, CButton, CFormSelect, CAlert, CInputGroup, CForm, CFormInput } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGear, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { ClientConnectionConfig, ConnectionUpdatePolicy } from '@companion-app/shared/Model/Connections.js'
import { useOptionsAndIsVisibleFns } from '~/Hooks/useOptionsAndIsVisible.js'
import { ConnectionInputField } from '@companion-app/shared/Model/Options.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ConnectionEditField } from './ConnectionEditField.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { ModuleVersionsRefresh } from '../ModuleVersionsRefresh.js'
import { ConnectionForceVersionButton } from './ConnectionForceVersionButton.js'
import { doesConnectionVersionExist } from './VersionUtil.js'
import { useConnectionVersionSelectOptions } from './useConnectionVersionSelectOptions.js'
import { useConnectionCurrentConfig } from './useConnectionCurrentConfig.js'
import { ConnectionEditPanelHeading } from './ConnectionEditPanelHeading.js'
import { useForm } from '@tanstack/react-form'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { ConnectionSecretField } from './ConnectionSecretField.js'

interface ConnectionEditPanelProps {
	connectionId: string
	doConfigureConnection: (connectionId: string | null) => void
}

export const ConnectionEditPanel = observer(function ConnectionEditPanel({
	connectionId,
	doConfigureConnection,
}: ConnectionEditPanelProps) {
	const { connections, modules } = useContext(RootAppStoreContext)

	const closeConfigurePanel = useCallback(() => doConfigureConnection(null), [doConfigureConnection])

	const connectionInfo: ClientConnectionConfig | undefined = connections.getInfo(connectionId)

	const moduleInfo = connectionInfo && modules.modules.get(connectionInfo.instance_type)

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
			moduleInfo={moduleInfo}
			closeConfigurePanel={closeConfigurePanel}
		/>
	)
})

interface ConnectionEditPanelInnerProps {
	connectionId: string
	connectionInfo: ClientConnectionConfig
	moduleInfo: ClientModuleInfo | undefined
	closeConfigurePanel: () => void
}

const ConnectionEditPanelInner = observer(function ConnectionEditPanelInner({
	connectionId,
	connectionInfo,
	moduleInfo,
	closeConfigurePanel,
}: ConnectionEditPanelInnerProps) {
	const { socket, modules } = useContext(RootAppStoreContext)

	const connectionVersionExists = doesConnectionVersionExist(moduleInfo, connectionInfo.moduleVersionId)
	const connectionShouldBeRunning = connectionInfo.enabled && connectionVersionExists

	const isModuleOnStore = !!modules.storeList.get(connectionInfo.instance_type)
	const moduleVersionChoices = useConnectionVersionSelectOptions(connectionInfo.instance_type, moduleInfo, true)

	const [saveError, setSaveError] = useState<string | null>(null)

	const form = useForm({
		defaultValues: {
			label: connectionInfo.label,
			versionId: connectionInfo.moduleVersionId,
			updatePolicy: connectionInfo.updatePolicy,
			config: {} as Record<string, any>,
			secrets: {} as Record<string, any>,
			hasSecrets: {} as Record<string, boolean>,
		},
		onSubmit: async ({ value }) => {
			setSaveError(null)

			if (hasInvalidFields) {
				setSaveError('Please correct any invalid fields before saving')
				return
			}

			if (!connectionShouldBeRunning) {
				await socket
					.emitPromise('connections:set-label-and-version', [
						connectionId,
						value.label,
						value.versionId,
						value.updatePolicy,
					])
					.then((err) => {
						if (err) {
							if (err === 'invalid label') {
								setSaveError(`The label "${value.label}" in not valid`)
							} else if (err === 'duplicate label') {
								setSaveError(
									`The label "${value.label}" is already in use. Please use a unique label for this connection`
								)
							} else {
								setSaveError(`Unable to save connection version: "${err}"`)
							}
						} else {
							// Done
							closeConfigurePanel()
						}
					})
					.catch((e) => {
						setSaveError(`Failed to save connection config: ${e}`)
					})
			} else if (query.isSuccess) {
				await socket
					.emitPromise('connections:set-label-and-config', [
						connectionId,
						value.label,
						value.config,
						value.secrets,
						value.updatePolicy,
					])
					.then((err) => {
						if (err) {
							if (err === 'invalid label') {
								setSaveError(`The label "${value.label}" in not valid`)
							} else if (err === 'duplicate label') {
								setSaveError(
									`The label "${value.label}" is already in use. Please use a unique label for this connection`
								)
							} else {
								setSaveError(`Unable to save connection config: "${err}"`)
							}
						} else {
							// Done
							closeConfigurePanel()
						}
					})
					.catch((e) => {
						setSaveError(`Failed to save connection config: ${e}`)
					})
			}
		},
	})

	const [validFields, setValidFields] = useState<Record<string, boolean | undefined> | null>(null)

	// Update the form with the connection config
	const query = useConnectionCurrentConfig(connectionId)
	useEffect(() => {
		form.setFieldValue('config', query.data?.config ?? {})
		form.setFieldValue('hasSecrets', query.data?.hasSecrets ?? {})
		form.setFieldValue('secrets', {}) // clear secrets, so that everything reloads

		const validFields: Record<string, boolean> = {}
		for (const field of query.data?.fields ?? []) {
			// Real validation status gets generated when the editor components first mount
			validFields[field.id] = true
		}

		setValidFields(validFields)
	}, [form, query.data, query.isLoading])

	// Update some form values when changed elsewhere
	useEffect(() => form.setFieldValue('label', connectionInfo.label), [form, connectionInfo.label])
	useEffect(
		() => form.setFieldValue('versionId', connectionInfo.moduleVersionId),
		[form, connectionInfo.moduleVersionId]
	)
	useEffect(() => form.setFieldValue('updatePolicy', connectionInfo.updatePolicy), [form, connectionInfo.updatePolicy])

	const [configOptions, isVisibleFns] = useOptionsAndIsVisibleFns<ConnectionInputField & { width: number }>(
		query.data?.fields
	)

	// Future: This checking validity flow is horrible, and should be reworked to be more tanstack-form native
	const setValid = useCallback(
		(key: string, isValid: boolean) => {
			console.log('set valid', key, isValid)

			setValidFields((oldValid) => ({
				...oldValid,
				[key]: isValid,
			}))
		},
		[setValidFields]
	)
	const hasInvalidFields = Object.values(validFields ?? {}).some((v) => v === false)

	return (
		<div>
			<ConnectionEditPanelHeading connectionInfo={connectionInfo} moduleInfo={moduleInfo} />

			<CForm
				className="row edit-connection"
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					form.handleSubmit()
				}}
			>
				{saveError && (
					<CCol className={`fieldtype-textinput`} sm={12}>
						<CAlert color="danger">{saveError}</CAlert>
					</CCol>
				)}

				<form.Field
					name="label"
					validators={{
						onChange: ({ value }) => (!isLabelValid(value) ? 'Invalid label' : undefined),
					}}
					children={(field) => (
						<CCol className={`fieldtype-textinput`} sm={12}>
							<label>Label</label>
							<CFormInput
								type="text"
								style={{ color: field.state.meta.errors.length ? 'red' : undefined }}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
							/>
						</CCol>
					)}
				/>

				<CCol className={`fieldtype-textinput`} sm={12}>
					<label>
						Module Version&nbsp;
						{isModuleOnStore && !connectionShouldBeRunning && (
							<ModuleVersionsRefresh moduleId={connectionInfo.instance_type} />
						)}
					</label>
					<CInputGroup>
						<form.Field
							name="versionId"
							children={(field) => (
								<CFormSelect
									name="colFormVersion"
									value={field.state.value as string}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									disabled={connectionShouldBeRunning}
									title={
										connectionShouldBeRunning
											? 'Connection must be disabled to change version'
											: 'Select the version of the module to use for this connection'
									}
								>
									{!connectionVersionExists &&
										!moduleVersionChoices.find((v) => v.value === connectionInfo.moduleVersionId) && (
											<option value={connectionInfo.moduleVersionId as string}>
												{connectionInfo.moduleVersionId} (Missing)
											</option>
										)}
									{moduleVersionChoices.map((v) => (
										<option key={v.value} value={v.value}>
											{v.label}
										</option>
									))}
								</CFormSelect>
							)}
						/>

						<ConnectionForceVersionButton
							connectionId={connectionId}
							disabled={connectionShouldBeRunning}
							currentModuleId={connectionInfo.instance_type}
							currentVersionId={connectionInfo.moduleVersionId}
						/>
					</CInputGroup>
				</CCol>

				<CCol className={`fieldtype-textinput`} sm={12}>
					<label>
						Update Policy
						<FontAwesomeIcon
							style={{ marginLeft: '5px' }}
							icon={faQuestionCircle}
							title="How to check whether there are updates available for this connection"
						/>
					</label>
					<form.Field
						name="updatePolicy"
						children={(field) => (
							<CFormSelect
								name="colFormUpdatePolicy"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.currentTarget.value as ConnectionUpdatePolicy)}
								onBlur={field.handleBlur}
							>
								<option value="manual">Manual</option>
								<option value="stable">Stable</option>
								<option value="beta">Stable and Beta</option>
							</CFormSelect>
						)}
					/>
				</CCol>

				<CCol className={`fieldtype-textinput`} sm={12}>
					<CAlert color="warning">
						Be careful when downgrading the module version. Some features may not be available in older versions.
					</CAlert>
				</CCol>

				{!connectionShouldBeRunning && (
					<CCol xs={12}>
						<NonIdealState icon={faGear}>
							<p>You cannot edit the config of a connection while it is disabled</p>
						</NonIdealState>
					</CCol>
				)}

				{connectionShouldBeRunning && query.isSuccess && (
					<>
						{configOptions.map((fieldInfo) => (
							<form.Subscribe
								selector={(state) => {
									const fn = isVisibleFns[fieldInfo.id]
									const isVisible = !fn || !!fn(state.values.config)

									const hasSecretValue = !!state.values.hasSecrets[fieldInfo.id]

									return { isVisible, hasSecretValue }
								}}
							>
								{({ isVisible, hasSecretValue }) => {
									const isSecret = fieldInfo.type.startsWith('secret')
									return (
										<form.Field
											key={fieldInfo.id}
											name={`${isSecret ? 'secrets' : 'config'}.${fieldInfo.id}`}
											children={(field) => {
												const label = (
													<>
														{fieldInfo.label}
														{fieldInfo.tooltip && (
															<FontAwesomeIcon
																style={{ marginLeft: '5px' }}
																icon={faQuestionCircle}
																title={fieldInfo.tooltip}
															/>
														)}
													</>
												)

												return (
													<CCol
														className={`fieldtype-${fieldInfo.type}`}
														sm={fieldInfo.width}
														style={{ display: !isVisible ? 'none' : undefined }}
													>
														{isSecret ? (
															<ConnectionSecretField
																label={label}
																definition={fieldInfo}
																hasSavedValue={hasSecretValue}
																editValue={field.state.value}
																// valid={validFields[field.id] ?? false}
																isDirty={field.state.meta.isDirty}
																setValue={field.handleChange}
																clearValue={() => {
																	field.setValue(undefined)
																	field.setMeta((me) => ({ ...me, isDirty: false }))
																}}
																setValid={setValid}
															/>
														) : (
															<ConnectionEditField
																label={label}
																definition={fieldInfo}
																value={field.state.value}
																// valid={validFields[field.id] ?? false}
																setValue={field.handleChange}
																setValid={setValid}
																connectionId={connectionId}
															/>
														)}
													</CCol>
												)
											}}
										/>
									)
								}}
							</form.Subscribe>
						))}
					</>
				)}

				{connectionShouldBeRunning && !query.isSuccess && (
					<LoadingRetryOrError
						error={!query.isRefetching ? query.error?.message : undefined}
						dataReady={false}
						doRetry={query.refetch}
					/>
				)}

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting]}
					children={([canSubmit, isSubmitting]) => (
						<CCol sm={12}>
							<CButton
								color="success"
								className="me-md-1"
								disabled={!canSubmit || isSubmitting || hasInvalidFields}
								type="submit"
							>
								Save {isSubmitting ? '...' : ''}
							</CButton>

							<CButton color="secondary" onClick={closeConfigurePanel} disabled={isSubmitting}>
								Cancel
							</CButton>
						</CCol>
					)}
				/>
			</CForm>
		</div>
	)
})
