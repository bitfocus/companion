import React, { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useState } from 'react'
import {
	CButton,
	CForm,
	CFormGroup,
	CInput,
	CInputCheckbox,
	CLabel,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CSelect,
} from '@coreui/react'
import { LoadingRetryOrError, socketEmitPromise, SocketContext, PreventDefaultHandler, SurfacesContext } from '../util'
import { nanoid } from 'nanoid'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { InternalInstanceField } from '../Controls/InternalInstanceFields'
import { MenuPortalContext } from '../Components/DropdownInputField'
import { ClientDevicesListItem } from '@companion/shared/Model/Surfaces'
import { InternalInputField } from '@companion/shared/Model/Options'

const PAGE_FIELD_SPEC: InternalInputField = {
	id: '',
	type: 'internal:page',
	label: '',
	includeDirection: false,
	default: 0,
}

export interface SurfaceEditModalRef {
	show(surfaceId: string | null, groupId: string | null): void
}
interface SurfaceEditModalProps {
	// Nothing
}

export const SurfaceEditModal = forwardRef<SurfaceEditModalRef, SurfaceEditModalProps>(
	function SurfaceEditModal(_props, ref) {
		const socket = useContext(SocketContext)
		const surfacesContext = useContext(SurfacesContext)

		const [rawGroupId, setGroupId] = useState<string | null>(null)
		const [surfaceId, setSurfaceId] = useState<string | null>(null)
		const [show, setShow] = useState(false)

		let surfaceInfo = null
		if (surfaceId) {
			for (const group of Object.values(surfacesContext)) {
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
			for (const group of Object.values(surfacesContext)) {
				if (group && group.id === groupId) {
					groupInfo = group
					break
				}
			}
		}

		const [surfaceConfig, setSurfaceConfig] = useState<Record<string, any> | null>(null)
		const [groupConfig, setGroupConfig] = useState<Record<string, any> | null>(null)
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

		useEffect(() => {
			// If surface disappears/disconnects, hide this

			const onlineSurfaceIds = new Set()
			for (const group of Object.values(surfacesContext)) {
				if (!group) continue
				for (const surface of group.surfaces) {
					if (surface.isConnected) {
						onlineSurfaceIds.add(surface.id)
					}
				}
			}

			setSurfaceId((oldSurfaceId) => {
				if (oldSurfaceId && !onlineSurfaceIds.has(oldSurfaceId)) {
					setShow(false)
				}
				return oldSurfaceId
			})
		}, [surfacesContext])

		const setSurfaceConfigValue = useCallback(
			(key: string, value: any) => {
				console.log('update surface', key, value)
				if (surfaceId) {
					setSurfaceConfig((oldConfig) => {
						const newConfig = {
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
				const groupId = !groupId0 || groupId0 === 'null' ? null : groupId0
				socketEmitPromise(socket, 'surfaces:add-to-group', [groupId, surfaceId]).catch((e) => {
					console.log('Config update failed', e)
				})
			},
			[socket, surfaceId]
		)

		const [modalRef, setModalRef] = useState<HTMLElement | null>(null)

		return (
			<CModal innerRef={setModalRef} show={show} onClose={doClose} onClosed={onClosed}>
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
								<CFormGroup>
									<CLabel>
										Surface Group&nbsp;
										<FontAwesomeIcon
											icon={faQuestionCircle}
											title="When in a group, surfaces will follow the page number of that group"
										/>
									</CLabel>
									<CSelect
										name="surface-group"
										value={surfaceInfo.groupId || 'null'}
										onChange={(e) => setSurfaceGroupId(e.currentTarget.value)}
									>
										<option value="null">Standalone (Default)</option>

										{Object.values(surfacesContext)
											.filter((group): group is ClientDevicesListItem => !!group && !group.isAutoGroup)
											.map((group) => (
												<option key={group.id} value={group.id}>
													{group.displayName}
												</option>
											))}
									</CSelect>
								</CFormGroup>
							)}

							{groupConfig && (
								<>
									<CFormGroup>
										<CLabel htmlFor="use_last_page">Use Last Page At Startup</CLabel>
										<CInputCheckbox
											name="use_last_page"
											type="checkbox"
											checked={!!groupConfig.use_last_page}
											onChange={(e) => setGroupConfigValue('use_last_page', !!e.currentTarget.checked)}
										/>
									</CFormGroup>
									<CFormGroup>
										<CLabel htmlFor="startup_page">Startup Page</CLabel>

										{InternalInstanceField(
											PAGE_FIELD_SPEC,
											false,
											!!groupConfig.use_last_page,
											groupConfig.startup_page,
											(val) => setGroupConfigValue('startup_page', val)
										)}
									</CFormGroup>
									<CFormGroup>
										<CLabel htmlFor="last_page">Current Page</CLabel>

										{InternalInstanceField(PAGE_FIELD_SPEC, false, false, groupConfig.last_page, (val) =>
											setGroupConfigValue('last_page', val)
										)}
									</CFormGroup>
								</>
							)}

							{surfaceConfig && surfaceInfo && (
								<>
									{surfaceInfo.configFields?.includes('emulator_size') && (
										<>
											<CFormGroup>
												<CLabel htmlFor="page">Row count</CLabel>
												<CInput
													name="emulator_rows"
													type="number"
													min={1}
													step={1}
													value={surfaceConfig.emulator_rows}
													onChange={(e) => setSurfaceConfigValue('emulator_rows', parseInt(e.currentTarget.value))}
												/>
											</CFormGroup>
											<CFormGroup>
												<CLabel htmlFor="page">Column count</CLabel>
												<CInput
													name="emulator_columns"
													type="number"
													min={1}
													step={1}
													value={surfaceConfig.emulator_columns}
													onChange={(e) => setSurfaceConfigValue('emulator_columns', parseInt(e.currentTarget.value))}
												/>
											</CFormGroup>
										</>
									)}

									<CFormGroup>
										<CLabel htmlFor="page">Horizontal Offset in grid</CLabel>
										<CInput
											name="page"
											type="number"
											step={1}
											value={surfaceConfig.xOffset}
											onChange={(e) => setSurfaceConfigValue('xOffset', parseInt(e.currentTarget.value))}
										/>
									</CFormGroup>
									<CFormGroup>
										<CLabel htmlFor="page">Vertical Offset in grid</CLabel>
										<CInput
											name="page"
											type="number"
											step={1}
											value={surfaceConfig.yOffset}
											onChange={(e) => setSurfaceConfigValue('yOffset', parseInt(e.currentTarget.value))}
										/>
									</CFormGroup>

									{surfaceInfo.configFields?.includes('brightness') && (
										<CFormGroup>
											<CLabel htmlFor="brightness">Brightness</CLabel>
											<CInput
												name="brightness"
												type="range"
												min={0}
												max={100}
												step={1}
												value={surfaceConfig.brightness}
												onChange={(e) => setSurfaceConfigValue('brightness', parseInt(e.currentTarget.value))}
											/>
										</CFormGroup>
									)}
									{surfaceInfo.configFields?.includes('illuminate_pressed') && (
										<CFormGroup>
											<CLabel htmlFor="illuminate_pressed">Illuminate pressed buttons</CLabel>
											<CInputCheckbox
												name="illuminate_pressed"
												type="checkbox"
												checked={!!surfaceConfig.illuminate_pressed}
												onChange={(e) => setSurfaceConfigValue('illuminate_pressed', !!e.currentTarget.checked)}
											/>
										</CFormGroup>
									)}

									<CFormGroup>
										<CLabel htmlFor="rotation">Button rotation</CLabel>
										<CSelect
											name="rotation"
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
										</CSelect>
									</CFormGroup>
									{surfaceInfo.configFields?.includes('emulator_control_enable') && (
										<CFormGroup>
											<CLabel htmlFor="emulator_control_enable">Enable support for Logitech R400/Mastercue/DSan</CLabel>
											<CInputCheckbox
												name="emulator_control_enable"
												type="checkbox"
												checked={!!surfaceConfig.emulator_control_enable}
												onChange={(e) => setSurfaceConfigValue('emulator_control_enable', !!e.currentTarget.checked)}
											/>
										</CFormGroup>
									)}
									{surfaceInfo.configFields?.includes('emulator_prompt_fullscreen') && (
										<CFormGroup>
											<CLabel htmlFor="emulator_prompt_fullscreen">Prompt to enter fullscreen</CLabel>
											<CInputCheckbox
												name="emulator_prompt_fullscreen"
												type="checkbox"
												checked={!!surfaceConfig.emulator_prompt_fullscreen}
												onChange={(e) => setSurfaceConfigValue('emulator_prompt_fullscreen', !!e.currentTarget.checked)}
											/>
										</CFormGroup>
									)}
									{surfaceInfo.configFields?.includes('videohub_page_count') && (
										<CFormGroup>
											<CLabel htmlFor="videohub_page_count">Page Count</CLabel>
											<CInput
												name="videohub_page_count"
												type="range"
												min={0}
												max={8}
												step={2}
												value={surfaceConfig.videohub_page_count}
												onChange={(e) => setSurfaceConfigValue('videohub_page_count', parseInt(e.currentTarget.value))}
											/>
										</CFormGroup>
									)}
									<CFormGroup>
										<CLabel htmlFor="never_lock">Never Pin code lock</CLabel>
										<CInputCheckbox
											name="never_lock"
											type="checkbox"
											checked={!!surfaceConfig.never_lock}
											onChange={(e) => setSurfaceConfigValue('never_lock', !!e.currentTarget.checked)}
										/>
									</CFormGroup>
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
	}
)
