import { CButton, CCol } from '@coreui/react'
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowsLeftRight, faArrowsAlt, faCompass, faCopy, faEraser, faTrash } from '@fortawesome/free-solid-svg-icons'
import classnames from 'classnames'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { useResizeObserver } from 'usehooks-ts'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export interface ButtonGridActionsRef {
	buttonClick: (location: ControlLocation, isDown: boolean) => void
}
interface ButtonGridActionsProps {
	isHot: boolean
	pageNumber: number
	clearSelectedButton: () => void
}

export const ButtonGridActions = forwardRef<ButtonGridActionsRef, ButtonGridActionsProps>(function ButtonGridActions(
	{ isHot, pageNumber, clearSelectedButton },
	ref
) {
	const resetRef = useRef<GenericConfirmModalRef>(null)

	const [activeFunction, setActiveFunction] = useState<string | null>(null)
	const [activeFunctionButton, setActiveFunctionButton] = useState<ControlLocation | null>(null)

	let hintText = ''
	if (activeFunction) {
		if (!activeFunctionButton) {
			hintText = `Press the button you want to ${activeFunction}`
		} else {
			hintText = `Where do you want it?`
		}
	}

	const startFunction = useCallback(
		(func: string) => {
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

	const setSizeRef = useRef(null)
	const holderSize = useResizeObserver({ ref: setSizeRef })
	const useCompactButtons = (holderSize.width ?? 0) < 650 // Cutoff for what of the action buttons fit in their large mode

	const getButton = (label: string, icon: IconProp, func: string) => {
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

	const clearPageMutation = useMutationExt(trpc.pages.clearPage.mutationOptions())
	const recreateNavMutation = useMutationExt(trpc.pages.recreateNav.mutationOptions())

	const resetPage = useCallback(() => {
		clearSelectedButton()

		resetRef.current?.show(
			'Reset page',
			`Are you sure you want to clear all buttons on page ${pageNumber}?\nThere's no going back from this.`,
			'Reset',
			() => {
				clearPageMutation
					.mutateAsync({
						pageNumber,
					})
					.catch((e) => {
						console.error(`Clear page failed: ${e}`)
					})
			}
		)
	}, [clearPageMutation, pageNumber, clearSelectedButton])
	const resetPageNav = useCallback(() => {
		clearSelectedButton()

		resetRef.current?.show(
			'Reset page',
			`Are you sure you want to reset navigation buttons? This will completely erase button ${pageNumber}/0/0, ${pageNumber}/1/0 and ${pageNumber}/2/0`,
			'Reset',
			() => {
				recreateNavMutation
					.mutateAsync({
						pageNumber,
					})
					.catch((e) => {
						console.error(`Reset nav failed: ${e}`)
					})
			}
		)
	}, [recreateNavMutation, pageNumber, clearSelectedButton])

	const resetControlMutation = useMutationExt(trpc.controls.resetControl.mutationOptions())
	const copyControlMutation = useMutationExt(trpc.controls.copyControl.mutationOptions())
	const moveControlMutation = useMutationExt(trpc.controls.moveControl.mutationOptions())
	const swapControlMutation = useMutationExt(trpc.controls.swapControl.mutationOptions())

	useImperativeHandle(
		ref,
		() => ({
			buttonClick(location, isDown) {
				if (isDown) {
					switch (activeFunction) {
						case 'delete':
							resetRef.current?.show('Clear button', `Clear style and actions for this button?`, 'Clear', () => {
								resetControlMutation.mutateAsync({ location }).catch((e) => {
									console.error(`Reset failed: ${e}`)
								})
							})

							stopFunction()
							return true
						case 'copy':
							if (activeFunctionButton) {
								const fromInfo = activeFunctionButton
								copyControlMutation.mutateAsync({ fromLocation: fromInfo, toLocation: location }).catch((e) => {
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
								moveControlMutation.mutateAsync({ fromLocation: fromInfo, toLocation: location }).catch((e) => {
									console.error(`move failed: ${e}`)
								})
								stopFunction()
							} else {
								setActiveFunctionButton(location)
							}
							return true
						case 'swap':
							if (activeFunctionButton) {
								const fromInfo = activeFunctionButton
								swapControlMutation.mutateAsync({ fromLocation: fromInfo, toLocation: location }).catch((e) => {
									console.error(`swap failed: ${e}`)
								})
								stopFunction()
							} else {
								setActiveFunctionButton(location)
							}
							return true
						default:
							// show button edit page
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
		[
			resetControlMutation,
			copyControlMutation,
			moveControlMutation,
			swapControlMutation,
			activeFunction,
			activeFunctionButton,
			stopFunction,
		]
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
						{getButton('Swap', faArrowsLeftRight, 'swap')}
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
