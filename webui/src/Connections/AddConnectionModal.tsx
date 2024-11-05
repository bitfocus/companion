import React, { useContext, useState, useCallback, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react'
import {
	CAlert,
	CButton,
	CCol,
	CForm,
	CFormInput,
	CFormLabel,
	CFormSelect,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle, faRefresh, faSync } from '@fortawesome/free-solid-svg-icons'
import { PreventDefaultHandler, socketEmitPromise } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { CModalExt } from '../Components/CModalExt.js'
import {
	ModuleVersionInfo,
	NewClientModuleInfo,
	NewClientModuleVersionInfo2,
} from '@companion-app/shared/Model/ModuleInfo.js'
import { makeLabelSafe } from '@companion-app/shared/Label.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { getModuleVersionInfoForConnection } from './Util.js'
import { DropdownChoiceInt } from '../LocalVariableDefinitions.js'
import type { AddConnectionProduct } from './AddConnection.js'
import { useModuleStoreInfo } from '../Modules/ModuleManagePanel.js'

export interface AddConnectionModalRef {
	show(info: AddConnectionProduct): void
}

interface AddConnectionModalProps {
	doConfigureConnection: (connectionId: string) => void
	showHelp: (moduleId: string, moduleVersion: NewClientModuleVersionInfo2) => void
}

export const AddConnectionModal = observer(
	forwardRef<AddConnectionModalRef, AddConnectionModalProps>(function AddActionsModal(
		{ doConfigureConnection, showHelp },
		ref
	) {
		const { socket, notifier, connections } = useContext(RootAppStoreContext)

		const [show, setShow] = useState(false)
		const [moduleInfo, setModuleInfo] = useState<AddConnectionProduct | null>(null)
		const [selectedVersion, setSelectedVersion] = useState<ModuleVersionInfo>({
			mode: 'stable',
			id: null,
		})
		const [connectionLabel, setConnectionLabel] = useState<string>('')

		const moduleStoreInfo = useModuleStoreInfo(moduleInfo?.id)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			setModuleInfo(null)
			setSelectedVersion({
				mode: 'stable',
				id: null,
			})
			setConnectionLabel('')
		}, [])

		const doAction = () => {
			if (!moduleInfo || !connectionLabel || !selectedVersion) return

			socketEmitPromise(socket, 'connections:add', [
				{
					type: moduleInfo.id,
					product: moduleInfo.product,
				},
				connectionLabel,
				selectedVersion,
			])
				.then((id) => {
					console.log('NEW CONNECTION', id)
					setShow(false)
					setTimeout(() => {
						// Wait a bit to let the server catch up
						doConfigureConnection(id)
					}, 1000)
				})
				.catch((e) => {
					notifier.current?.show(`Failed to create connection`, `Failed: ${e}`)
					console.error('Failed to create connection:', e)
				})
		}

		useImperativeHandle(
			ref,
			() => ({
				show(info) {
					setShow(true)
					setModuleInfo(info)

					// There is a useEffect below that ensures this is valid
					setSelectedVersion({
						mode: 'stable',
						id: null,
					})
					setConnectionLabel(findNextConnectionLabel(connections.connections, info.shortname))
				},
			}),
			[connections]
		)

		let selectedVersionIsLegacy = false
		switch (selectedVersion.mode) {
			case 'stable':
				selectedVersionIsLegacy = moduleInfo?.installedInfo?.stableVersion?.isLegacy ?? false
				break
			case 'specific-version':
				selectedVersionIsLegacy =
					moduleInfo?.installedInfo?.installedVersions.find((v) => v.version.id === selectedVersion.id)?.isLegacy ??
					false
				break
		}

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} scrollable={true}>
				{moduleInfo && (
					<>
						<CModalHeader closeButton>
							<h5>
								Add {moduleInfo.manufacturer} {moduleInfo.product}
							</h5>
						</CModalHeader>
						<CModalBody>
							<p>
								It is now possible to load install different versions of modules without updating Companion. Once you
								have installed different versions of a module, you can choose which one to use for a new connection
								here.
							</p>
							<CForm className="row g-3" onSubmit={PreventDefaultHandler}>
								<CFormLabel htmlFor="colFormLabel" className="col-sm-4 col-form-label col-form-label-sm">
									Label&nbsp;
								</CFormLabel>
								<CCol sm={8}>
									<CFormInput
										name="colFormLabel"
										value={connectionLabel}
										onChange={(e) => setConnectionLabel(e.currentTarget.value)}
									/>
								</CCol>

								<CFormLabel htmlFor="colFormVersion" className="col-sm-4 col-form-label col-form-label-sm">
									Module Version&nbsp;
									{/* {moduleVersion?.hasHelp && (
										<div className="float_right" onClick={() => showHelp(moduleInfo.id, moduleVersion)}>
											<FontAwesomeIcon icon={faQuestionCircle} />
										</div>
									)} */}
									{!!moduleStoreInfo && <ModuleVersionsRefresh moduleId={moduleInfo.id} />}
								</CFormLabel>
								<CCol sm={8}>
									<ModuleVersionPicker
										moduleInfo={moduleInfo}
										selectedVersion={selectedVersion}
										setSelectedVersion={setSelectedVersion}
									/>
								</CCol>
							</CForm>

							{selectedVersionIsLegacy && (
								<>
									<hr />
									<CAlert color="warning">
										<p>
											This module has not been verified to be compatible with this version of companion. It may be buggy
											or broken.
										</p>
										<p>
											If this module is broken, please let the module author know on{' '}
											<a target="_blank" rel="noreferrer" href={moduleInfo.bugUrl}>
												Github
											</a>
										</p>
									</CAlert>
								</>
							)}
						</CModalBody>
						<CModalFooter>
							<CButton color="secondary" onClick={doClose}>
								Cancel
							</CButton>
							<CButton
								color="primary"
								onClick={doAction}
								disabled={!moduleInfo || !connectionLabel || !selectedVersion}
							>
								Add
							</CButton>
						</CModalFooter>
					</>
				)}
			</CModalExt>
		)
	})
)

