import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, useComputed } from '../util.js'
import { CRow, CCol, CButton, CFormSelect, CAlert, CInputGroup } from '@coreui/react'
import { TextInputField } from '../Components/index.js'
import { nanoid } from 'nanoid'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { ClientConnectionConfig, ConnectionUpdatePolicy } from '@companion-app/shared/Model/Connections.js'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible.js'
import { ExtendedInputField } from '@companion-app/shared/Model/Options.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ConnectionEditField } from './ConnectionEditField.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { getModuleVersionInfoForConnection } from './Util.js'
import { DropdownChoiceInt } from '../LocalVariableDefinitions.js'
import semver from 'semver'
import { useModuleStoreInfo, useModuleUpgradeToVersions } from '../Modules/ModuleManagePanel.js'
import { ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import { ModuleVersionsRefresh } from './ModuleVersionsRefresh.js'
import { ConnectionForceVersionButton } from './ConnectionForceVersionButton.js'

interface ConnectionEditPanelProps {
	connectionId: string
	doConfigureConnection: (connectionId: string | null) => void
}

export const ConnectionEditPanel = observer(function ConnectionEditPanel({
	connectionId,
	doConfigureConnection,
}: ConnectionEditPanelProps) {
	const { connections, modules } = useContext(RootAppStoreContext)

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
			doConfigureConnection={doConfigureConnection}
		/>
	)
})

interface ConnectionEditPanelInnerProps {
	connectionId: string
	connectionInfo: ClientConnectionConfig
	moduleInfo: ClientModuleInfo | undefined
	doConfigureConnection: (connectionId: string | null) => void
}

