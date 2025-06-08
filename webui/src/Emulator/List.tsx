import React, { useCallback, useMemo, useState, useContext } from 'react'
import { LoadingRetryOrError, SocketContext, useComputed } from '~/util.js'
import { CAlert, CButton, CCol, CContainer, CRow, CWidgetStatsA } from '@coreui/react'
import { nanoid } from 'nanoid'
import type { ClientSurfaceItem } from '@companion-app/shared/Model/Surfaces.js'
import { SurfacesStore } from '~/Stores/SurfacesStore.js'
import { useSurfacesSubscription } from '~/Hooks/useSurfacesSubscription.js'
import { observer } from 'mobx-react-lite'
import { useNavigate } from '@tanstack/react-router'

export const EmulatorList = observer(function EmulatorList() {
	const socket = useContext(SocketContext)
	const navigate = useNavigate({ from: '/emulator' })

	const [loadError, setLoadError] = useState<string | null>(null)
	const [reloadToken, setReloadToken] = useState(nanoid())

	const doRetryLoad = useCallback(() => setReloadToken(nanoid()), [])

	const surfacesStore = useMemo(() => new SurfacesStore(), [])
	const surfacesReady = useSurfacesSubscription(socket, surfacesStore, setLoadError, reloadToken)

	const emulators = useComputed(() => {
		const emulators: ClientSurfaceItem[] = []

		for (const group of surfacesStore.store.values()) {
			if (!group) continue

			for (const surface of group.surfaces) {
				if (surface.integrationType === 'emulator' || surface.id.startsWith('emulator:')) {
					emulators.push(surface)
				}
			}
		}

		return emulators
	}, [surfacesStore])

	return (
		<div className="page-emulator-list">
			<CContainer fluid className="d-flex flex-column">
				<LoadingRetryOrError error={loadError} dataReady={!!surfacesReady} doRetry={doRetryLoad} />
				{surfacesReady && (
					<CRow>
						<CCol sm={12}>
							<h1>Emulator Chooser</h1>
						</CCol>

						{emulators.map((surface) => (
							<CCol sm={4}>
								<CButton
									key={surface.id}
									color="light"
									onClick={() => void navigate({ to: `/emulator/${surface.id.substring(9)}` })}
									className="mb-4"
								>
									{surface.name || 'Emulator'}
								</CButton>
							</CCol>
						))}

						{emulators.length === 0 && (
							<CCol sm={4}>
								<CWidgetStatsA title="No Emulators have been created">
									You can create one in the Surfaces tab
								</CWidgetStatsA>
							</CCol>
						)}
					</CRow>
				)}

				<CAlert color="info" className="margin-top">
					Use <b>1 2 3 4 5 6 7 8</b>, <b>Q W E R T Y U I</b>, <b>A S D F G H J K</b>, <b>Z X C V B N M ,</b> to control
					this surface with your keyboard!
					<br />
					If enabled in the Surface Settings, A Logitech R400/Mastercue/DSan will send a button press to button; 2
					(Back), 3 (forward), 4 (black) and for logitech: 10/11 (Start and stop) on each page.
				</CAlert>
			</CContainer>
		</div>
	)
})
