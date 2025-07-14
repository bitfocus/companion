import React, { useCallback } from 'react'
import { LoadingRetryOrError } from '~/util.js'
import { CAlert, CButton, CCol, CContainer, CRow, CWidgetStatsA } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { useNavigate } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/TRPC'
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
					<CRow>
						<CCol sm={12}>
							<h1>Emulator Chooser</h1>
						</CCol>

						{emulatorList.data.map((surface) => (
							<CCol sm={4} key={surface.id}>
								<CButton
									color="light"
									onClick={() =>
										void navigate({
											to: '/emulator/$emulatorId',
											params: { emulatorId: surface.id },
										})
									}
									className="mb-4"
								>
									{surface.name || 'Emulator'}
								</CButton>
							</CCol>
						))}

						{emulatorList.data.length === 0 && (
							<CCol sm={4}>
								<CWidgetStatsA
									chart={
										<NonIdealState icon={faGamepad}>
											No Emulators have been created
											<br />
											You can create one in the Surfaces tab
										</NonIdealState>
									}
								/>
							</CCol>
						)}
					</CRow>
				) : (
					<CRow style={{ margin: '20% 0' }}>
						<LoadingRetryOrError error={emulatorList.error} dataReady={false} doRetry={doRetryLoad} design="pulse-xl" />
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
