import React, { useContext, useState, useCallback, forwardRef, useImperativeHandle, useEffect } from 'react'
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
import { PreventDefaultHandler } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { CModalExt } from '../Components/CModalExt.js'
import { makeLabelSafe } from '@companion-app/shared/Label.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import { useConnectionVersionSelectOptions } from './ConnectionEdit/useConnectionVersionSelectOptions.js'
import { ModuleVersionsRefresh } from './ModuleVersionsRefresh.js'
import type { FuzzyProduct } from '../Hooks/useFilteredProducts.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

export interface AddConnectionModalRef {
	show(info: FuzzyProduct): void
}

interface AddConnectionModalProps {
	doConfigureConnection: (connectionId: string) => void
}

export const AddConnectionModal = observer(
	forwardRef<AddConnectionModalRef, AddConnectionModalProps>(function AddActionsModal({ doConfigureConnection }, ref) {
		const { socket, helpViewer, notifier, connections, modules } = useContext(RootAppStoreContext)

		const [show, setShow] = useState(false)
		const [moduleInfo, setModuleInfo] = useState<FuzzyProduct | null>(null)
		const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
		const [connectionLabel, setConnectionLabel] = useState<string>('')

		const isModuleOnStore = !!moduleInfo && !!modules.storeList.get(moduleInfo?.id)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			setModuleInfo(null)
			setSelectedVersion(null)
			setConnectionLabel('')
		}, [])

		const doAction = () => {
			if (!moduleInfo || !connectionLabel || !selectedVersion) return

			socket
				.emitPromise('connections:add', [
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
					setSelectedVersion(null)
					setConnectionLabel(findNextConnectionLabel(connections.connections, info.shortname))
				},
			}),
			[connections]
		)

		const versionChoices = useConnectionVersionSelectOptions(moduleInfo?.id, moduleInfo?.installedInfo, false)

		// Ensure the currently selection version is a valid option
		const defaultVersionId = moduleInfo?.installedInfo?.devVersion
			? 'dev'
			: moduleInfo?.installedInfo?.stableVersion?.versionId
		useEffect(() => {
			if (!versionChoices || versionChoices.length === 0) return

			setSelectedVersion((value) => {
				const valueStr = value

				// Check if value is still valid
				if (versionChoices.find((v) => v.value === valueStr)) return value

				// It is not, so choose the first option
				if (defaultVersionId) return defaultVersionId
				if (versionChoices.length === 0) return null
				return String(versionChoices[0].value)
			})
		}, [versionChoices, defaultVersionId])

		const selectedVersionInfo =
			selectedVersion === 'dev'
				? moduleInfo?.installedInfo?.devVersion
				: moduleInfo?.installedInfo?.installedVersions.find((v) => v.versionId === selectedVersion)
		const selectedVersionIsLegacy = selectedVersionInfo?.isLegacy ?? false

		const showHelpClick = useCallback(() => {
			if (!moduleInfo || !selectedVersionInfo) return
			helpViewer.current?.showFromUrl(moduleInfo.id, selectedVersionInfo.versionId, selectedVersionInfo.helpPath)
		}, [helpViewer, moduleInfo?.id, selectedVersionInfo])

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

								<CFormLabel htmlFor="colFormVersion" className="col-sm-4 col-form-label col-form-label-sm pe-0">
									<div className="flex">
										<span className="grow">Module Version&nbsp;</span>
										{moduleInfo && selectedVersionInfo && (
											<div className="float_right" onClick={showHelpClick}>
												<FontAwesomeIcon icon={faQuestionCircle} />
											</div>
										)}
										{isModuleOnStore && <ModuleVersionsRefresh moduleId={moduleInfo.id} />}
									</div>
								</CFormLabel>
								<CCol sm={8}>
									<CFormSelect
										name="colFormVersion"
										value={selectedVersion as string}
										onChange={(e) => setSelectedVersion(e.currentTarget.value)}
									>
										{versionChoices.map((v) => (
											<option key={v.value} value={v.value}>
												{v.label}
											</option>
										))}
										{!versionChoices.length && <option value={null as any}>Loading...</option>}
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
											{moduleInfo.bugUrl ? (
												<a target="_blank" rel="noreferrer" href={moduleInfo.bugUrl}>
													Github
												</a>
											) : (
												'Github'
											)}
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
								disabled={!moduleInfo || !connectionLabel || !selectedVersion || !versionChoices.length}
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
