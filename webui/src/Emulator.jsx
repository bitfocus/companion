import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, SERVER_URL, useMountEffect } from './util'
import io from 'socket.io-client'
import { CAlert, CCol, CContainer, CRow } from '@coreui/react'
import { nanoid } from 'nanoid'

function dataToButtonImage(data) {
	const sourceData = new Uint8Array(data)
	const imageData = new ImageData(72, 72)

	var si = 0,
		di = 0
	for (var y = 0; y < 72; ++y) {
		for (var x = 0; x < 72; ++x) {
			imageData.data[di++] = sourceData[si++]
			imageData.data[di++] = sourceData[si++]
			imageData.data[di++] = sourceData[si++]
			imageData.data[di++] = 255
		}
	}

	return imageData
}

export function Emulator() {
	const [keymap, setKeymap] = useState(null)
	const [loadError, setLoadError] = useState(null)

	const [ref, setRef] = useState(null)

	// A persistent object that doesnt trigger a render
	const imageCache = useMemo(() => ({}), [])

	const socket = useMemo(() => new io(SERVER_URL), [])

	const [retryToken, setRetryToken] = useState(nanoid())
	const doRetryLoad = useCallback(() => setRetryToken(nanoid()), [])
	useEffect(() => {
		setLoadError(null)
		setKeymap(null)

		socket.emit('emul_startup')

		const updateKeymap = (additionalControllers) => {
			setLoadError(null)
			if (additionalControllers) {
				setKeymap({ ...keyboardKeymap, ...logitecKeymap, ...dsanMastercueKeymap })
			} else {
				setKeymap(keyboardKeymap)
			}
		}

		socket.on('emul_controlkeys', updateKeymap)

		return () => {
			socket.off('emul_controlkeys', updateKeymap)
		}
	}, [retryToken, socket])

	useEffect(() => {
		const updateImage = (keyIndex, data) => {
			if (data) {
				imageCache[keyIndex] = dataToButtonImage(data)
			} else {
				delete imageCache[keyIndex]
			}

			const position = canvasButtonPositions[keyIndex]
			if (position && ref) {
				const ctx = ref.getContext('2d')

				if (imageCache[keyIndex]) {
					ctx.putImageData(imageCache[keyIndex], position[0], position[1])
				} else {
					ctx.fillStyle = 'black'
					ctx.fillRect(position[0], position[1], 72, 72)
				}
			}
		}

		socket.on('emul_fillImage', updateImage)
		socket.on('emul_clearKey', updateImage)

		return () => {
			socket.off('emul_fillImage', updateImage)
			socket.off('emul_clearKey', updateImage)
		}
	}, [socket, ref, imageCache])

	useEffect(() => {
		if (keymap === null) {
			// timeout on load data
			setTimeout(() => {
				if (!keymap) {
					setLoadError('Initialisation timed out')
				}
			}, 5000)
		}
	}, [keymap])

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

	// Register mousedown handler
	useEffect(() => {
		if (ref) {
			const onMouseDown = (e) => {
				for (const key in canvasButtonPositions) {
					if (
						e.offsetX > canvasButtonPositions[key][0] &&
						e.offsetX < canvasButtonPositions[key][0] + 72 &&
						e.offsetY > canvasButtonPositions[key][1] &&
						e.offsetY < canvasButtonPositions[key][1] + 72
					) {
						e.preventDefault()
						setKeyDown(key)
					}
				}
			}
			ref.addEventListener('mousedown', onMouseDown)

			return () => {
				ref.removeEventListener('mousedown', onMouseDown)
			}
		}
	}, [ref])

	// Register key handlers
	useEffect(() => {
		const onKeyDown = (e) => {
			if (keymap[e.keyCode] !== undefined) {
				socket.emit('emulator:press', keymap[e.keyCode])
				console.log('emulator:press', keymap[e.keyCode])
			}
		}

		const onKeyUp = (e) => {
			if (keymap[e.keyCode] !== undefined) {
				socket.emit('emulator:release', keymap[e.keyCode])
				console.log('emulator:release', keymap[e.keyCode])
			}
		}

		document.addEventListener('keydown', onKeyDown)
		document.addEventListener('keyup', onKeyUp)

		return () => {
			document.removeEventListener('keydown', onKeyDown)
			document.removeEventListener('keyup', onKeyUp)
		}
	}, [socket, keymap])

	useEffect(() => {
		// handle changes to keyDown, as it isnt safe to do inside setState
		if (keyDown) {
			socket.emit('emulator:press', keyDown)
			console.log('emulator:press', keyDown)

			return () => {
				socket.emit('emulator:release', keyDown)
				console.log('emulator:release', keyDown)
			}
		}
	}, [socket, keyDown])

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

	const onRefChange = useCallback(
		(node) => {
			// ref value changed to node
			setRef(node)
			if (node) {
				const bg = new Image()
				bg.src = '/img/streamdeck.png'
				bg.onload = () => {
					const ctx = node.getContext('2d')
					ctx.drawImage(bg, 0, 0)

					// Redraw icons to fresh canvas
					for (const [keyIndex, data] of Object.entries(imageCache)) {
						const position = canvasButtonPositions[keyIndex]
						ctx.putImageData(data, position[0], position[1])
					}
				}
			}
		},
		[imageCache]
	)

	return (
		<div className="page-emulator">
			<CContainer fluid>
				<CRow>
					{keymap ? (
						<CCol xs={12}>
							<canvas ref={onRefChange} width={956} height={600}></canvas>

							<CAlert color="info" closeButton>
								Use <b>1 2 3 4 5 6 7 8</b>, <b>Q W E R T Y U I</b>, <b>A S D F G H J K</b> <b>Z X C V B N M ,</b> to
								control this surface with your keyboard!
								<br />
								A Logitech R400/Mastercue/DSan will send a button press to button; 2 (Back), 3 (forward), 4 (black) and
								for logitec: 10/11 (Start and stop) on each page.
								<br />
								You need to enable these extra options in the Settings tab first!
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

const canvasButtonPositions = {
	0: [72, 102],
	1: [176, 102],
	2: [281, 102],
	3: [385, 102],
	4: [488, 102],
	5: [593, 102],
	6: [697, 102],
	7: [801, 102],
	8: [72, 204],
	9: [176, 204],
	10: [281, 204],
	11: [385, 204],
	12: [488, 204],
	13: [593, 204],
	14: [697, 204],
	15: [801, 204],
	16: [72, 308],
	17: [176, 308],
	18: [281, 308],
	19: [385, 308],
	20: [488, 308],
	21: [593, 308],
	22: [697, 308],
	23: [801, 308],
	24: [72, 409],
	25: [176, 409],
	26: [281, 409],
	27: [385, 409],
	28: [488, 409],
	29: [593, 409],
	30: [697, 409],
	31: [801, 409],
}

// Added last row for logitec controllers (PageUp, PageDown, F5, Escape, .)
const keyboardKeymap = {
	49: '0',
	50: '1',
	51: '2',
	52: '3',
	53: '4',
	54: '5',
	55: '6',
	56: '7',
	81: '8',
	87: '9',
	69: '10',
	82: '11',
	84: '12',
	89: '13',
	85: '14',
	73: '15',
	65: '16',
	83: '17',
	68: '18',
	70: '19',
	71: '20',
	72: '21',
	74: '22',
	75: '23',
	90: '24',
	88: '25',
	67: '26',
	86: '27',
	66: '28',
	78: '29',
	77: '30',
	188: '31',
}

const logitecKeymap = {
	33: '1',
	34: '2',
	190: '3',
	116: '9',
	27: '10',
}

const dsanMastercueKeymap = {
	37: '1',
	39: '2',
	66: '3',
}
