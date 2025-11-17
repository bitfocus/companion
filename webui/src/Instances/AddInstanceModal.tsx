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
import { PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { CModalExt } from '~/Components/CModalExt.js'
import { useModuleVersionSelectOptions } from './useModuleVersionSelectOptions.js'
import { ModuleVersionsRefresh } from './ModuleVersionsRefresh.js'
import type { FuzzyProduct } from '~/Hooks/useFilteredProducts.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import type { AddInstanceService } from './AddInstanceService.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleVersionInfo } from '@companion-app/shared/Model/ModuleInfo.js'

export interface AddInstanceModalRef {
	show(info: FuzzyProduct): void
}

interface AddInstanceModalProps {
	service: AddInstanceService
	openConfigureInstance: (instanceId: string) => void
}

export const AddInstanceModal = observer(
	forwardRef<AddInstanceModalRef, AddInstanceModalProps>(function AddInstanceModal(
		{ service, openConfigureInstance },
		ref
	) {
		const { helpViewer, notifier, modules } = useContext(RootAppStoreContext)

		const [show, setShow] = useState(false)
		const [moduleInfo, setModuleInfo] = useState<FuzzyProduct | null>(null)
		const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
		const [instanceLabel, setInstanceLabel] = useState<string>('')

		const isModuleOnStore = !!moduleInfo && !!modules.getStoreInfo(moduleInfo.moduleType, moduleInfo.moduleId)

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			setModuleInfo(null)
			setSelectedVersion(null)
			setInstanceLabel('')
		}, [])

		const doAction = () => {
			if (!moduleInfo || !instanceLabel || !selectedVersion) return

			service
				.performAddInstance(moduleInfo, instanceLabel, selectedVersion)
				.then((id) => {
					console.log('NEW INSTANCE', id)
					setShow(false)
					setTimeout(() => {
						// Wait a bit to let the server catch up
						openConfigureInstance(id)
					}, 1000)
				})
				.catch((e) => {
					notifier.show(`Failed to create instance`, `Failed: ${e}`)
					console.error('Failed to create instance:', e)
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
					setInstanceLabel(service.findNextLabel(info))
				},
			}),
			[service]
		)

		const {
			choices: versionChoices,
			loaded: choicesLoaded,
			hasIncompatibleNewerVersion,
		} = useModuleVersionSelectOptions(service.moduleType, moduleInfo?.moduleId, moduleInfo?.installedInfo, true)

		console.log('Version choices', versionChoices, choicesLoaded)

		// Ensure the currently selection version is a valid option
		let defaultVersionId = moduleInfo?.installedInfo?.stableVersion?.versionId
		if (moduleInfo?.installedInfo?.devVersion) {
			defaultVersionId = 'dev'
		} else if (!defaultVersionId && moduleInfo?.installedInfo?.builtinVersion) {
			defaultVersionId = 'builtin'
		}

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

		let selectedVersionInfo: ClientModuleVersionInfo | undefined
		if (selectedVersion === 'dev') {
			selectedVersionInfo = moduleInfo?.installedInfo?.devVersion ?? undefined
		} else if (selectedVersion === 'builtin') {
			selectedVersionInfo = moduleInfo?.installedInfo?.builtinVersion ?? undefined
		} else {
			selectedVersionInfo = moduleInfo?.installedInfo?.installedVersions.find((v) => v.versionId === selectedVersion)
		}
		const selectedVersionIsLegacy = selectedVersionInfo?.isLegacy ?? false

		const showHelpClick = useCallback(() => {
			if (!moduleInfo?.moduleId || !selectedVersionInfo) return
			helpViewer.current?.showFromUrl(
				moduleInfo.moduleType,
				moduleInfo.moduleId,
				selectedVersionInfo.versionId,
				selectedVersionInfo.helpPath
			)
		}, [helpViewer, moduleInfo?.moduleType, moduleInfo?.moduleId, selectedVersionInfo])

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} scrollable={true}>
				{moduleInfo && (
					<>
						<CModalHeader closeButton>
							<h5>Add {moduleInfo.product}</h5>
						</CModalHeader>
						<CModalBody>
							{service.moduleType === ModuleInstanceType.Connection && (
								<p>
									It is now possible to load install different versions of modules without updating Companion. Once you
									have installed different versions of a module, you can choose which one to use for a new connection
									here.
								</p>
							)}
							<CForm className="row g-sm-2" onSubmit={PreventDefaultHandler}>
								<CFormLabel htmlFor="colFormLabel" className="col-sm-4 col-form-label col-form-label-sm">
									Label&nbsp;
								</CFormLabel>
								<CCol sm={8}>
									<CFormInput
										name="colFormLabel"
										value={instanceLabel}
										onChange={(e) => setInstanceLabel(e.currentTarget.value)}
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
										{isModuleOnStore && (
											<ModuleVersionsRefresh moduleType={moduleInfo.moduleType} moduleId={moduleInfo.moduleId} />
										)}
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
										{!versionChoices.length && (
											<option value={null as any}>
												{choicesLoaded ? 'No compatible versions found' : 'Loading...'}
											</option>
										)}
									</CFormSelect>
								</CCol>
								<CCol sm={{ span: 8, offset: 4 }} className="mt-0">
									<div className="form-text">Additional versions can be installed in the Modules Manager page.</div>
								</CCol>

								{hasIncompatibleNewerVersion && (
									<CCol xs={12}>
										<CAlert color="warning" className="mt-2 mb-0">
											There is a newer version of this module on the store, but it requires a newer version of
											Companion.
										</CAlert>
									</CCol>
								)}
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
								disabled={!moduleInfo || !instanceLabel || !selectedVersion || !versionChoices.length}
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
