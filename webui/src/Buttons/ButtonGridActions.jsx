import { CButton, CCol } from '@coreui/react'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useRef, useState } from 'react'
import { socketEmitPromise, SocketContext } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsAlt, faCompass, faCopy, faEraser, faTrash } from '@fortawesome/free-solid-svg-icons'
import classnames from 'classnames'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { useElementSize } from 'usehooks-ts'

export const ButtonGridActions = forwardRef(function ButtonGridActions(
	{ isHot, pageNumber, clearSelectedButton },
	ref
) {
	const socket = useContext(SocketContext)

	const resetRef = useRef()

	const [activeFunction, setActiveFunction] = useState(null)
	const [activeFunctionButton, setActiveFunctionButton] = useState(null)

	let hintText = ''
	if (activeFunction) {
		if (!activeFunctionButton) {
			hintText = `Press the button you want to ${activeFunction}`
		} else {
			hintText = `Where do you want it?`
		}
	}

	const startFunction = useCallback(
		(func) => {
			setActiveFunction((oldFunction) => {
				if (oldFunction === null) {
					setActiveFunctionButton(null)
					clearSelectedButton()
					return func
				} else {
					return oldFunction
				}
			})
		},
		[clearSelectedButton]
	)
	const stopFunction = useCallback(() => {
		setActiveFunction(null)
		setActiveFunctionButton(null)
	}, [])

	const [setSizeRef, holderSize] = useElementSize()
	const useCompactButtons = holderSize.width < 600 // Cutoff for what of the action buttons fit in their large mode

	const getButton = (label, icon, func) => {
		let color = 'light'
		let disabled = false
		if (activeFunction === func) {
			color = 'success'
		} else if (activeFunction) {
			disabled = true
		}

		return (
			!disabled && (
				<CButton color={color} disabled={disabled} onClick={() => startFunction(func)} title={label}>
					<FontAwesomeIcon icon={icon} /> {useCompactButtons ? '' : label}
				</CButton>
			)
		)
	}

	const resetPage = useCallback(() => {
		clearSelectedButton()

		resetRef.current.show(
			'Reset page',
			`Are you sure you want to clear all buttons on page ${pageNumber}?\nThere's no going back from this.`,
			'Reset',
			() => {
				socketEmitPromise(socket, 'loadsave:reset-page-clear', [pageNumber]).catch((e) => {
					console.error(`Clear page failed: ${e}`)
				})
			}
		)
	}, [socket, pageNumber, clearSelectedButton])
	const resetPageNav = useCallback(() => {
		clearSelectedButton()

		resetRef.current.show(
			'Reset page',
			`Are you sure you want to reset navigation buttons? This will completely erase button ${pageNumber}.1, ${pageNumber}.9 and ${pageNumber}.17`,
			'Reset',
			() => {
				socketEmitPromise(socket, 'loadsave:reset-page-nav', [pageNumber]).catch((e) => {
					console.error(`Reset nav failed: ${e}`)
				})
			}
		)
	}, [socket, pageNumber, clearSelectedButton])

	useImperativeHandle(
		ref,
		() => ({
			bankClick(location, isDown) {
				if (isDown) {
					switch (activeFunction) {
						case 'delete':
							resetRef.current.show('Clear bank', `Clear style and actions for this button?`, 'Clear', () => {
								socketEmitPromise(socket, 'controls:reset', [location]).catch((e) => {
									console.error(`Reset failed: ${e}`)
								})
							})

							stopFunction()
							return true
						case 'copy':
							if (activeFunctionButton) {
								const fromInfo = activeFunctionButton
								socketEmitPromise(socket, 'controls:copy', [fromInfo, location]).catch((e) => {
									console.error(`copy failed: ${e}`)
								})
								stopFunction()
							} else {
								setActiveFunctionButton(location)
							}
							return true
						case 'move':
							if (activeFunctionButton) {
								const fromInfo = activeFunctionButton
								socketEmitPromise(socket, 'controls:move', [fromInfo, location]).catch((e) => {
									console.error(`move failed: ${e}`)
								})
								stopFunction()
							} else {
								setActiveFunctionButton(location)
							}
							return true
						default:
							// show bank edit page
							return false
					}
				} else {
					if (activeFunction) {
						return true
					} else {
						return false
					}
				}
			},
		}),
		[socket, activeFunction, activeFunctionButton, pageNumber, stopFunction]
	)

	return (
		<>
			<GenericConfirmModal ref={resetRef} />

			<CCol sm={12} className={classnames({ out: isHot, fadeinout: true })}>
				<div className="button-grid-controls" ref={setSizeRef}>
					<div>
						{getButton('Copy', faCopy, 'copy')}
						&nbsp;
						{getButton('Move', faArrowsAlt, 'move')}
						&nbsp;
						{getButton('Delete', faTrash, 'delete')}
						&nbsp;
					</div>
					<div style={{ display: activeFunction ? '' : 'none' }}>
						<CButton color="danger" onClick={() => stopFunction()} title="Cancel">
							Cancel
						</CButton>
						&nbsp;
						<CButton color="disabled">{hintText}</CButton>
					</div>
					<div style={{ display: activeFunction ? 'none' : undefined }} title="Reset page buttons">
						<CButton color="light" onClick={() => resetPageNav()}>
							<FontAwesomeIcon icon={faCompass} /> {useCompactButtons ? '' : 'Reset page buttons'}
						</CButton>
						&nbsp;
						<CButton color="light" onClick={() => resetPage()} title="Wipe page">
							<FontAwesomeIcon icon={faEraser} /> {useCompactButtons ? '' : 'Wipe page'}
						</CButton>
					</div>
				</div>
			</CCol>
		</>
	)
})
