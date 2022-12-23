import { useCallback, useEffect, useMemo, useState, useContext } from 'react'
import {
	LoadingRetryOrError,
	applyPatchOrReplaceObject,
	MyErrorBoundary,
	SocketContext,
	socketEmitPromise,
	useMountEffect,
} from '../util'
import { CButton, CCol, CContainer, CForm, CRow } from '@coreui/react'
import { nanoid } from 'nanoid'
import { useParams } from 'react-router-dom'
import { dsanMastercueKeymap, keyboardKeymap, logitecKeymap } from './Keymaps'
import { ButtonPreview, dataToButtonImage } from '../Components/ButtonPreview'
import { MAX_COLS, MAX_ROWS } from '../Constants'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCancel, faExpand } from '@fortawesome/free-solid-svg-icons'

export function Emulator() {
	const socket = useContext(SocketContext)

	const [config, setConfig] = useState(null)
	const [loadError, setLoadError] = useState(null)

	const { id: emulatorId } = useParams()

	const [imageCache, setImageCache] = useState({})
	useEffect(() => {
		// Clear the images on id change
		setImageCache({})
	}, [emulatorId])

	const [retryToken, setRetryToken] = useState(nanoid())
	const doRetryLoad = useCallback(() => setRetryToken(nanoid()), [])
	useEffect(() => {
		setConfig(null)
		setLoadError(null)

		socketEmitPromise(socket, 'emulator:startup', [emulatorId])
			.then((config) => {
				setConfig(config)
			})
			.catch((e) => {
				console.error('Emulator error', e)
				setLoadError(`Failed: ${e}`)
			})

		const updateConfig = (patch) => {
			setConfig((oldConfig) => applyPatchOrReplaceObject(oldConfig, patch))
		}

		socket.on('emulator:config', updateConfig)

		return () => {
			socket.off('emulator:config', updateConfig)
		}
	}, [retryToken, socket, emulatorId])

	const keymap = useMemo(() => {
		if (config?.emulator_control_enable) {
			return { ...keyboardKeymap, ...logitecKeymap, ...dsanMastercueKeymap }
		} else {
			return keyboardKeymap
		}
	}, [config?.emulator_control_enable])

	useEffect(() => {
		const updateImages = (newImages) => {
			setImageCache((old) => {
				const res = { ...old }
				for (const [key, data] of Object.entries(newImages)) {
					res[key] = data ? dataToButtonImage(data) : undefined
				}
				return res
			})
		}

		socket.on('emulator:images', updateImages)

		return () => {
			socket.off('emulator:images', updateImages)
		}
	}, [socket, imageCache])

	useEffect(() => {
		const onConnect = () => {
			setRetryToken(nanoid())
		}
		socket.on('connect', onConnect)
		return () => {
			socket.off('connect', onConnect)
		}
	}, [socket])

	const [keyDown, setKeyDown] = useState(null)

	// Register key handlers
	useEffect(() => {
		const onKeyDown = (e) => {
			if (keymap[e.keyCode] !== undefined) {
				socketEmitPromise(socket, 'emulator:press', [emulatorId, keymap[e.keyCode]]).catch((e) => {
					console.error('press failed', e)
				})
				console.log('emulator:press', emulatorId, keymap[e.keyCode])
			}
		}

		const onKeyUp = (e) => {
			if (keymap[e.keyCode] !== undefined) {
				socketEmitPromise(socket, 'emulator:release', [emulatorId, keymap[e.keyCode]]).catch((e) => {
					console.error('release failed', e)
				})
				console.log('emulator:release', emulatorId, keymap[e.keyCode])
			}
		}

		document.addEventListener('keydown', onKeyDown)
		document.addEventListener('keyup', onKeyUp)

		return () => {
			document.removeEventListener('keydown', onKeyDown)
			document.removeEventListener('keyup', onKeyUp)
		}
	}, [socket, keymap, emulatorId])

	useEffect(() => {
		// handle changes to keyDown, as it isnt safe to do inside setState
		if (keyDown) {
			socketEmitPromise(socket, 'emulator:press', [emulatorId, keyDown]).catch((e) => {
				console.error('press failed', e)
			})
			console.log('emulator:press', emulatorId, keyDown)

			return () => {
				socketEmitPromise(socket, 'emulator:release', [emulatorId, keyDown]).catch((e) => {
					console.error('release failed', e)
				})
				console.log('emulator:release', emulatorId, keyDown)
			}
		}
	}, [socket, keyDown, emulatorId])

	useEffect(() => {
		const onMouseUp = (e) => {
			e.preventDefault()
			setKeyDown(null)
		}

		document.body.addEventListener('mouseup', onMouseUp)

		return () => {
			document.body.removeEventListener('mouseup', onMouseUp)
			setKeyDown(null)
		}
	}, [])

	return (
		<div className="page-tablet">
			<CContainer fluid className="d-flex flex-column">
				{config ? (
					<>
						<ConfigurePanel config={config} />

						<CyclePages emulatorId={emulatorId} imageCache={imageCache} />
					</>
				) : (
					<CRow>
						<LoadingRetryOrError dataReady={false} error={loadError} doRetry={doRetryLoad} />
					</CRow>
				)}
			</CContainer>
		</div>
	)
}

