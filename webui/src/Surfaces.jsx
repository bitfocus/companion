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
	CForm,
	CFormGroup,
	CInput,
	CLabel,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CSelect,
} from '@coreui/react'
import { CompanionContext, LoadingRetryOrError, socketEmit } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faSync } from '@fortawesome/free-solid-svg-icons'
import shortid from 'shortid'

export const SurfacesPage = memo(function SurfacesPage() {
	const context = useContext(CompanionContext)

	const editModalRef = useRef()

	const [scanning, setScanning] = useState(false)
	const [scanError, setScanError] = useState(null)
	const [devices, setDevices] = useState([])

	useEffect(() => {
		context.socket.on('devices_list', setDevices)
		context.socket.emit('devices_list_get')

		return () => {
			context.socket.off('devices_list', setDevices)
		}
	}, [context.socket])

	useEffect(() => {
		// If device disappears, hide the edit modal
		if (editModalRef.current) {
			editModalRef.current.ensureIdIsValid(devices.map((d) => d.id))
		}
	}, [devices])

	const refreshUSB = useCallback(() => {
		setScanning(true)
		setScanError(null)

		socketEmit(context.socket, 'devices_reenumerate', [], 30000)
			.then(([errorMsg]) => {
				setScanError(errorMsg || null)
				setScanning(false)
			})
			.catch((err) => {
				console.error('Refresh USB failed', err)

				setScanning(false)
			})
	}, [context.socket])

	const configureDevice = useCallback((device) => {
		editModalRef.current.show(device)
	}, [])

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
						<th>Type</th>
						<th>&nbsp;</th>
					</tr>
				</thead>
				<tbody>
					{devices.map((dev, i) => {
						return (
							<tr key={dev.id}>
								<td>#{i}</td>
								<td>{dev.serialnumber}</td>
								<td>{dev.type}</td>
								<td>
									{dev?.config && dev.config.length > 0 ? (
										<CButton color="success" onClick={() => configureDevice(dev)}>
											<FontAwesomeIcon icon={faCog} /> Settings
										</CButton>
									) : (
										''
									)}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>

			<CButton color="warning" onClick={refreshUSB}>
				<FontAwesomeIcon icon={faSync} spin={scanning} />
				{scanning ? ' Checking for new devices...' : ' Rescan USB'}
			</CButton>
		</div>
	)
})

const SurfaceEditModal = forwardRef(function SurfaceEditModal(_props, ref) {
	const context = useContext(CompanionContext)

	const [deviceInfo, setDeviceInfo] = useState(null)
	const [show, setShow] = useState(false)

	const [deviceConfig, setDeviceConfig] = useState(null)
	const [deviceConfigError, setDeviceConfigError] = useState(null)
	const [reloadToken, setReloadToken] = useState(shortid())

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setDeviceInfo(null)
		setDeviceConfig(null)
		setDeviceConfigError(null)
	}, [])

	const doRetryConfigLoad = useCallback(() => setReloadToken(shortid()), [])

	useEffect(() => {
		setDeviceConfigError(null)
		setDeviceConfig(null)

		if (deviceInfo?.id) {
			socketEmit(context.socket, 'device_config_get', [deviceInfo.id])
				.then(([err, config]) => {
					setDeviceConfig(config)
				})
				.catch((err) => {
					console.error('Failed to load device config')
					setDeviceConfigError(`Failed to load device config`)
				})
		}
	}, [context.socket, deviceInfo?.id, reloadToken])

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

					context.socket.emit('device_config_set', deviceInfo.id, newConfig)
					return newConfig
				})
			}
		},
		[context.socket, deviceInfo?.id]
	)

	return (
		<CModal show={show} onClose={doClose} onClosed={onClosed}>
			<CModalHeader closeButton>
				<h5>Settings for {deviceInfo?.type}</h5>
			</CModalHeader>
			<CModalBody>
				<LoadingRetryOrError error={deviceConfigError} dataReady={deviceConfig} doRetry={doRetryConfigLoad} />
				{deviceConfig && deviceInfo ? (
					<CForm>
						{deviceInfo.config?.includes('brightness') ? (
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

						{deviceInfo.config?.includes('orientation') ? (
							<CFormGroup>
								<CLabel htmlFor="orientation">Button rotation</CLabel>
								<CSelect
									name="orientation"
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

						{deviceInfo.config?.includes('page') ? (
							<CFormGroup>
								<CLabel htmlFor="page">Page</CLabel>
								<CInput
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
						) : (
							''
						)}

						{deviceInfo.config?.includes('keysPerRow') ? (
							<CFormGroup>
								<CLabel htmlFor="keysPerRow">Keys per row</CLabel>
								<CInput
									name="keysPerRow"
									type="range"
									min={1}
									max={99}
									step={1}
									value={deviceConfig.keysPerRow}
									onChange={(e) => updateConfig('keysPerRow', parseInt(e.currentTarget.value))}
								/>
								<span>{deviceConfig.keysPerRow}</span>
							</CFormGroup>
						) : (
							''
						)}

						{deviceInfo.config?.includes('keysPerColumn') ? (
							<CFormGroup>
								<CLabel htmlFor="keysPerColumn">Keys per column</CLabel>
								<CInput
									name="keysPerColumn"
									type="range"
									min={1}
									max={99}
									step={1}
									value={deviceConfig.keysPerColumn}
									onChange={(e) => updateConfig('keysPerColumn', parseInt(e.currentTarget.value))}
								/>
								<span>{deviceConfig.keysPerColumn}</span>
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
