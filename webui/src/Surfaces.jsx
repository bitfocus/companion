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
import { LoadingRetryOrError, SurfacesContext, socketEmit2, SocketContext } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAdd, faCog, faFolderOpen, faSync, faTrash } from '@fortawesome/free-solid-svg-icons'
import { nanoid } from 'nanoid'
import { TextInputField } from './Components/TextInputField'
import { useMemo } from 'react'

export const SurfacesPage = memo(function SurfacesPage() {
	const socket = useContext(SocketContext)
	const devices = useContext(SurfacesContext)

	const devicesList = useMemo(() => {
		const ary = Object.values(devices)

		ary.sort((a, b) => {
			if (a.index !== b.index) {
				return a.index - b.index
			}

			// fallback to serial
			return a.id.localeCompare(b.id)
		})

		return ary
	}, [devices])

	const editModalRef = useRef()

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

		socketEmit2(socket, 'surfaces:rescan', [], 30000)
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
		socketEmit2(socket, 'surfaces:emulator-add', []).catch((err) => {
			console.error('Emulator add failed', err)
		})
	}, [socket])

	const deleteEmulator = useCallback(
		(dev) => {
			socketEmit2(socket, 'surfaces:emulator-remove', [dev.id]).catch((err) => {
				console.error('Emulator remove failed', err)
			})
		},
		[socket]
	)

	const configureDevice = useCallback((device) => {
		editModalRef.current.show(device)
	}, [])

	const updateName = useCallback(
		(serialnumber, name) => {
			socketEmit2(socket, 'surfaces:set-name', [serialnumber, name]).catch((err) => {
				console.error('Update name failed', err)
			})
		},
		[socket]
	)

	return (
		<div>
			<h4>Surfaces</h4>
			<p>
				These are the surfaces currently connected to companion. If your streamdeck is missing from this list, you might
				need to close the Elgato Streamdeck application and click the Rescan button below.
			</p>
			<p>
				<i>
					Rescanning blocks all operations while the scan is ongoing. <b>Use with care!</b>
				</i>
			</p>
			<CAlert color="warning" role="alert" style={{ display: scanError ? '' : 'none' }}>
				{scanError}
			</CAlert>

			<SurfaceEditModal ref={editModalRef} />

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>NO</th>
						<th>ID</th>
						<th>Name</th>
						<th>Type</th>
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
									<TextInputField definition={{}} value={dev.name} setValue={(val) => updateName(dev.id, val)} />
								</td>
								<td>{dev.type}</td>
								<td>
									<CButtonGroup>
										<CButton color="success" onClick={() => configureDevice(dev)} title="Configure">
											<FontAwesomeIcon icon={faCog} /> Settings
										</CButton>

										{dev.integrationType === 'emulator' ? (
											<>
												<CButton
													color="info"
													href={`/emulator/${dev.id.substring(9)}`}
													target="_blank"
													title="Open Emulator"
												>
													<FontAwesomeIcon icon={faFolderOpen} />
												</CButton>
												<CButton color="danger" onClick={() => deleteEmulator(dev)} title="Delete Emulator">
													<FontAwesomeIcon icon={faTrash} />
												</CButton>
											</>
										) : (
											''
										)}
									</CButtonGroup>
								</td>
							</tr>
						)
					})}

					{devicesList.length === 0 ? (
						<tr>
							<td colSpan={4}>No control surfaces have been detected</td>
						</tr>
					) : (
						''
					)}
				</tbody>
			</table>

			<CButton color="warning" onClick={refreshUSB}>
				<FontAwesomeIcon icon={faSync} spin={scanning} />
				{scanning ? ' Checking for new devices...' : ' Rescan USB'}
			</CButton>
			<CButton color="warning" onClick={addEmulator}>
				<FontAwesomeIcon icon={faAdd} /> Add Emulator
			</CButton>
			<p>&nbsp;</p>
			<CAlert color="info">
				<p>
					Did you know, you can connect a Streamdeck from another computer or Raspberry Pi with{' '}
					<a target="_blank" rel="noreferrer" href="https://github.com/bitfocus/companion-satellite">
						Companion Satellite
					</a>
					?
				</p>
			</CAlert>
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
			socketEmit2(socket, 'surfaces:config-get', [deviceInfo.id])
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

					socketEmit2(socket, 'surfaces:config-set', [deviceInfo.id, newConfig])
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
				{deviceConfig && deviceInfo && deviceConfigInfo ? (
					<CForm>
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
						{deviceConfigInfo.xOffsetMax > 0 ? (
							<CFormGroup>
								<CLabel htmlFor="page">X Offset in grid</CLabel>
								<CInput
									name="page"
									type="range"
									min={0}
									max={deviceConfigInfo.xOffsetMax}
									step={1}
									value={deviceConfig.xOffset}
									onChange={(e) => updateConfig('xOffset', parseInt(e.currentTarget.value))}
								/>
								<span>{deviceConfig.xOffset}</span>
							</CFormGroup>
						) : (
							''
						)}
						{deviceConfigInfo.yOffsetMax > 0 ? (
							<CFormGroup>
								<CLabel htmlFor="page">Y Offset in grid</CLabel>
								<CInput
									name="page"
									type="range"
									min={0}
									max={deviceConfigInfo.yOffsetMax}
									step={1}
									value={deviceConfig.yOffset}
									onChange={(e) => updateConfig('yOffset', parseInt(e.currentTarget.value))}
								/>
								<span>{deviceConfig.yOffset}</span>
							</CFormGroup>
						) : (
							''
						)}
						{deviceInfo.configFields?.includes('brightness') ? (
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
						) : (
							''
						)}
						{deviceInfo.configFields?.includes('rotation') ? (
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
						) : (
							''
						)}
						{deviceInfo.configFields?.includes('enable_device') ? (
							<CFormGroup>
								<CLabel htmlFor="enable_device">Enable Device</CLabel>
								<CInputCheckbox
									name="enable_device"
									type="checkbox"
									checked={!!deviceConfig.enable_device}
									value={true}
									onChange={(e) => updateConfig('enable_device', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
						) : (
							''
						)}
						{deviceInfo.configFields?.includes('emulator_control_enable') ? (
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
						) : (
							''
						)}
					</CForm>
				) : (
					''
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
