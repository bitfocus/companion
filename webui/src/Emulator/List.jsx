import { useCallback, useEffect, useMemo, useState, useContext } from 'react'
import { LoadingRetryOrError, SocketContext, socketEmitPromise } from '../util'
import { CCol, CContainer, CRow, CWidgetSimple } from '@coreui/react'
import { nanoid } from 'nanoid'
import { useNavigate } from 'react-router-dom'
import jsonPatch from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'

export function EmulatorList() {
	const socket = useContext(SocketContext)

	const [surfaces, setSurfaces] = useState(null)
	const [loadError, setLoadError] = useState(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doRetryLoad = useCallback(() => setReloadToken(nanoid()), [])

	useEffect(() => {
		setSurfaces(null)
		setLoadError(null)

		socketEmitPromise(socket, 'surfaces:subscribe', [])
			.then((surfaces) => {
				setSurfaces(surfaces)
			})
			.catch((e) => {
				console.error('Failed to load surfaces', e)
				setLoadError('Failed to load surfaces')
			})

		const patchSurfaces = (patch) => {
			setSurfaces((oldSurfaces) => {
				return jsonPatch.applyPatch(cloneDeep(oldSurfaces) || {}, patch).newDocument
			})
		}
		socket.on('surfaces:patch', patchSurfaces)

		return () => {
			socketEmitPromise(socket, 'surfaces:unsubscribe', []).catch((e) => {
				console.error('Failed to unsubscribe from surfaces', e)
			})
		}
	}, [socket, reloadToken])

	const emulators = useMemo(() => {
		return Object.values(surfaces || {}).filter((s) => s.id.startsWith('emulator:'))
	}, [surfaces])

	return (
		<div className="page-emulator-list">
			<CContainer fluid className="d-flex flex-column">
				<LoadingRetryOrError error={loadError} dataReady={surfaces} doRetry={doRetryLoad} />
				{surfaces && (
					<CRow alignHorizontal="center">
						<CCol sm={12}>
							<p>&nbsp;</p>
						</CCol>

						{emulators.map((dev) => (
							<EmulatorCard key={dev.id} surface={dev} />
						))}

						{emulators.length === 0 && (
							<CCol sm={4}>
								<CWidgetSimple text="No Emulators have been created">
									You can create one in the Surfaces tab
								</CWidgetSimple>
							</CCol>
						)}
					</CRow>
				)}
			</CContainer>
		</div>
	)
}

function EmulatorCard({ surface }) {
	const navigate = useNavigate()
	const click = useCallback(() => {
		console.log('click', surface.id)
		navigate(`/emulator/${surface.id.substring(9)}`)
	}, [navigate, surface.id])
	return (
		<CCol sm={4}>
			<CWidgetSimple text={surface.name || 'Emulator'} onClick={click} className="widget-clickable">
				{/* <CButton color="primary">Open</CButton> */}
			</CWidgetSimple>
		</CCol>
	)
}
