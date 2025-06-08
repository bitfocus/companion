import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, MyErrorBoundary, useMountEffect, PreventDefaultHandler } from '~/util.js'
import { CButton, CCol, CForm, CRow } from '@coreui/react'
import { dsanMastercueKeymap, keyboardKeymap, logitecKeymap } from './Keymaps.js'
import { ButtonPreview } from '~/Components/ButtonPreview.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCancel, faExpand } from '@fortawesome/free-solid-svg-icons'
import { ControlLocation, EmulatorConfig } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import { useParams } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from '~/TRPC.js'
import { useMutation } from '@tanstack/react-query'
import { observable, ObservableMap, runInAction } from 'mobx'

function getCacheKey(x: number, y: number): string {
	return `${x}/${y}`
}

export const Emulator = observer(function Emulator() {
	const { emulatorId } = useParams({ from: '/emulator/$emulatorId' })

	const config = useSubscription(trpc.surfaces.emulatorConfig.subscriptionOptions({ id: emulatorId }))

	const pressedMutation = useMutation(trpc.surfaces.emulatorPressed.mutationOptions())

	const doRetryLoad = useCallback(() => config.reset(), [config])

	const imageCache = useMemo(() => observable.map<string, string | false>(), [])
	const imagesSub = useSubscription(
		trpc.surfaces.emulatorImages.subscriptionOptions(
			{ id: emulatorId },
			{
				onStarted: () => {
					runInAction(() => {
						// Clear the image cache when the subscription starts
						imageCache.clear()
					})
				},
				onData: (data) => {
					runInAction(() => {
						if (data.clearCache) imageCache.clear()

						for (const change of data.images) {
							const key = getCacheKey(change.x, change.y)
							imageCache.set(key, change.buffer)
						}
					})
				},
			}
		)
	)

	const keymap = useMemo(() => {
		if (config.data?.emulator_control_enable) {
			return { ...keyboardKeymap, ...logitecKeymap, ...dsanMastercueKeymap }
		} else {
			return keyboardKeymap
		}
	}, [config.data?.emulator_control_enable])

	// Register key handlers
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!emulatorId) return

			const xy = keymap[e.code] ?? keymap[e.keyCode]
			if (xy) {
				console.log('emulator:press', emulatorId, xy)
				pressedMutation.mutate({
					id: emulatorId,
					column: xy[0],
					row: xy[1],
					pressed: true,
				})
			}
		}

		const onKeyUp = (e: KeyboardEvent) => {
			if (!emulatorId) return

			const xy = keymap[e.code] ?? keymap[e.keyCode]
			if (xy) {
				console.log('emulator:release', emulatorId, xy)
				pressedMutation.mutate({
					id: emulatorId,
					column: xy[0],
					row: xy[1],
					pressed: false,
				})
			}
		}

		document.addEventListener('keydown', onKeyDown)
		document.addEventListener('keyup', onKeyUp)

		return () => {
			document.removeEventListener('keydown', onKeyDown)
			document.removeEventListener('keyup', onKeyUp)
		}
	}, [pressedMutation, keymap, emulatorId])

	const buttonClick = useCallback(
		(location: ControlLocation, pressed: boolean) => {
			if (!emulatorId) return
			if (pressed) {
				console.log('emulator:press', emulatorId, location)
				pressedMutation.mutate({
					id: emulatorId,
					column: location.column,
					row: location.row,
					pressed: true,
				})
			} else {
				console.log('emulator:release', emulatorId, location)
				pressedMutation.mutate({
					id: emulatorId,
					column: location.column,
					row: location.row,
					pressed: false,
				})
			}
		},
		[pressedMutation, emulatorId]
	)

	return (
		<div className="page-tablet page-emulator">
			{config.data && imagesSub.data ? (
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
					<LoadingRetryOrError dataReady={false} error={config.error || imagesSub.error} doRetry={doRetryLoad} />
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
	imageCache: ObservableMap<string, string | false>
	buttonClick: (location: ControlLocation, pressed: boolean) => void
	columns: number
	rows: number
}

const EmulatorButtons = observer(function EmulatorButtons({
	imageCache,
	buttonClick,
	columns,
	rows,
}: EmulatorButtonsProps) {
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
				<ButtonPreview2
					key={`${y}/${x}`}
					column={x}
					row={y}
					preview={imageCache.get(getCacheKey(x, y))}
					onClick={buttonClick}
				/>
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
})

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
