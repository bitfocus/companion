import { useCallback, useEffect, useMemo, useState, useContext } from 'react'
import {
	LoadingRetryOrError,
	myApplyPatch2,
	MyErrorBoundary,
	SocketContext,
	socketEmit2,
	useMountEffect,
} from '../util'
import { CAlert, CCol, CContainer, CRow } from '@coreui/react'
import { nanoid } from 'nanoid'
import { useParams } from 'react-router-dom'
import { dsanMastercueKeymap, keyboardKeymap, logitecKeymap } from './Keymaps'
import { BankPreview, dataToButtonImage } from '../Components/BankButton'
import { MAX_COLS, MAX_ROWS } from '../Constants'

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

		socketEmit2(socket, 'emulator:startup', [emulatorId])
			.then((config) => {
				setConfig(config)
			})
			.catch((e) => {
				console.error('Emulator error', e)
				setLoadError(`Failed: ${e}`)
			})

		const updateConfig = (patch) => {
			setConfig((oldConfig) => myApplyPatch2(oldConfig, patch))
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
		const updateImage = (keyIndex, data) => {
			setImageCache((old) => {
				return {
					...old,
					[keyIndex]: data ? dataToButtonImage(data) : undefined,
				}
			})
		}

		socket.on('emulator:image', updateImage)

		return () => {
			socket.off('emulator:image', updateImage)
		}
	}, [socket, imageCache])

	useMountEffect(() => {
		const onConnect = () => {
			setRetryToken(nanoid())
		}
		socket.on('connect', onConnect)
		return () => {
			socket.off('connect', onConnect)
		}
	})

	const [keyDown, setKeyDown] = useState(null)

	// Register key handlers
	useEffect(() => {
		const onKeyDown = (e) => {
			if (keymap[e.keyCode] !== undefined) {
				socketEmit2(socket, 'emulator:press', [emulatorId, keymap[e.keyCode]]).catch((e) => {
					console.error('press failed', e)
				})
				console.log('emulator:press', emulatorId, keymap[e.keyCode])
			}
		}

		const onKeyUp = (e) => {
			if (keymap[e.keyCode] !== undefined) {
				socketEmit2(socket, 'emulator:release', [emulatorId, keymap[e.keyCode]]).catch((e) => {
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
			socketEmit2(socket, 'emulator:press', [emulatorId, keyDown]).catch((e) => {
				console.error('press failed', e)
			})
			console.log('emulator:press', emulatorId, keyDown)

			return () => {
				socketEmit2(socket, 'emulator:release', [emulatorId, keyDown]).catch((e) => {
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
				<CRow>
					{config ? (
						<CCol xs={12}>
							<CyclePages emulatorId={emulatorId} imageCache={imageCache} />

							<CAlert color="info" closeButton>
								Use <b>1 2 3 4 5 6 7 8</b>, <b>Q W E R T Y U I</b>, <b>A S D F G H J K</b>, <b>Z X C V B N M ,</b> to
								control this surface with your keyboard!
								<br />
								{config.emulator_control_enable ? (
									<>
										A Logitech R400/Mastercue/DSan will send a button press to button; 2 (Back), 3 (forward), 4 (black)
										and for logitech: 10/11 (Start and stop) on each page.
									</>
								) : (
									<>You can enable support for some controllers in the Surface Settings!</>
								)}
							</CAlert>
						</CCol>
					) : (
						<LoadingRetryOrError dataReady={false} error={loadError} doRetry={doRetryLoad} />
					)}
				</CRow>
			</CContainer>
		</div>
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
			// if (goNextPage && pressed && pageInfo && pageInfo.pageup && pageInfo.pageup.includes(bank)) {
			// 	goNextPage()
			// } else if (goPrevPage && pressed && pageInfo && pageInfo.pagedown && pageInfo.pagedown.includes(bank)) {
			// 	goPrevPage()
			// } else if (goFirstPage && pressed && pageInfo && pageInfo.pagenum && pageInfo.pagenum.includes(bank)) {
			// 	goFirstPage()
			// } else {
			// 	const controlId = CreateBankControlId(number, bank)
			// 	socketEmit2(socket, 'controls:hot-press', [controlId, pressed]).catch((e) =>
			// 		console.error(`Hot press failed: ${e}`)
			// 	)
			// }
			socketEmit2(socket, command, [emulatorId, bank]).catch((e) => {
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

						{/* {orderedPages.length > 1 ? (
								<>
									<CButton onClick={goNextPage} disabled={!loop && currentIndex === orderedPages.length - 1} size="lg">
										<FontAwesomeIcon icon={faArrowRight} />
									</CButton>
									<CButton onClick={goPrevPage} disabled={!loop && currentIndex === 0} size="lg">
										<FontAwesomeIcon icon={faArrowLeft} />
									</CButton>
								</>
							) : (
								''
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
													<BankPreview
														key={x}
														index={index}
														preview={imageCache[index]}
														onClick={bankClick}
														alt={`Bank ${index}`}
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
