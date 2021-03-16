import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoadingRetryOrError, SERVER_URL, useMountEffect } from './util'
import io from 'socket.io-client'
import { CAlert, CCol, CContainer, CRow } from '@coreui/react'
import shortid from 'shortid'

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

	const [retryToken, setRetryToken] = useState(shortid())
	const doRetryLoad = useCallback(() => setRetryToken(shortid()), [])
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
			setRetryToken(shortid())
		}
		socket.on('connect', onConnect)
		return () => {
			socket.off('connect', onConnect)
		}
	})

	const [wasDown, setWasDown] = useState(null)

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
						socket.emit('emul_down', key)
						setWasDown(key)
					}
				}
			}
			ref.addEventListener('mousedown', onMouseDown)

			return () => {
				ref.removeEventListener('mousedown', onMouseDown)
			}
		}
	}, [ref, socket])

	// Register key handlers
	useEffect(() => {
		const onKeyDown = (e) => {
			if (keymap[e.keyCode] !== undefined) {
				socket.emit('emul_down', keymap[e.keyCode])
			}
		}

		const onKeyUp = (e) => {
			if (keymap[e.keyCode] !== undefined) {
				socket.emit('emul_up', keymap[e.keyCode])
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
		const onMouseUp = (e) => {
			if (wasDown !== null) {
				socket.emit('emul_up', wasDown)
				console.log('wasDown', wasDown)
			}
		}

		document.body.addEventListener('mouseup', onMouseUp)

		return () => {
			document.body.removeEventListener('mouseup', onMouseUp)
		}
	}, [socket, wasDown])

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
								A logitec R400/Mastercue/dSan will send a button press to button; 2 (Back), 3 (forward), 4 (black) and
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
	0: [801, 102],
	1: [697, 102],
	2: [593, 102],
	3: [488, 102],
	4: [385, 102],
	5: [281, 102],
	6: [176, 102],
	7: [72, 102],
	8: [801, 204],
	9: [697, 204],
	10: [593, 204],
	11: [488, 204],
	12: [385, 204],
	13: [281, 204],
	14: [176, 204],
	15: [72, 204],
	16: [801, 308],
	17: [697, 308],
	18: [593, 308],
	19: [488, 308],
	20: [385, 308],
	21: [281, 308],
	22: [176, 308],
	23: [72, 308],
	24: [801, 409],
	25: [697, 409],
	26: [593, 409],
	27: [488, 409],
	28: [385, 409],
	29: [281, 409],
	30: [176, 409],
	31: [72, 409],
}

// Added last row for logitec controllers (PageUp, PageDown, F5, Escape, .)
const keyboardKeymap = {
	49: '7',
	50: '6',
	51: '5',
	52: '4',
	53: '3',
	54: '2',
	55: '1',
	56: '0',
	81: '15',
	87: '14',
	69: '13',
	82: '12',
	84: '11',
	89: '10',
	85: '9',
	73: '8',
	65: '23',
	83: '22',
	68: '21',
	70: '20',
	71: '19',
	72: '18',
	74: '17',
	75: '16',
	90: '31',
	88: '30',
	67: '29',
	86: '28',
	66: '27',
	78: '26',
	77: '25',
	188: '24',
}

const logitecKeymap = {
	33: '6',
	34: '5',
	190: '4',
	116: '14',
	27: '13',
}

const dsanMastercueKeymap = {
	37: '6',
	39: '5',
	66: '4',
}
