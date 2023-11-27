import React, { useCallback, useEffect, useMemo, useState, useContext } from 'react'
import { LoadingRetryOrError, SocketContext, socketEmitPromise } from '../util.js'
import { CAlert, CCol, CContainer, CRow, CWidgetSimple } from '@coreui/react'
import { nanoid } from 'nanoid'
import { useNavigate } from 'react-router-dom'
import jsonPatch, { Operation as JsonPatchOperation } from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import type { ClientDevicesListItem, ClientSurfaceItem } from '@companion/shared/Model/Surfaces.js'

export function EmulatorList() {
	const socket = useContext(SocketContext)

	const [surfaceGroups, setSurfaceGroups] = useState<Record<string, ClientDevicesListItem | undefined> | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doRetryLoad = useCallback(() => setReloadToken(nanoid()), [])

	useEffect(() => {
		setSurfaceGroups(null)
		setLoadError(null)

		socketEmitPromise(socket, 'surfaces:subscribe', [])
			.then((surfaces) => {
				setSurfaceGroups(surfaces)
			})
			.catch((e) => {
				console.error('Failed to load surfaces', e)
				setLoadError('Failed to load surfaces')
			})

		const patchSurfaces = (patch: JsonPatchOperation[]) => {
			setSurfaceGroups((oldSurfaces) => {
				return oldSurfaces && jsonPatch.applyPatch(cloneDeep(oldSurfaces) || {}, patch).newDocument
			})
		}
		socket.on('surfaces:patch', patchSurfaces)

		return () => {
			socketEmitPromise(socket, 'surfaces:unsubscribe', []).catch((e: any) => {
				console.error('Failed to unsubscribe from surfaces', e)
			})
		}
	}, [socket, reloadToken])

	const emulators = useMemo(() => {
		const emulators: ClientSurfaceItem[] = []

		for (const group of Object.values(surfaceGroups ?? {})) {
			if (!group) continue

			for (const surface of group.surfaces) {
				if (surface.integrationType === 'emulator' || surface.id.startsWith('emulator:')) {
					emulators.push(surface)
				}
			}
		}

		return emulators
	}, [surfaceGroups])

	return (
		<div className="page-emulator-list">
			<CContainer fluid className="d-flex flex-column">
				<LoadingRetryOrError error={loadError} dataReady={!!surfaceGroups} doRetry={doRetryLoad} />
				{surfaceGroups && (
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

				<CAlert color="info">
					Use <b>1 2 3 4 5 6 7 8</b>, <b>Q W E R T Y U I</b>, <b>A S D F G H J K</b>, <b>Z X C V B N M ,</b> to control
					this surface with your keyboard!
					<br />
					If enabled in the Surface Settings, A Logitech R400/Mastercue/DSan will send a button press to button; 2
					(Back), 3 (forward), 4 (black) and for logitech: 10/11 (Start and stop) on each page.
				</CAlert>
			</CContainer>
		</div>
	)
}

interface EmulatorCardProps {
	surface: ClientSurfaceItem
}
function EmulatorCard({ surface }: EmulatorCardProps) {
	const navigate = useNavigate()
	const click = useCallback(() => {
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
