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
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { ConnectionsContext, PreventDefaultHandler, socketEmitPromise } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { CModalExt } from '../Components/CModalExt.js'
import {
	ModuleVersionInfo,
	NewClientModuleInfo,
	NewClientModuleVersionInfo2,
} from '@companion-app/shared/Model/ModuleInfo.js'
import { makeLabelSafe } from '@companion-app/shared/Label.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Common.js'
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
		const { socket, notifier } = useContext(RootAppStoreContext)
		const connections = useContext(ConnectionsContext)

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
					setConnectionLabel(findNextConnectionLabel(connections, info.shortname))
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

		const moduleVersion = getModuleVersionInfoForConnection(moduleInfo?.installedInfo, {
			moduleVersionMode: selectedVersion.mode,
			moduleVersionId: selectedVersion.id,
		})

		const versionOptions = useMemo(
			() => moduleInfo?.installedInfo && getConnectionVersionSelectOptions(moduleInfo.installedInfo),
			[moduleInfo]
		)

		// Ensure the currently selection version is a valid option
		useEffect(() => {
			if (!versionOptions) return

			setSelectedVersion((value) => {
				const valueStr = JSON.stringify(value)

				// Check if value is still valid
				if (versionOptions.find((v) => v.value === valueStr)) return value

				// It is not, so choose the first option
				return JSON.parse(versionOptions[0].value)
			})
		}, [versionOptions])

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
									{moduleVersion?.hasHelp && (
										<div className="float_right" onClick={() => showHelp(moduleInfo.id, moduleVersion)}>
											<FontAwesomeIcon icon={faQuestionCircle} />
										</div>
									)}
								</CFormLabel>
								<CCol sm={8}>
									<CFormSelect
										name="colFormVersion"
										value={JSON.stringify(selectedVersion)}
										onChange={(e) => setSelectedVersion(JSON.parse(e.currentTarget.value))}
									>
										{versionOptions?.map((v) => (
											<option key={v.value} value={v.value}>
												{v.label}
											</option>
										))}
									</CFormSelect>
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
	connections: Record<string, ClientConnectionConfig>,
	shortname: string,
	ignoreId?: string
): string {
	let prefix = shortname

	const knownLabels = new Set()
	for (const [id, obj] of Object.entries(connections)) {
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
