import React, { useCallback } from 'react'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { CAlert, CButton, CCol, CContainer, CRow } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { useNavigate } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC'
import { NonIdealState } from '~/Components/NonIdealState'
import { faGamepad } from '@fortawesome/free-solid-svg-icons'

export const EmulatorList = observer(function EmulatorList() {
	const navigate = useNavigate({ from: '/emulator' })

	const emulatorList = useSubscription(trpc.surfaces.emulatorList.subscriptionOptions())
	const doRetryLoad = useCallback(() => emulatorList.reset(), [emulatorList])
	return (
		<div className="page-emulator-list">
			<CContainer fluid className="d-flex flex-column">
				{emulatorList.data ? (
					<>
						<CRow>
							<CCol sm={12}>
								<h1>Emulator Chooser</h1>
							</CCol>
						</CRow>

						<CRow className="mb-3">
							<CCol>
								<CAlert color="dark" className="bg-dark text-light p-3">
									<div>
										Use <b>1 2 3 4 5 6 7 8</b>, <b>Q W E R T Y U I</b>, <b>A S D F G H J K</b>, <b>Z X C V B N M ,</b>
										to control this surface with your keyboard!
									</div>
									<div className="mt-2">
										If enabled in the Surface Settings, a Logitech R400/Mastercue/DSan will send a button press to
										button: 2 (Back), 3 (forward), 4 (black), and for logitech: 10/11 (Start and stop) on each page.
									</div>
								</CAlert>
							</CCol>
						</CRow>

						<CRow>
							{emulatorList.data.map((surface) => (
								<CCol sm={12} md={6} lg={4} key={surface.id} className="mb-4">
									<CButton
										color="dark"
										className="w-100 d-flex flex-column align-items-center justify-content-center emulator-button"
										onClick={() =>
											void navigate({
												to: '/emulator/$emulatorId',
												params: { emulatorId: surface.id },
											})
										}
										data-surfaceId={surface.id}
									>
										<div className="mt-2">{surface.name || 'Emulator'}</div>
									</CButton>
								</CCol>
							))}

							{emulatorList.data.length === 0 && (
								<CCol sm={12} className="text-center mt-5">
									<NonIdealState icon={faGamepad} className="emulator-nonideal">
										No Emulators have been created
										<br />
										You can create one in the Surfaces tab
									</NonIdealState>
								</CCol>
							)}
						</CRow>
					</>
				) : (
					<CRow style={{ margin: '20% 0' }}>
						<LoadingRetryOrError error={emulatorList.error} dataReady={false} doRetry={doRetryLoad} design="pulse-xl" />
					</CRow>
				)}
			</CContainer>
		</div>
	)
})