// nocommit TODO: this is a copy of the function from companion/lib/Instance/ConnectionConfigStore.ts
function findNextConnectionLabel(
	connections: ReadonlyMap<string, ClientConnectionConfig>,
	shortname: string,
	ignoreId?: string
): string {
	let prefix = shortname

	const knownLabels = new Set()
	for (const [id, obj] of connections) {
		if (id !== ignoreId && obj && obj.label) {
			knownLabels.add(obj.label)
		}
	}

	prefix = makeLabelSafe(prefix)

	let label = prefix
	let i = 1
	while (knownLabels.has(label)) {
		// Try the next
		label = `${prefix}_${++i}`
	}

	return label
}

interface ModuleVersionsRefreshProps {
	moduleId: string | null
}
const ModuleVersionsRefresh = observer(function ModuleVersionsRefresh({ moduleId }: ModuleVersionsRefreshProps) {
	const { socket, moduleStoreRefreshProgress } = useContext(RootAppStoreContext)

	const refreshProgress = (moduleId ? moduleStoreRefreshProgress.get(moduleId) : null) ?? 1

	const doRefreshModules = useCallback(() => {
		if (!moduleId) return
		socketEmitPromise(socket, 'modules-store:info:refresh', [moduleId]).catch((err) => {
			console.error('Failed to refresh module info', err)
		})
	}, [moduleId])

	if (refreshProgress === 1) {
		return (
			<div className="float_right" onClick={doRefreshModules}>
				<FontAwesomeIcon icon={faSync} title="Refresh module info" />
			</div>
		)
	} else {
		return (
			<div className="float_right">
				<FontAwesomeIcon
					icon={faSync}
					spin={true}
					title={`Refreshing module info ${Math.round(refreshProgress * 100)}%`}
				/>
			</div>
		)
	}
})

interface ModuleVersionPickerProps {
	moduleInfo: AddConnectionProduct | null
	selectedVersion: ModuleVersionInfo
	setSelectedVersion: React.Dispatch<React.SetStateAction<ModuleVersionInfo>>
}

const ModuleVersionPicker = observer(function ModuleVersionPicker({
	moduleInfo,
	selectedVersion,
	setSelectedVersion,
}: ModuleVersionPickerProps) {
	const versionChoices = useMemo(() => {
		const choices: DropdownChoiceInt[] = []

		if (moduleInfo?.installedInfo) {
			if (moduleInfo.installedInfo.stableVersion)
				choices.push({
					value: JSON.stringify(moduleInfo.installedInfo.stableVersion.version),
					label: moduleInfo.installedInfo.stableVersion.displayName,
				})

			if (moduleInfo.installedInfo.prereleaseVersion)
				choices.push({
					value: JSON.stringify(moduleInfo.installedInfo.prereleaseVersion.version),
					label: moduleInfo.installedInfo.prereleaseVersion.displayName,
				})

			for (const version of moduleInfo.installedInfo.installedVersions) {
				choices.push({ value: JSON.stringify(version.version), label: version.displayName })
			}
		}

		return choices
	}, [moduleInfo])

	// const moduleVersion = getModuleVersionInfoForConnection(moduleInfo?.installedInfo, {
	// 	moduleVersionMode: selectedVersion.mode,
	// 	moduleVersionId: selectedVersion.id,
	// })

	// Ensure the currently selection version is a valid option
	useEffect(() => {
		if (!versionChoices || versionChoices.length === 0) return

		setSelectedVersion((value) => {
			const valueStr = JSON.stringify(value)

			// Check if value is still valid
			if (versionChoices.find((v) => v.value === valueStr)) return value

			// It is not, so choose the first option
			return JSON.parse(versionChoices[0].value)
		})
	}, [versionChoices])

	return (
		<CFormSelect
			name="colFormVersion"
			value={JSON.stringify(selectedVersion)}
			onChange={(e) => setSelectedVersion(JSON.parse(e.currentTarget.value))}
		>
			{versionChoices?.map((v) => (
				<option key={v.value} value={v.value}>
					{v.label}
				</option>
			))}
		</CFormSelect>
	)
})

/**
 * @deprecated move this
 */
export function getConnectionVersionSelectOptions(moduleInfo: NewClientModuleInfo): DropdownChoiceInt[] {
	const choices: DropdownChoiceInt[] = []

	if (moduleInfo.stableVersion)
		choices.push({
			value: JSON.stringify(moduleInfo.stableVersion.version),
			label: moduleInfo.stableVersion.displayName,
		})

	if (moduleInfo.prereleaseVersion)
		choices.push({
			value: JSON.stringify(moduleInfo.prereleaseVersion.version),
			label: moduleInfo.prereleaseVersion.displayName,
		})

	for (const version of moduleInfo.installedVersions) {
		choices.push({ value: JSON.stringify(version.version), label: version.displayName })
	}

	return choices
}
