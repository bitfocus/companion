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
import { LoadingRetryOrError, socketEmitPromise, SocketContext, PreventDefaultHandler } from '../util'
import { nanoid } from 'nanoid'

export const SurfaceEditModal = forwardRef(function SurfaceEditModal(_props, ref) {
	const socket = useContext(SocketContext)

	const [deviceInfo, setDeviceInfo] = useState(null)
	const [show, setShow] = useState(false)

	const [deviceConfig, setDeviceConfig] = useState(null)
	const [deviceConfigError, setDeviceConfigError] = useState(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setDeviceInfo(null)
		setDeviceConfig(null)
		setDeviceConfigError(null)
	}, [])

	const doRetryConfigLoad = useCallback(() => setReloadToken(nanoid()), [])

	useEffect(() => {
		setDeviceConfigError(null)
		setDeviceConfig(null)

		if (deviceInfo?.id) {
			socketEmitPromise(socket, 'surfaces:config-get', [deviceInfo.id])
				.then((config) => {
					console.log(config)
					setDeviceConfig(config)
				})
				.catch((err) => {
					console.error('Failed to load device config')
					setDeviceConfigError(`Failed to load device config`)
				})
		}
	}, [socket, deviceInfo?.id, reloadToken])

	useImperativeHandle(
		ref,
		() => ({
			show(device) {
				setDeviceInfo(device)
				setShow(true)
			},
			ensureIdIsValid(deviceIds) {
				setDeviceInfo((oldDevice) => {
					if (oldDevice && deviceIds.indexOf(oldDevice.id) === -1) {
						setShow(false)
					}
					return oldDevice
				})
			},
		}),
		[]
	)

	const updateConfig = useCallback(
		(key, value) => {
			console.log('update', key, value)
			if (deviceInfo?.id) {
				setDeviceConfig((oldConfig) => {
					const newConfig = {
						...oldConfig,
						[key]: value,
					}

					socketEmitPromise(socket, 'surfaces:config-set', [deviceInfo.id, newConfig])
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
		[socket, deviceInfo?.id]
	)

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed}>
			<CModalHeader closeButton>
				<h5>Settings for {deviceInfo?.type}</h5>
			</CModalHeader>
			<CModalBody>
				<LoadingRetryOrError error={deviceConfigError} dataReady={deviceConfig} doRetry={doRetryConfigLoad} />
				{deviceConfig && deviceInfo && (
					<CForm onSubmit={PreventDefaultHandler}>
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

						<CFormGroup>
							<CLabel htmlFor="rotation">Button rotation</CLabel>
							<CSelect
								name="rotation"
								value={deviceConfig.rotation}
								onChange={(e) => {
									const valueNumber = parseInt(e.currentTarget.value)
									updateConfig('rotation', isNaN(valueNumber) ? e.currentTarget.value : valueNumber)
								}}
							>
								<option value="0">Normal</option>
								<option value="surface-90">90 CCW</option>
								<option value="surface90">90 CW</option>
								<option value="surface180">180</option>

								{deviceInfo.configFields?.includes('legacy_rotation') && (
									<>
										<option value="-90">90 CCW (Legacy)</option>
										<option value="90">90 CW (Legacy)</option>
										<option value="180">180 (Legacy)</option>
									</>
								)}
							</CSelect>
						</CFormGroup>
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
						{deviceInfo.configFields?.includes('videohub_page_count') && (
							<CFormGroup>
								<CLabel htmlFor="videohub_page_count">Page Count</CLabel>
								<CInput
									name="videohub_page_count"
									type="range"
									min={0}
									max={8}
									step={2}
									value={deviceConfig.videohub_page_count}
									onChange={(e) => updateConfig('videohub_page_count', parseInt(e.currentTarget.value))}
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