function ConfigurePanel({ config }) {
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
		document.documentElement.requestFullscreen()
	}, [])
	const doDismiss = useCallback(() => {
		setShow(false)
	}, [])

	return show && config.emulator_prompt_fullscreen && !fullscreen ? (
		<CRow className="configure">
			<CCol sm={12}>
				<CForm>
					<CRow>
						<CCol xs={12}>
							<CButton onClick={doRequestFullscreen} title="Fullscreen">
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
	) : (
		''
	)
}

// function clamp(val, max) {
// 	return Math.min(Math.max(0, val), max)
// }

function CyclePages({ emulatorId, imageCache }) {
	const socket = useContext(SocketContext)
	// const goPrevPage = useCallback(() => {
	// 	// if (currentIndex <= 0) {
	// 	// 	if (loop) {
	// 	// 		setCurrentIndex(orderedPages.length - 1)
	// 	// 	}
	// 	// } else {
	// 	// 	setCurrentIndex(currentIndex - 1)
	// 	// }
	// }, [])
	// const goNextPage = useCallback(() => {
	// 	// if (currentIndex >= orderedPages.length - 1) {
	// 	// 	if (loop) {
	// 	// 		setCurrentIndex(0)
	// 	// 	}
	// 	// } else {
	// 	// 	setCurrentIndex(currentIndex + 1)
	// 	// }
	// }, [])
	// const goFirstPage = useCallback(() => {
	// 	// setCurrentIndex(0)
	// }, [])

	const bankClick = useCallback(
		(bank, pressed) => {
			const command = pressed ? 'emulator:press' : 'emulator:release'
			socketEmitPromise(socket, command, [emulatorId, bank]).catch((e) => {
				console.error(`${command} failed`, e)
			})
			console.log(command, emulatorId, bank)
		},
		[socket, emulatorId]
	)

	const cols = 8
	const rows = 4

	return (
		<CRow className="flex-grow-1">
			<div className="cycle-layout">
				<MyErrorBoundary>
					{/* <div></div> */}
					<div className="cycle-heading">
						{/* <h1 id={`page_${currentPage}`}> */}
						{/* {pages[currentPage]?.name || ' '} */}

						{/* {orderedPages.length > 1 && (
								<>
									<CButton onClick={goNextPage} disabled={!loop && currentIndex === orderedPages.length - 1} size="lg">
										<FontAwesomeIcon icon={faArrowRight} />
									</CButton>
									<CButton onClick={goPrevPage} disabled={!loop && currentIndex === 0} size="lg">
										<FontAwesomeIcon icon={faArrowLeft} />
									</CButton>
								</>
							)} */}
						{/* </h1> */}
					</div>
					<div className="bankgrid">
						{' '}
						{Array(Math.min(MAX_ROWS, rows))
							.fill(0)
							.map((_, y) => {
								return (
									<CCol key={y} sm={12} className="pagebank-row">
										{Array(Math.min(MAX_COLS, cols))
											.fill(0)
											.map((_2, x) => {
												const index = y * MAX_COLS + x
												return (
													<ButtonPreview
														key={x}
														index={index}
														preview={imageCache[index]}
														onClick={bankClick}
														alt={`Button ${index}`}
														selected={false}
													/>
												)
											})}
									</CCol>
								)
							})}
					</div>
				</MyErrorBoundary>
			</div>
		</CRow>
	)
}
