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

	const [surfaceInfo, setSurfaceInfo] = useState(null)
	const [show, setShow] = useState(false)

	const [surfaceConfig, setSurfaceConfig] = useState(null)
	const [surfaceConfigError, setSurfaceConfigError] = useState(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setSurfaceInfo(null)
		setSurfaceConfig(null)
		setSurfaceConfigError(null)
	}, [])

	const doRetryConfigLoad = useCallback(() => setReloadToken(nanoid()), [])

	useEffect(() => {
		setSurfaceConfigError(null)
		setSurfaceConfig(null)

		if (surfaceInfo?.id) {
			socketEmitPromise(socket, 'surfaces:config-get', [surfaceInfo.id])
				.then((config) => {
					console.log(config)
					setSurfaceConfig(config)
				})
				.catch((err) => {
					console.error('Failed to load surface config')
					setSurfaceConfigError(`Failed to load surface config`)
				})
		}
	}, [socket, surfaceInfo?.id, reloadToken])

	useImperativeHandle(
		ref,
		() => ({
			show(surface) {
				setSurfaceInfo(surface)
				setShow(true)
			},
			ensureIdIsValid(surfaceIds) {
				setSurfaceInfo((oldSurface) => {
					if (oldSurface && surfaceIds.indexOf(oldSurface.id) === -1) {
						setShow(false)
					}
					return oldSurface
				})
			},
		}),
		[]
	)

	const updateConfig = useCallback(
		(key, value) => {
			console.log('update', key, value)
			if (surfaceInfo?.id) {
				setSurfaceConfig((oldConfig) => {
					const newConfig = {
						...oldConfig,
						[key]: value,
					}

					socketEmitPromise(socket, 'surfaces:config-set', [surfaceInfo.id, newConfig])
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
		[socket, surfaceInfo?.id]
	)

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed}>
			<CModalHeader closeButton>
				<h5>Settings for {surfaceInfo?.type}</h5>
			</CModalHeader>
			<CModalBody>
				<LoadingRetryOrError error={surfaceConfigError} dataReady={surfaceConfig} doRetry={doRetryConfigLoad} />
				{surfaceConfig && surfaceInfo && (
					<CForm onSubmit={PreventDefaultHandler}>
						<CFormGroup>
							<CLabel htmlFor="use_last_page">Use Last Page At Startup</CLabel>
							<CInputCheckbox
								name="use_last_page"
								type="checkbox"
								checked={!!surfaceConfig.use_last_page}
								value={true}
								onChange={(e) => updateConfig('use_last_page', !!e.currentTarget.checked)}
							/>
						</CFormGroup>
						<CFormGroup>
							<CLabel htmlFor="page">Startup Page</CLabel>
							<CInput
								disabled={!!surfaceConfig.use_last_page}
								name="page"
								type="range"
								min={1}
								max={99}
								step={1}
								value={surfaceConfig.page}
								onChange={(e) => updateConfig('page', parseInt(e.currentTarget.value))}
							/>
							<span>{surfaceConfig.page}</span>
						</CFormGroup>
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
										value={surfaceConfig.emulator_columns}
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
								value={surfaceConfig.xOffset}
								onChange={(e) => updateConfig('xOffset', parseInt(e.currentTarget.value))}
							/>
						</CFormGroup>
						<CFormGroup>
							<CLabel htmlFor="page">Vertical Offset in grid</CLabel>
							<CInput
								name="page"
								type="number"
								step={1}
								value={surfaceConfig.yOffset}
								onChange={(e) => updateConfig('yOffset', parseInt(e.currentTarget.value))}
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
									onChange={(e) => updateConfig('brightness', parseInt(e.currentTarget.value))}
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
									value={true}
									onChange={(e) => updateConfig('illuminate_pressed', !!e.currentTarget.checked)}
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
									updateConfig('rotation', isNaN(valueNumber) ? e.currentTarget.value : valueNumber)
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
									value={true}
									onChange={(e) => updateConfig('emulator_control_enable', !!e.currentTarget.checked)}
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
									value={true}
									onChange={(e) => updateConfig('emulator_prompt_fullscreen', !!e.currentTarget.checked)}
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
									onChange={(e) => updateConfig('videohub_page_count', parseInt(e.currentTarget.value))}
								/>
							</CFormGroup>
						)}
						<CFormGroup>
							<CLabel htmlFor="never_lock">Never Pin code lock</CLabel>
							<CInputCheckbox
								name="never_lock"
								type="checkbox"
								checked={!!surfaceConfig.never_lock}
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