const ConnectionEditPanelInner = observer(function ConnectionEditPanelInner({
	connectionId,
	connectionInfo,
	moduleInfo,
	doConfigureConnection,
}: ConnectionEditPanelInnerProps) {
	const { socket, helpViewer, modules } = useContext(RootAppStoreContext)

	const [error, setError] = useState<string | null>(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const [configFields, setConfigFields] = useState<Array<ExtendedInputField & { width: number }> | null>([])
	const [connectionConfig, setConnectionConfig] = useState<Record<string, any> | null>(null)
	const [connectionLabel, setConnectionLabel] = useState<string>(connectionInfo.label)
	const [connectionVersion, setConnectionVersion] = useState<string | null>(connectionInfo.moduleVersionId)
	const [connectionUpdatePolicy, setConnectionUpdatePolicy] = useState<ConnectionUpdatePolicy | null>(
		connectionInfo.updatePolicy
	)
	const [validFields, setValidFields] = useState<Record<string, boolean | undefined> | null>(null)

	// Update the in-edit label if the connection label changes
	useEffect(() => setConnectionLabel(connectionInfo.label), [connectionInfo.label])
	// Update the in-edit version if the connection version changes
	useEffect(
		() => setConnectionVersion(connectionInfo.moduleVersionId),
		[connectionInfo.moduleVersionId, connectionInfo.enabled]
	)
	useEffect(
		() => setConnectionUpdatePolicy(connectionInfo.updatePolicy),
		[connectionInfo.updatePolicy, connectionInfo.enabled]
	)

	const [configOptions, fieldVisibility] = useOptionsAndIsVisible<ExtendedInputField & { width: number }>(
		configFields,
		connectionConfig
	)

	const invalidFieldNames = useMemo(() => {
		const fieldNames: string[] = []

		if (validFields) {
			for (const [field, valid] of Object.entries(validFields)) {
				if (!valid && fieldVisibility[field] !== false) {
					fieldNames.push(field)
				}
			}
		}

		return fieldNames
	}, [validFields, fieldVisibility])

	const doCancel = useCallback(() => {
		doConfigureConnection(null)
		setConfigFields([])
	}, [doConfigureConnection])

	const connectionVersionExists = doesConnectionVersionExist(moduleInfo, connectionInfo.moduleVersionId)
	const connectionShouldBeRunning = connectionInfo.enabled && connectionVersionExists

	const doSave = useCallback(() => {
		setError(null)

		const newLabel = connectionLabel?.trim()

		if (!newLabel || !isLabelValid(newLabel) || invalidFieldNames.length > 0) {
			setError(`Some config fields are not valid: ${invalidFieldNames.join(', ')}`)
			return
		}

		if (!connectionShouldBeRunning) {
			socket
				.emitPromise('connections:set-label-and-version', [
					connectionId,
					newLabel,
					connectionVersion,
					connectionUpdatePolicy,
				])
				.then((err) => {
					if (err) {
						if (err === 'invalid label') {
							setError(`The label "${newLabel}" in not valid`)
						} else if (err === 'duplicate label') {
							setError(`The label "${newLabel}" is already in use. Please use a unique label for this connection`)
						} else {
							setError(`Unable to save connection version: "${err}"`)
						}
					} else {
						// Done
						doCancel()
					}
				})
				.catch((e) => {
					setError(`Failed to save connection config: ${e}`)
				})
		} else if (connectionConfig) {
			socket
				.emitPromise('connections:set-label-and-config', [connectionId, newLabel, connectionConfig])
				.then((err) => {
					if (err) {
						if (err === 'invalid label') {
							setError(`The label "${newLabel}" in not valid`)
						} else if (err === 'duplicate label') {
							setError(`The label "${newLabel}" is already in use. Please use a unique label for this connection`)
						} else {
							setError(`Unable to save connection config: "${err}"`)
						}
					} else {
						// Done
						doCancel()
					}
				})
				.catch((e) => {
					setError(`Failed to save connection config: ${e}`)
				})
		}
	}, [
		socket,
		connectionId,
		invalidFieldNames,
		connectionLabel,
		connectionConfig,
		doCancel,
		connectionShouldBeRunning,
		connectionVersion,
		connectionUpdatePolicy,
	])

	useEffect(() => {
		if (connectionId) {
			socket
				.emitPromise('connections:edit', [connectionId])
				.then((res) => {
					if (res) {
						if (res.fields) {
							const validFields: Record<string, boolean> = {}
							for (const field of res.fields) {
								// Real validation status gets generated when the editor components first mount
								validFields[field.id] = true
							}

							setConfigFields(res.fields)
							setValidFields(validFields)
						} else {
							setConfigFields(null)
							setValidFields(null)
						}

						setConnectionConfig(res.config as any)
					} else {
						setError(`Connection config unavailable`)
					}
				})
				.catch((e) => {
					setError(`Failed to load connection info: "${e}"`)
				})
		}

		return () => {
			setError(null)
			setConfigFields(null)
			setConnectionConfig(null)
			setValidFields(null)
		}
	}, [socket, connectionId, reloadToken])

	const doRetryConfigLoad = useCallback(() => setReloadToken(nanoid()), [])

	const moduleVersion = getModuleVersionInfoForConnection(moduleInfo, connectionInfo.moduleVersionId)
	const isModuleOnStore = !!modules.storeList.get(connectionInfo.instance_type)

	const moduleVersionChoices = useConnectionVersionSelectOptions(connectionInfo.instance_type, moduleInfo, true)

	const doShowHelp = useCallback(
		() =>
			moduleVersion?.helpPath &&
			helpViewer.current?.showFromUrl(connectionInfo.instance_type, moduleVersion.versionId, moduleVersion.helpPath),
		[helpViewer, connectionInfo.instance_type, moduleVersion]
	)

	return (
		<div>
			<h5>
				{moduleInfo?.display?.shortname ?? connectionInfo.instance_type} configuration
				{moduleVersion?.helpPath && (
					<div className="float_right" onClick={doShowHelp}>
						<FontAwesomeIcon icon={faQuestionCircle} />
					</div>
				)}
			</h5>
			<CRow className="edit-connection">
				<CCol className={`fieldtype-textinput`} sm={12}>
					<label>Label</label>
					<TextInputField
						value={connectionLabel ?? ''}
						setValue={setConnectionLabel}
						// isValid={isLabelValid(connectionLabel)}
					/>
				</CCol>

				<CCol className={`fieldtype-textinput`} sm={12}>
					<label>
						Module Version&nbsp;
						{isModuleOnStore && !connectionShouldBeRunning && (
							<ModuleVersionsRefresh moduleId={connectionInfo.instance_type} />
						)}
					</label>
					<CInputGroup>
						<CFormSelect
							name="colFormVersion"
							value={connectionVersion as string}
							onChange={(e) => setConnectionVersion(e.currentTarget.value)}
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
					<CFormSelect
						name="colFormUpdatePolicy"
						value={connectionUpdatePolicy as string}
						onChange={(e) => setConnectionUpdatePolicy(e.currentTarget.value as ConnectionUpdatePolicy)}
					>
						<option value="manual">Manual</option>
						<option value="stable">Stable</option>
						<option value="beta">Stable and Beta</option>
					</CFormSelect>
				</CCol>

				<CCol className={`fieldtype-textinput`} sm={12}>
					<CAlert color="warning">
						Be careful when downgrading the module version. Some features may not be available in older versions.
					</CAlert>
				</CCol>

				{connectionShouldBeRunning ? (
					<ConnectionEditPanelConfigFields
						connectionConfig={connectionConfig}
						configOptions={configFields === null ? null : configOptions}
						fieldVisibility={fieldVisibility}
						setConnectionConfig={setConnectionConfig}
						setValidFields={setValidFields}
						connectionId={connectionId}
						error={error}
						doRetryConfigLoad={doRetryConfigLoad}
					/>
				) : (
					<CCol xs={12}>
						<p>Connection config cannot be edited while disabled</p>
					</CCol>
				)}
			</CRow>

			<CRow>
				<CCol sm={12}>
					<CButton
						color="success"
						className="me-md-1"
						disabled={invalidFieldNames.length > 0 || !connectionLabel || !isLabelValid(connectionLabel)}
						onClick={doSave}
					>
						Save
					</CButton>

					<CButton color="secondary" onClick={doCancel}>
						Cancel
					</CButton>
				</CCol>
			</CRow>
		</div>
	)
})

export function useConnectionVersionSelectOptions(
	moduleId: string | undefined,
	installedInfo: ClientModuleInfo | null | undefined,
	includeBeta: boolean
): DropdownChoiceInt[] {
	const moduleStoreInfo = useModuleStoreInfo(moduleId)
	const upgradeToVersions = useModuleUpgradeToVersions(moduleId)

	const latestStableVersion = getLatestVersion(moduleStoreInfo?.versions, false)
	const latestBetaVersion = getLatestVersion(moduleStoreInfo?.versions, true)

	return useComputed(() => {
		const choices: DropdownChoiceInt[] = []

		const listedVersions = new Set<string>()
		if (installedInfo) {
			for (const version of installedInfo.installedVersions) {
				if (!includeBeta && version.isBeta) continue

				let label = version.displayName
				if (installedInfo.stableVersion?.versionId === version.versionId) {
					label += ' (Latest stable)'
				}

				choices.push({ value: version.versionId, label })
				listedVersions.add(version.versionId)
			}
		}

		if (
			latestStableVersion &&
			!listedVersions.has(latestStableVersion.id) &&
			(!installedInfo?.stableVersion ||
				semver.compare(latestStableVersion.id, installedInfo.stableVersion.versionId) > 0)
		) {
			choices.push({ value: latestStableVersion.id, label: `v${latestStableVersion.id} (Install latest stable)` })
		}

		if (
			includeBeta &&
			latestBetaVersion &&
			!listedVersions.has(latestBetaVersion.id) &&
			(!installedInfo?.betaVersion || semver.compare(latestBetaVersion.id, installedInfo.betaVersion.versionId) > 0)
		) {
			choices.push({
				value: latestBetaVersion.id,
				label: `v${latestBetaVersion.id} (Install latest beta)`,
			})
		}

		choices.sort((a, b) => semver.compare(String(b.value), String(a.value)))

		if (installedInfo?.devVersion) choices.unshift({ value: 'dev', label: 'Dev version' })

		const replacementChoices: DropdownChoiceInt[] = []
		// Push the potential replacements first
		for (const upgradeTo of upgradeToVersions) {
			if (upgradeTo.versionId) {
				replacementChoices.push({
					value: `${upgradeTo.moduleId}@${upgradeTo.versionId}`,
					label: `${upgradeTo.displayName} (v${upgradeTo.versionId})`,
				})
			} else {
				replacementChoices.push({
					value: `${upgradeTo.moduleId}@`,
					label: `${upgradeTo.displayName} (Latest stable)`,
				})
			}
		}

		return [...replacementChoices, ...choices]
	}, [installedInfo, upgradeToVersions, latestStableVersion, latestBetaVersion, includeBeta])
}

export function doesConnectionVersionExist(
	moduleInfo: ClientModuleInfo | undefined,
	versionId: string | null
): boolean {
	if (versionId === null) return false
	if (versionId === 'dev') return !!moduleInfo?.devVersion

	return !!moduleInfo?.installedVersions.find((v) => v.versionId === versionId)
}

export function getLatestVersion(
	versions: ModuleStoreModuleInfoVersion[] | undefined,
	isBeta: boolean
): ModuleStoreModuleInfoVersion | null {
	let latest: ModuleStoreModuleInfoVersion | null = null
	for (const version of versions || []) {
		if (!version || (version.releaseChannel === 'beta') !== isBeta) continue
		if (!isModuleApiVersionCompatible(version.apiVersion) || version.deprecationReason) continue
		if (!latest || semver.compare(version.id, latest.id) > 0) {
			latest = version
		}
	}

	return latest
}

interface ConnectionEditPanelConfigFieldsProps {
	connectionConfig: Record<string, any> | null
	configOptions: Array<ExtendedInputField & { width: number }> | null
	fieldVisibility: Record<string, boolean | undefined>
	setConnectionConfig: React.Dispatch<React.SetStateAction<Record<string, any>>>
	setValidFields: React.Dispatch<React.SetStateAction<Record<string, boolean | undefined> | null>>
	connectionId: string
	error: string | null
	doRetryConfigLoad: () => void
}

function ConnectionEditPanelConfigFields({
	connectionConfig,
	configOptions,
	fieldVisibility,
	setConnectionConfig,
	setValidFields,
	connectionId,
	error,
	doRetryConfigLoad,
}: ConnectionEditPanelConfigFieldsProps) {
	const setValue = useCallback(
		(key: string, value: any) => {
			console.log('set value', key, value)

			setConnectionConfig((oldConfig) => ({
				...oldConfig,
				[key]: value,
			}))
		},
		[setConnectionConfig]
	)
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

	if (!configOptions || !connectionConfig) {
		return <LoadingRetryOrError error={error} dataReady={false} doRetry={doRetryConfigLoad} autoRetryAfter={2} />
	}

	return (
		<>
			{configOptions.map((field, i) => {
				return (
					<CCol
						key={i}
						className={`fieldtype-${field.type}`}
						sm={field.width}
						style={{ display: fieldVisibility[field.id] === false ? 'none' : undefined }}
					>
						<ConnectionEditField
							label={
								<>
									{field.label}
									{field.tooltip && (
										<FontAwesomeIcon style={{ marginLeft: '5px' }} icon={faQuestionCircle} title={field.tooltip} />
									)}
								</>
							}
							definition={field}
							value={connectionConfig[field.id]}
							// valid={validFields[field.id] ?? false}
							setValue={setValue}
							setValid={setValid}
							connectionId={connectionId}
						/>
					</CCol>
				)
			})}
		</>
	)
}
