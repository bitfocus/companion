import React, { useCallback, useEffect, useMemo, useState, useContext } from 'react'
import { LoadingRetryOrError, MyErrorBoundary, SocketContext, useMountEffect, PreventDefaultHandler } from '~/util.js'
import { CButton, CCol, CForm, CRow } from '@coreui/react'
import { dsanMastercueKeymap, keyboardKeymap, logitecKeymap } from './Keymaps.js'
import { ButtonPreview } from '~/Components/ButtonPreview.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCancel, faExpand } from '@fortawesome/free-solid-svg-icons'
import { ControlLocation, EmulatorConfig, EmulatorImageCache } from '@companion-app/shared/Model/Common.js'
import { UserConfigStore } from '~/Stores/UserConfigStore.js'
import { useUserConfigSubscription } from '~/Hooks/useUserConfigSubscription.js'
import { observer } from 'mobx-react-lite'
import { useParams } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/TRPC.js'

export const Emulator = observer(function Emulator() {
	const socket = useContext(SocketContext)

	const { emulatorId } = useParams({ from: '/emulator/$emulatorId' })

	const config = useSubscription(trpc.surfaces.emulatorConfig.subscriptionOptions({ id: emulatorId }))

	const [imageCache, setImageCache] = useState<EmulatorImageCache>({})
	useEffect(() => {
		// Clear the images on id change
		setImageCache({})
	}, [emulatorId])

	const doRetryLoad = useCallback(() => config.reset(), [])

	const userConfigStore = useMemo(() => new UserConfigStore(), [])
	useUserConfigSubscription(socket, userConfigStore)

	useEffect(() => {
		document.title =
			userConfigStore.properties?.installName && userConfigStore.properties?.installName.length > 0
				? `${userConfigStore.properties?.installName} - Emulator (Bitfocus Companion)`
				: 'Bitfocus Companion - Emulator'
	}, [userConfigStore.properties?.installName])

	const keymap = useMemo(() => {
		if (config.data?.emulator_control_enable) {
			return { ...keyboardKeymap, ...logitecKeymap, ...dsanMastercueKeymap }
		} else {
			return keyboardKeymap
		}
	}, [config.data?.emulator_control_enable])

	useEffect(() => {
		const unsubImages = socket.on('emulator:images', (newImages) => {
			console.log('new images', newImages)
			setImageCache((old) => {
				if (Array.isArray(newImages)) {
					const res = { ...old }

					for (const change of newImages) {
						const row = (res[change.y] = { ...res[change.y] })
						row[change.x] = change.buffer
					}

					return res
				} else {
					return newImages
				}
			})
		})

		return () => {
			unsubImages()
		}
	}, [socket, imageCache])

	useEffect(() => {
		const unsub = socket.onConnect(() => {
			doRetryLoad()
		})

		return unsub
	}, [socket])

	// Register key handlers
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!emulatorId) return

			const xy = keymap[e.code] ?? keymap[e.keyCode]
			if (xy) {
				socket.emitPromise('emulator:press', [emulatorId, ...xy]).catch((e: any) => {
					console.error('press failed', e)
				})
				console.log('emulator:press', emulatorId, xy)
			}
		}

		const onKeyUp = (e: KeyboardEvent) => {
			if (!emulatorId) return

			const xy = keymap[e.code] ?? keymap[e.keyCode]
			if (xy) {
				socket.emitPromise('emulator:release', [emulatorId, ...xy]).catch((e: any) => {
					console.error('release failed', e)
				})
				console.log('emulator:release', emulatorId, xy)
			}
		}

		document.addEventListener('keydown', onKeyDown)
		document.addEventListener('keyup', onKeyUp)

		return () => {
			document.removeEventListener('keydown', onKeyDown)
			document.removeEventListener('keyup', onKeyUp)
		}
	}, [socket, keymap, emulatorId])

	const buttonClick = useCallback(
		(location: ControlLocation, pressed: boolean) => {
			if (!emulatorId) return
			if (pressed) {
				socket.emitPromise('emulator:press', [emulatorId, location.column, location.row]).catch((e: any) => {
					console.error('press failed', e)
				})
				console.log('emulator:press', emulatorId, location)
			} else {
				socket.emitPromise('emulator:release', [emulatorId, location.column, location.row]).catch((e: any) => {
					console.error('release failed', e)
				})
				console.log('emulator:release', emulatorId, location)
			}
		},
		[socket, emulatorId]
	)

	return (
		<div className="page-tablet page-emulator">
			{config.data ? (
				<>
					<ConfigurePanel config={config.data} />

					<EmulatorButtons
						imageCache={imageCache}
						buttonClick={buttonClick}
						columns={config.data.emulator_columns}
						rows={config.data.emulator_rows}
					/>
				</>
			) : (
				<CRow className={'loading'}>
					<LoadingRetryOrError dataReady={false} error={config.error} doRetry={doRetryLoad} />
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

interface EmulatorButtonsProps {
	imageCache: EmulatorImageCache
	buttonClick: (location: ControlLocation, pressed: boolean) => void
	columns: number
	rows: number
}

function EmulatorButtons({ imageCache, buttonClick, columns, rows }: EmulatorButtonsProps) {
	const gridStyle = useMemo(() => {
		return {
			gridTemplateColumns: 'minmax(0, 1fr) '.repeat(columns),
			gridTemplateRows: 'minmax(0, 1fr) '.repeat(rows),
			aspectRatio: `${columns} / ${rows}`,
			height: `min(calc(100vw / ${columns} * ${rows}), 100vh)`,
			width: `min(calc(100vh / ${rows} * ${columns}), 100vw)`,
		}
	}, [rows, columns])

	const buttonElms = []
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			buttonElms.push(
				<ButtonPreview2 key={`${y}/${x}`} column={x} row={y} preview={imageCache[y]?.[x]} onClick={buttonClick} />
			)
		}
	}

	return (
		<MyErrorBoundary>
			<div className="emulatorgrid">
				<div className="buttongrid" style={gridStyle}>
					{buttonElms}
				</div>
			</div>
		</MyErrorBoundary>
	)
}

interface ButtonPreview2Props {
	column: number
	row: number

	preview: string | undefined | null | false
	onClick: (location: ControlLocation, pressed: boolean) => void
}
function ButtonPreview2({ column, row, ...props }: ButtonPreview2Props) {
	const location = useMemo(() => ({ pageNumber: 0, column, row }), [column, row])
	return <ButtonPreview {...props} location={location} title={`Button ${column}/${row}`} />
}
