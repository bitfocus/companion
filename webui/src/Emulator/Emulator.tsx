import React, { useCallback, useState } from 'react'
import { useMountEffect, PreventDefaultHandler } from '~/Resources/util.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { CButton, CCol, CForm, CRow } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCancel, faGamepad, faExpand } from '@fortawesome/free-solid-svg-icons'
import type { EmulatorConfig } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/Resources/TRPC.js'
import { useWakeLock } from '~/Hooks/useScreenWakeLock.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { useEmulatorImageCache } from './ImageCache.js'
import { EmulatorButtons } from './Buttons.js'
import { EmulatorLockedPage } from './LockedState.js'

export const Emulator = observer(function Emulator() {
	const { emulatorId } = useParams({ from: '/emulator/$emulatorId' })

	const config = useSubscription(trpc.surfaces.emulatorConfig.subscriptionOptions({ id: emulatorId }))
	const lockedState = useSubscription(trpc.surfaces.emulatorLocked.subscriptionOptions({ id: emulatorId }))

	const doRetryLoad = useCallback(() => config.reset(), [config])

	const { imagesSub, getImage } = useEmulatorImageCache(emulatorId, !!config.data)

	useWakeLock()

	return (
		<div className="page-tablet page-emulator">
			{config.data && imagesSub.data && lockedState.data !== null ? (
				<>
					<ConfigurePanel config={config.data} />

					{lockedState.data ? (
						<EmulatorLockedPage emulatorId={emulatorId} lockedState={lockedState.data} />
					) : (
						<EmulatorButtons
							emulatorId={emulatorId}
							getImage={getImage}
							columns={config.data.emulator_columns}
							rows={config.data.emulator_rows}
							enableExtendedKeymap={!!config.data.emulator_control_enable}
						/>
					)}
				</>
			) : config.data === null ? (
				<CRow className={'loading'}>
					<EmulatorNotFound emulatorId={emulatorId} />
				</CRow>
			) : (
				<CRow className={'loading'}>
					<LoadingRetryOrError
						dataReady={false}
						error={config.error || imagesSub.error || lockedState.error}
						doRetry={doRetryLoad}
						design="pulse-xl"
					/>
				</CRow>
			)}
		</div>
	)
})

interface ConfigurePanelProps {
	config: EmulatorConfig
}

function ConfigurePanel({ config }: ConfigurePanelProps): JSX.Element | null {
	const [show, setShow] = useState(true)
	const [fullscreen, setFullscreen] = useState(document.fullscreenElement !== null)

	useMountEffect(() => {
		const handleChange = () => {
			console.log('fullscreen change')
			setFullscreen(document.fullscreenElement !== null)
		}

		document.addEventListener('fullscreenchange', handleChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleChange)
		}
	})

	const doRequestFullscreen = useCallback(() => {
		document.documentElement.requestFullscreen().catch((err) => {
			console.error('Error attempting to enable fullscreen mode:', err)
		})
	}, [])
	const doDismiss = useCallback(() => {
		setShow(false)
	}, [])

	return show && config.emulator_prompt_fullscreen && !fullscreen ? (
		<CRow className="configure">
			<CCol sm={12}>
				<CForm onSubmit={PreventDefaultHandler}>
					<CRow>
						<CCol xs={12}>
							<CButton
								onClick={doRequestFullscreen}
								title="Fullscreen"
								disabled={!document.documentElement.requestFullscreen}
							>
								<FontAwesomeIcon icon={faExpand} /> Fullscreen
							</CButton>
							<CButton onClick={doDismiss} title="Dismiss">
								<FontAwesomeIcon icon={faCancel} /> Dismiss
							</CButton>
						</CCol>
					</CRow>
				</CForm>
			</CCol>
		</CRow>
	) : null
}

function EmulatorNotFound({ emulatorId }: { emulatorId: string }) {
	const navigate = useNavigate({ from: '/emulator' })

	return (
		<div className="emulator-not-found">
			<NonIdealState icon={faGamepad} className="emulator-nonideal" style={{ color: '#f7f7f7' }}>
				<div>
					The emulator with ID <code>{emulatorId}</code> was not found.
				</div>
				<div>
					<CButton
						color="warning"
						className="emulator-back-button"
						onClick={() => void navigate({ to: '/emulators' })}
						title="Back to emulator list"
					>
						Back
					</CButton>
				</div>
			</NonIdealState>
		</div>
	)
}
