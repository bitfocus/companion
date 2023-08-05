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

export const SurfaceEditModal = forwardRef(function SurfaceEditModal(_props, ref) {
	const socket = useContext(SocketContext)
	const surfacesContext = useContext(SurfacesContext)

	const [surfaceId, setSurfaceId] = useState(null)
	const [show, setShow] = useState(false)

	const [deviceConfig, setDeviceConfig] = useState(null)
	const [deviceConfigInfo, setDeviceConfigInfo] = useState(null)
	const [deviceConfigError, setDeviceConfigError] = useState(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setSurfaceId(null)
		setDeviceConfig(null)
		setDeviceConfigError(null)
	}, [])

	const doRetryConfigLoad = useCallback(() => setReloadToken(nanoid()), [])

	useEffect(() => {
		setDeviceConfigError(null)
		setDeviceConfig(null)

		if (surfaceId) {
			socketEmitPromise(socket, 'surfaces:config-get', [surfaceId])
				.then(([config, info]) => {
					setDeviceConfig(config)
					setDeviceConfigInfo(info)
				})
				.catch((err) => {
					console.error('Failed to load device config')
					setDeviceConfigError(`Failed to load device config`)
				})
		}
	}, [socket, surfaceId, reloadToken])

	useImperativeHandle(
		ref,
		() => ({
			show(surfaceId) {
				setSurfaceId(surfaceId)
				setShow(true)
			},
		}),
		[]
	)

	useEffect(() => {
		// If device disappears, hide this

		const allSurfaceIds = new Set()
		for (const group of surfacesContext) {
			for (const surface of group.surfaces) {
				allSurfaceIds.add(surface.id)
			}
		}

		setSurfaceId((oldSurfaceId) => {
			if (oldSurfaceId && !allSurfaceIds.has(oldSurfaceId)) {
				setShow(false)
			}
			return oldSurfaceId
		})
	}, [surfacesContext])

	const updateConfig = useCallback(
		(key, value) => {
			console.log('update', key, value)
			if (surfaceId) {
				setDeviceConfig((oldConfig) => {
					const newConfig = {
						...oldConfig,
						[key]: value,
					}

					socketEmitPromise(socket, 'surfaces:config-set', [surfaceId, newConfig])
						.then((newConfig) => {
							if (typeof newConfig === 'string') {
								console.log('Config update failed', newConfig)
							} else {
								setDeviceConfig(newConfig)
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

	const setGroupId = useCallback(
		(groupId) => {
			if (!groupId || groupId === 'null') groupId = null
			socketEmitPromise(socket, 'surfaces:add-to-group', [groupId, surfaceId]).catch((e) => {
				console.log('Config update failed', e)
			})
		},
		[socket, surfaceId]
	)

	let deviceInfo = null
	for (const group of surfacesContext) {
		if (deviceInfo) break

		for (const surface of group.surfaces) {
			if (surface.id === surfaceId) {
				deviceInfo = {
					...surface,
					groupId: group.isAutoGroup ? null : group.id,
				}
				break
			}
		}
	}

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed}>
			<CModalHeader closeButton>
				<h5>Settings for {deviceInfo?.type}</h5>
			</CModalHeader>
			<CModalBody>
				<LoadingRetryOrError
					error={deviceConfigError}
					dataReady={deviceConfig && deviceConfigInfo}
					doRetry={doRetryConfigLoad}
				/>
				{deviceConfig && deviceInfo && deviceConfigInfo && (
					<CForm onSubmit={PreventDefaultHandler}>
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
								value={deviceInfo.groupId || 'null'}
								onChange={(e) => setGroupId(e.currentTarget.value)}
							>
								<option value="null">Standalone (Default)</option>

								{surfacesContext
									.filter((group) => !group.isAutoGroup)
									.map((group) => (
										<option key={group.id} value={group.id}>
											{group.displayName}
										</option>
									))}
							</CSelect>
						</CFormGroup>
						{!deviceInfo.groupId && (
							<>
								<CFormGroup>
									<CLabel htmlFor="use_last_page">Use Last Page At Startup</CLabel>
									<CInputCheckbox
										name="use_last_page"
										type="checkbox"
										checked={!!deviceConfig.use_last_page}
										value={true}
										onChange={(e) => updateConfig('use_last_page', !!e.currentTarget.checked)}
									/>
								</CFormGroup>
								<CFormGroup>
									<CLabel htmlFor="page">Startup Page</CLabel>
									<CInput
										disabled={!!deviceConfig.use_last_page}
										name="page"
										type="range"
										min={1}
										max={99}
										step={1}
										value={deviceConfig.page}
										onChange={(e) => updateConfig('page', parseInt(e.currentTarget.value))}
									/>
									<span>{deviceConfig.page}</span>
								</CFormGroup>
							</>
						)}

						{deviceInfo.configFields?.includes('emulator_size') && (
							<>
								<CFormGroup>
									<CLabel htmlFor="page">Row count</CLabel>
									<CInput
										name="emulator_rows"
										type="number"
										min={1}
										step={1}
										value={deviceConfig.emulator_rows}
										onChange={(e) => updateConfig('emulator_rows', parseInt(e.currentTarget.value))}
									/>
								</CFormGroup>
								<CFormGroup>
									<CLabel htmlFor="page">Column count</CLabel>
									<CInput
										name="emulator_columns"
										type="number"
										min={1}
										step={1}
										value={deviceConfig.emulator_columns}
										onChange={(e) => updateConfig('emulator_columns', parseInt(e.currentTarget.value))}
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
								value={deviceConfig.xOffset}
								onChange={(e) => updateConfig('xOffset', parseInt(e.currentTarget.value))}
							/>
						</CFormGroup>
						<CFormGroup>
							<CLabel htmlFor="page">Vertical Offset in grid</CLabel>
							<CInput
								name="page"
								type="number"
								step={1}
								value={deviceConfig.yOffset}
								onChange={(e) => updateConfig('yOffset', parseInt(e.currentTarget.value))}
							/>
						</CFormGroup>

						{deviceInfo.configFields?.includes('brightness') && (
							<CFormGroup>
								<CLabel htmlFor="brightness">Brightness</CLabel>
								<CInput
									name="brightness"
									type="range"
									min={0}
									max={100}
									step={1}
									value={deviceConfig.brightness}
									onChange={(e) => updateConfig('brightness', parseInt(e.currentTarget.value))}
								/>
							</CFormGroup>
						)}
						{deviceInfo.configFields?.includes('illuminate_pressed') && (
							<CFormGroup>
								<CLabel htmlFor="illuminate_pressed">Illuminate pressed buttons</CLabel>
								<CInputCheckbox
									name="illuminate_pressed"
									type="checkbox"
									checked={!!deviceConfig.illuminate_pressed}
									value={true}
									onChange={(e) => updateConfig('illuminate_pressed', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
						)}
						{deviceInfo.configFields?.includes('rotation') && (
							<CFormGroup>
								<CLabel htmlFor="rotation">Button rotation</CLabel>
								<CSelect
									name="rotation"
									value={deviceConfig.rotation}
									onChange={(e) => updateConfig('rotation', parseInt(e.currentTarget.value))}
								>
									<option value="0">Normal</option>
									<option value="-90">90 CCW</option>
									<option value="90">90 CW</option>
									<option value="180">180</option>
								</CSelect>
							</CFormGroup>
						)}
						{deviceInfo.configFields?.includes('emulator_control_enable') && (
							<CFormGroup>
								<CLabel htmlFor="emulator_control_enable">Enable support for Logitech R400/Mastercue/DSan</CLabel>
								<CInputCheckbox
									name="emulator_control_enable"
									type="checkbox"
									checked={!!deviceConfig.emulator_control_enable}
									value={true}
									onChange={(e) => updateConfig('emulator_control_enable', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
						)}
						{deviceInfo.configFields?.includes('emulator_prompt_fullscreen') && (
							<CFormGroup>
								<CLabel htmlFor="emulator_prompt_fullscreen">Prompt to enter fullscreen</CLabel>
								<CInputCheckbox
									name="emulator_prompt_fullscreen"
									type="checkbox"
									checked={!!deviceConfig.emulator_prompt_fullscreen}
									value={true}
									onChange={(e) => updateConfig('emulator_prompt_fullscreen', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
						)}
						<CFormGroup>
							<CLabel htmlFor="never_lock">Never Pin code lock</CLabel>
							<CInputCheckbox
								name="never_lock"
								type="checkbox"
								checked={!!deviceConfig.never_lock}
								value={true}
								onChange={(e) => updateConfig('never_lock', !!e.currentTarget.checked)}
							/>
						</CFormGroup>
					</CForm>
				)}
			</CModalBody>
			<CModalFooter>
				<CButton color="secondary" onClick={doClose}>
					Close
				</CButton>
			</CModalFooter>
		</CModal>
	)
})
