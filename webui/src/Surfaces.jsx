import React, {
	forwardRef,
	memo,
	useCallback,
	useContext,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from 'react'
import {
	CAlert,
	CButton,
	CButtonGroup,
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
import { LoadingRetryOrError, SurfacesContext, socketEmitPromise, SocketContext, PreventDefaultHandler } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faCog, faFolderOpen, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { nanoid } from 'nanoid'
import { TextInputField } from './Components/TextInputField'
import { useMemo } from 'react'
import { GenericConfirmModal } from './Components/GenericConfirmModal'

export const SurfacesPage = memo(function SurfacesPage() {
	const socket = useContext(SocketContext)
	const devices = useContext(SurfacesContext)

	const confirmRef = useRef(null)

	const devicesList = useMemo(() => {
		const ary = Object.values(devices.available)

		ary.sort((a, b) => {
			if (a.index !== b.index) {
				return a.index - b.index
			}

			// fallback to serial
			return a.id.localeCompare(b.id)
		})

		return ary
	}, [devices.available])
	const offlineDevicesList = useMemo(() => {
		const ary = Object.values(devices.offline)

		ary.sort((a, b) => {
			if (a.index !== b.index) {
				return a.index - b.index
			}

			// fallback to serial
			return a.id.localeCompare(b.id)
		})

		return ary
	}, [devices.offline])

	const editModalRef = useRef()
	const confirmModalRef = useRef(null)

	const [scanning, setScanning] = useState(false)
	const [scanError, setScanError] = useState(null)

	useEffect(() => {
		// If device disappears, hide the edit modal
		if (editModalRef.current) {
			editModalRef.current.ensureIdIsValid(Object.keys(devices))
		}
	}, [devices])

	const refreshUSB = useCallback(() => {
		setScanning(true)
		setScanError(null)

		socketEmitPromise(socket, 'surfaces:rescan', [], 30000)
			.then((errorMsg) => {
				setScanError(errorMsg || null)
				setScanning(false)
			})
			.catch((err) => {
				console.error('Refresh USB failed', err)

				setScanning(false)
			})
	}, [socket])

	const addEmulator = useCallback(() => {
		socketEmitPromise(socket, 'surfaces:emulator-add', []).catch((err) => {
			console.error('Emulator add failed', err)
		})
	}, [socket])

	const deleteEmulator = useCallback(
		(dev) => {
			confirmRef?.current?.show('Remove Emulator', 'Are you sure?', 'Remove', () => {
				socketEmitPromise(socket, 'surfaces:emulator-remove', [dev.id]).catch((err) => {
					console.error('Emulator remove failed', err)
				})
			})
		},
		[socket]
	)

	const configureDevice = useCallback((device) => {
		editModalRef.current.show(device)
	}, [])

	const forgetDevice = useCallback(
		(device) => {
			confirmModalRef.current.show(
				'Forget Surface',
				'Are you sure you want to forget this surface? Any settings will be lost',
				'Forget',
				() => {
					socketEmitPromise(socket, 'surfaces:forget', [device.id]).catch((err) => {
						console.error('fotget failed', err)
					})
				}
			)
		},
		[socket]
	)

	const updateName = useCallback(
		(deviceId, name) => {
			socketEmitPromise(socket, 'surfaces:set-name', [deviceId, name]).catch((err) => {
				console.error('Update name failed', err)
			})
		},
		[socket]
	)

	return (
		<div>
			<GenericConfirmModal ref={confirmRef} />

			<h4>Surfaces</h4>
			<p>
				These are the surfaces currently connected to companion. If your streamdeck is missing from this list, you might
				need to close the Elgato Streamdeck application and click the Rescan button below.
			</p>

			<CAlert color="info">
				Did you know, you can connect a Streamdeck from another computer or Raspberry Pi with{' '}
				<a target="_blank" rel="noreferrer" href="https://bitfocus.io/companion-satellite">
					Companion Satellite
				</a>
				?
			</CAlert>

			<CAlert color="warning" role="alert" style={{ display: scanError ? '' : 'none' }}>
				{scanError}
			</CAlert>

			<CButtonGroup>
				<CButton color="warning" onClick={refreshUSB}>
					<FontAwesomeIcon icon={faSync} spin={scanning} />
					{scanning ? ' Checking for new devices...' : ' Rescan USB'}
				</CButton>
				<CButton color="danger" onClick={addEmulator}>
					<FontAwesomeIcon icon={faAdd} /> Add Emulator
				</CButton>
			</CButtonGroup>

			<p>&nbsp;</p>

			<SurfaceEditModal ref={editModalRef} />
			<GenericConfirmModal ref={confirmModalRef} />

			<h5>Connected</h5>

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>NO</th>
						<th>ID</th>
						<th>Name</th>
						<th>Type</th>
						<th>Location</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{devicesList.map((dev) => {
						return (
							<tr key={dev.id}>
								<td>#{dev.index}</td>
								<td>{dev.id}</td>
								<td>
									<TextInputField value={dev.name} setValue={(val) => updateName(dev.id, val)} />
								</td>
								<td>{dev.type}</td>
								<td>{dev.location}</td>
								<td className="text-right">
									<CButtonGroup>
										<CButton onClick={() => configureDevice(dev)} title="Configure">
											<FontAwesomeIcon icon={faCog} /> Settings
										</CButton>

										{dev.integrationType === 'emulator' && (
											<>
												<CButton href={`/emulator/${dev.id.substring(9)}`} target="_blank" title="Open Emulator">
													<FontAwesomeIcon icon={faFolderOpen} />
												</CButton>
												<CButton onClick={() => deleteEmulator(dev)} title="Delete Emulator">
													<FontAwesomeIcon icon={faTrash} />
												</CButton>
											</>
										)}
									</CButtonGroup>
								</td>
							</tr>
						)
					})}

					{devicesList.length === 0 && (
						<tr>
							<td colSpan={4}>No control surfaces have been detected</td>
						</tr>
					)}
				</tbody>
			</table>

			<h5>Disconnected</h5>

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>ID</th>
						<th>Name</th>
						<th>Type</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{offlineDevicesList.map((dev) => {
						return (
							<tr key={dev.id}>
								<td>{dev.id}</td>
								<td>
									<TextInputField value={dev.name} setValue={(val) => updateName(dev.id, val)} />
								</td>
								<td>{dev.type}</td>
								<td className="text-right">
									<CButton onClick={() => forgetDevice(dev)}>
										<FontAwesomeIcon icon={faTrash} /> Forget
									</CButton>
								</td>
							</tr>
						)
					})}

					{offlineDevicesList.length === 0 && (
						<tr>
							<td colSpan={4}>No items</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	)
})

const SurfaceEditModal = forwardRef(function SurfaceEditModal(_props, ref) {
	const socket = useContext(SocketContext)

	const [deviceInfo, setDeviceInfo] = useState(null)
	const [show, setShow] = useState(false)

	const [deviceConfig, setDeviceConfig] = useState(null)
	const [deviceConfigInfo, setDeviceConfigInfo] = useState(null)
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
				.then(([config, info]) => {
					console.log(config, info)
					setDeviceConfig(config)
					setDeviceConfigInfo(info)
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
				<LoadingRetryOrError
					error={deviceConfigError}
					dataReady={deviceConfig && deviceConfigInfo}
					doRetry={doRetryConfigLoad}
				/>
				{deviceConfig && deviceInfo && deviceConfigInfo && (
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
