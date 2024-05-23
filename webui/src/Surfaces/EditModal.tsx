import React, { useCallback, useContext, useEffect, useImperativeHandle, useState } from 'react'
import {
	CButton,
	CForm,
	CFormInput,
	CFormCheck,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CFormSelect,
} from '@coreui/react'
import { LoadingRetryOrError, socketEmitPromise, PreventDefaultHandler, useComputed } from '../util.js'
import { nanoid } from 'nanoid'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { InternalInstanceField } from '../Controls/InternalInstanceFields.js'
import { MenuPortalContext } from '../Components/DropdownInputField.js'
import { ClientDevicesListItem, SurfaceGroupConfig, SurfacePanelConfig } from '@companion-app/shared/Model/Surfaces.js'
import { InternalInputField } from '@companion-app/shared/Model/Options.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

const PAGE_FIELD_SPEC: InternalInputField = {
	id: '',
	type: 'internal:page',
	label: '',
	includeStartup: false,
	includeDirection: false,
	default: 0,
}

export interface SurfaceEditModalRef {
	show(surfaceId: string | null, groupId: string | null): void
}
interface SurfaceEditModalProps {
	// Nothing
}

export const SurfaceEditModal = observer<SurfaceEditModalProps, SurfaceEditModalRef>(
	function SurfaceEditModal(_props, ref) {
		const { surfaces, socket } = useContext(RootAppStoreContext)

		const [rawGroupId, setGroupId] = useState<string | null>(null)
		const [surfaceId, setSurfaceId] = useState<string | null>(null)
		const [show, setShow] = useState(false)

		let surfaceInfo = null
		if (surfaceId) {
			for (const group of surfaces.store.values()) {
				if (surfaceInfo || !group) break

				for (const surface of group.surfaces) {
					if (surface.id === surfaceId) {
						surfaceInfo = {
							...surface,
							groupId: group.isAutoGroup ? null : group.id,
						}
						break
					}
				}
			}
		}

		const groupId = surfaceInfo && !surfaceInfo.groupId ? surfaceId : rawGroupId
		let groupInfo = null
		if (groupId) {
			for (const group of surfaces.store.values()) {
				if (group && group.id === groupId) {
					groupInfo = group
					break
				}
			}
		}

		const [surfaceConfig, setSurfaceConfig] = useState<SurfacePanelConfig | null>(null)
		const [groupConfig, setGroupConfig] = useState<SurfaceGroupConfig | null>(null)
		const [configLoadError, setConfigLoadError] = useState<string | null>(null)
		const [reloadToken, setReloadToken] = useState(nanoid())

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			setSurfaceId(null)
			setSurfaceConfig(null)
			setConfigLoadError(null)
		}, [])

		const doRetryConfigLoad = useCallback(() => setReloadToken(nanoid()), [])

		useEffect(() => {
			setConfigLoadError(null)
			setSurfaceConfig(null)
			setGroupConfig(null)

			if (surfaceId) {
				socketEmitPromise(socket, 'surfaces:config-get', [surfaceId])
					.then((config) => {
						setSurfaceConfig(config)
					})
					.catch((err: any) => {
						console.error('Failed to load surface config', err)
						setConfigLoadError(`Failed to load surface config`)
					})
			}
			if (groupId) {
				socketEmitPromise(socket, 'surfaces:group-config-get', [groupId])
					.then((config) => {
						setGroupConfig(config)
					})
					.catch((err: any) => {
						console.error('Failed to load group config', err)
						setConfigLoadError(`Failed to load surface group config`)
					})
			}
		}, [socket, surfaceId, groupId, reloadToken])

		useImperativeHandle(
			ref,
			() => ({
				show(surfaceId, groupId) {
					setSurfaceId(surfaceId)
					setGroupId(groupId)
					setShow(true)
				},
			}),
			[]
		)

		const onlineSurfaceIds = useComputed(() => {
			const onlineSurfaceIds = new Set()
			for (const group of surfaces.store.values()) {
				if (!group) continue
				for (const surface of group.surfaces) {
					if (surface.isConnected) {
						onlineSurfaceIds.add(surface.id)
					}
				}
			}
			return onlineSurfaceIds
		}, [surfaces])

		useEffect(() => {
			// If surface disappears/disconnects, hide this

			setSurfaceId((oldSurfaceId) => {
				if (oldSurfaceId && !onlineSurfaceIds.has(oldSurfaceId)) {
					setShow(false)
				}
				return oldSurfaceId
			})
		}, [onlineSurfaceIds])

		const setSurfaceConfigValue = useCallback(
			(key: string, value: any) => {
				console.log('update surface', key, value)
				if (surfaceId) {
					setSurfaceConfig((oldConfig) => {
						const newConfig: SurfacePanelConfig = {
							...oldConfig,
							[key]: value,
						}

						socketEmitPromise(socket, 'surfaces:config-set', [surfaceId, newConfig])
							.then((newConfig) => {
								if (typeof newConfig === 'string') {
									console.log('Config update failed', newConfig)
								} else {
									setSurfaceConfig(newConfig)
								}
							})
							.catch((e) => {
								console.log('Config update failed', e)
							})
						return newConfig
					})
				}
			},
			[socket, surfaceId]
		)
		const setGroupConfigValue = useCallback(
			(key: string, value: any) => {
				console.log('update group', key, value)
				if (groupId) {
					socketEmitPromise(socket, 'surfaces:group-config-set', [groupId, key, value])
						.then((newConfig) => {
							if (typeof newConfig === 'string') {
								console.log('group config update failed', newConfig)
							} else {
								setGroupConfig(newConfig)
							}
						})
						.catch((e) => {
							console.log('group config update failed', e)
						})

					setGroupConfig((oldConfig) => {
						if (!oldConfig) return oldConfig
						return {
							...oldConfig,
							[key]: value,
						}
					})
				}
			},
			[socket, groupId]
		)

		const setSurfaceGroupId = useCallback(
			(groupId0: string) => {
				if (!surfaceId) return
				const groupId = !groupId0 || groupId0 === 'null' ? null : groupId0
				socketEmitPromise(socket, 'surfaces:add-to-group', [groupId, surfaceId]).catch((e) => {
					console.log('Config update failed', e)
				})
			},
			[socket, surfaceId]
		)

		const [modalRef, setModalRef] = useState<HTMLElement | null>(null)

		return (
			<CModal ref={setModalRef} visible={show} onClose={doClose} onClosed={onClosed}>
				<MenuPortalContext.Provider value={modalRef}>
					<CModalHeader closeButton>
						<h5>Settings for {surfaceInfo?.displayName ?? surfaceInfo?.type ?? groupInfo?.displayName}</h5>
					</CModalHeader>
					<CModalBody>
						<LoadingRetryOrError
							error={configLoadError}
							dataReady={(!surfaceId || !!surfaceConfig) && (!groupId || !!groupConfig)}
							doRetry={doRetryConfigLoad}
						/>

						<CForm onSubmit={PreventDefaultHandler}>
							{surfaceInfo && (
								<CFormSelect
									label={
										<>
											Surface Group&nbsp;
											<FontAwesomeIcon
												icon={faQuestionCircle}
												title="When in a group, surfaces will follow the page number of that group"
											/>
										</>
									}
									value={surfaceInfo.groupId || 'null'}
									onChange={(e) => setSurfaceGroupId(e.currentTarget.value)}
								>
									<option value="null">Standalone (Default)</option>

									{Array.from(surfaces.store.values())
										.filter((group): group is ClientDevicesListItem => !!group && !group.isAutoGroup)
										.map((group) => (
											<option key={group.id} value={group.id}>
												{group.displayName}
											</option>
										))}
								</CFormSelect>
							)}

							{groupConfig && (
								<>
									<CFormCheck
										label="Use Last Page At Startup"
										type="checkbox"
										checked={!!groupConfig.use_last_page}
										onChange={(e) => setGroupConfigValue('use_last_page', !!e.currentTarget.checked)}
									/>

									{InternalInstanceField(
										'Startup Page',
										PAGE_FIELD_SPEC,
										false,
										!!groupConfig.use_last_page,
										groupConfig.startup_page,
										(val) => setGroupConfigValue('startup_page', val)
									)}

									{InternalInstanceField('Current Page', PAGE_FIELD_SPEC, false, false, groupConfig.last_page, (val) =>
										setGroupConfigValue('last_page', val)
									)}
								</>
							)}

							{surfaceConfig && surfaceInfo && (
								<>
									{surfaceInfo.configFields?.includes('emulator_size') && (
										<>
											<CFormInput
												label="Row count"
												type="number"
												min={1}
												step={1}
												value={surfaceConfig.emulator_rows}
												onChange={(e) => setSurfaceConfigValue('emulator_rows', parseInt(e.currentTarget.value))}
											/>
											<CFormInput
												label="Column count"
												type="number"
												min={1}
												step={1}
												value={surfaceConfig.emulator_columns}
												onChange={(e) => setSurfaceConfigValue('emulator_columns', parseInt(e.currentTarget.value))}
											/>
										</>
									)}

									{!surfaceInfo.configFields?.includes('no_offset') && (
										<>
											<CFormInput
												label="Horizontal Offset in grid"
												type="number"
												step={1}
												value={surfaceConfig.xOffset}
												onChange={(e) => setSurfaceConfigValue('xOffset', parseInt(e.currentTarget.value))}
											/>
											<CFormInput
												label="Vertical Offset in grid"
												type="number"
												step={1}
												value={surfaceConfig.yOffset}
												onChange={(e) => setSurfaceConfigValue('yOffset', parseInt(e.currentTarget.value))}
											/>
										</>
									)}

									{surfaceInfo.configFields?.includes('brightness') && (
										<CFormInput
											label="Brightness"
											type="range"
											min={0}
											max={100}
											step={1}
											value={surfaceConfig.brightness}
											onChange={(e) => setSurfaceConfigValue('brightness', parseInt(e.currentTarget.value))}
										/>
									)}
									{surfaceInfo.configFields?.includes('illuminate_pressed') && (
										<CFormCheck
											label="Illuminate pressed buttons"
											type="checkbox"
											checked={!!surfaceConfig.illuminate_pressed}
											onChange={(e) => setSurfaceConfigValue('illuminate_pressed', !!e.currentTarget.checked)}
										/>
									)}

									{!surfaceInfo.configFields?.includes('no_rotation') && (
										<CFormSelect
											label="Button rotation"
											value={surfaceConfig.rotation}
											onChange={(e) => {
												const valueNumber = parseInt(e.currentTarget.value)
												setSurfaceConfigValue('rotation', isNaN(valueNumber) ? e.currentTarget.value : valueNumber)
											}}
										>
											<option value="0">Normal</option>
											<option value="surface-90">90 CCW</option>
											<option value="surface90">90 CW</option>
											<option value="surface180">180</option>

											{surfaceInfo.configFields?.includes('legacy_rotation') && (
												<>
													<option value="-90">90 CCW (Legacy)</option>
													<option value="90">90 CW (Legacy)</option>
													<option value="180">180 (Legacy)</option>
												</>
											)}
										</CFormSelect>
									)}
									{surfaceInfo.configFields?.includes('emulator_control_enable') && (
										<CFormCheck
											label="Enable support for Logitech R400/Mastercue/DSan"
											type="checkbox"
											checked={!!surfaceConfig.emulator_control_enable}
											onChange={(e) => setSurfaceConfigValue('emulator_control_enable', !!e.currentTarget.checked)}
										/>
									)}
									{surfaceInfo.configFields?.includes('emulator_prompt_fullscreen') && (
										<CFormCheck
											label="Prompt to enter fullscreen"
											type="checkbox"
											checked={!!surfaceConfig.emulator_prompt_fullscreen}
											onChange={(e) => setSurfaceConfigValue('emulator_prompt_fullscreen', !!e.currentTarget.checked)}
										/>
									)}
									{surfaceInfo.configFields?.includes('videohub_page_count') && (
										<CFormInput
											label="Page Count"
											type="range"
											min={0}
											max={8}
											step={2}
											value={surfaceConfig.videohub_page_count}
											onChange={(e) => setSurfaceConfigValue('videohub_page_count', parseInt(e.currentTarget.value))}
										/>
									)}
									{!surfaceInfo.configFields?.includes('no_lock') && (
										<CFormCheck
											label="Never Pin code lock"
											type="checkbox"
											checked={!!surfaceConfig.never_lock}
											onChange={(e) => setSurfaceConfigValue('never_lock', !!e.currentTarget.checked)}
										/>
									)}
								</>
							)}
						</CForm>
					</CModalBody>
					<CModalFooter>
						<CButton color="secondary" onClick={doClose}>
							Close
						</CButton>
					</CModalFooter>
				</MenuPortalContext.Provider>
			</CModal>
		)
	},
	{ forwardRef: true }
)
