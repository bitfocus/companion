import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import { faArrowsAlt, faArrowsLeftRight, faCompass, faCopy, faEraser, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classnames from 'classnames'
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useResizeObserver } from 'usehooks-ts'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button, type ButtonColor } from '~/Components/Button'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { Modal } from '~/Components/Modal.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { queryClient, trpc, useMutationExt, type RouterOutput } from '~/Resources/TRPC'

export interface ButtonGridActionsRef {
	buttonClick: (location: ControlLocation, isDown: boolean) => void
}
interface ButtonGridActionsProps {
	isHot: boolean
	pageNumber: number
	clearSelectedButton: () => void
}

type ControlIncrementOption = RouterOutput['controls']['getControlIncrementOptions'][number]

export const ButtonGridActions = forwardRef<ButtonGridActionsRef, ButtonGridActionsProps>(function ButtonGridActions(
	{ isHot, pageNumber, clearSelectedButton },
	ref
) {
	const resetRef = useRef<GenericConfirmModalRef>(null)

	const [activeFunction, setActiveFunction] = useState<string | null>(null)
	const [activeFunctionButton, setActiveFunctionButton] = useState<ControlLocation | null>(null)

	const [copyIncrementModalOpen, setCopyIncrementModalOpen] = useState(false)
	const [copyIncrementLoading, setCopyIncrementLoading] = useState(false)
	const [copyIncrementLoadError, setCopyIncrementLoadError] = useState<string | null>(null)
	const [copyIncrementFields, setCopyIncrementFields] = useState<ControlIncrementOption[]>([])
	const [copyIncrementSelectedFieldIds, setCopyIncrementSelectedFieldIds] = useState<string[]>([])
	const [copyIncrementStep, setCopyIncrementStep] = useState(1)
	const [copyIncrementPasteIndex, setCopyIncrementPasteIndex] = useState(1)
	const [copyIncrementSettingsReady, setCopyIncrementSettingsReady] = useState(false)
	const copyIncrementLoadRequestIdRef = useRef(0)

	let hintText = ''
	if (activeFunction) {
		if (activeFunction === 'copy-increment') {
			if (!activeFunctionButton) {
				hintText = 'Press the source button for Copy +N'
			} else if (!copyIncrementSettingsReady) {
				hintText = 'Choose which values to increment'
			} else {
				hintText = `Paste with ${copyIncrementPasteIndex * copyIncrementStep >= 0 ? '+' : ''}${
					copyIncrementPasteIndex * copyIncrementStep
				}: press a target button`
			}
		} else if (!activeFunctionButton) {
			hintText = `Press the button you want to ${activeFunction}`
		} else {
			hintText = `Where do you want it?`
		}
	}

	const resetCopyIncrementState = useCallback(() => {
		copyIncrementLoadRequestIdRef.current += 1
		setCopyIncrementModalOpen(false)
		setCopyIncrementLoading(false)
		setCopyIncrementLoadError(null)
		setCopyIncrementFields([])
		setCopyIncrementSelectedFieldIds([])
		setCopyIncrementStep(1)
		setCopyIncrementPasteIndex(1)
		setCopyIncrementSettingsReady(false)
	}, [])

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
		resetCopyIncrementState()
	}, [resetCopyIncrementState])

	const prepareCopyIncrementSource = useCallback((location: ControlLocation) => {
		const requestId = ++copyIncrementLoadRequestIdRef.current

		setActiveFunctionButton(location)
		setCopyIncrementModalOpen(true)
		setCopyIncrementLoading(true)
		setCopyIncrementLoadError(null)
		setCopyIncrementFields([])
		setCopyIncrementSelectedFieldIds([])
		setCopyIncrementStep(1)
		setCopyIncrementPasteIndex(1)
		setCopyIncrementSettingsReady(false)

		queryClient
			.fetchQuery(trpc.controls.getControlIncrementOptions.queryOptions({ location }))
			.then((fields) => {
				if (copyIncrementLoadRequestIdRef.current !== requestId) return

				setCopyIncrementFields(fields)
				setCopyIncrementSelectedFieldIds([])
			})
			.catch((e) => {
				if (copyIncrementLoadRequestIdRef.current !== requestId) return

				setCopyIncrementLoadError(String(e))
			})
			.finally(() => {
				if (copyIncrementLoadRequestIdRef.current !== requestId) return

				setCopyIncrementLoading(false)
			})
	}, [])

	const applyCopyIncrementSettings = useCallback(() => {
		setCopyIncrementSettingsReady(true)
		setCopyIncrementPasteIndex(1)
		setCopyIncrementModalOpen(false)
	}, [])

	const setCopyIncrementFieldSelected = useCallback((fieldId: string, selected: boolean) => {
		setCopyIncrementSelectedFieldIds((oldIds) => {
			if (selected) return oldIds.includes(fieldId) ? oldIds : [...oldIds, fieldId]
			return oldIds.filter((id) => id !== fieldId)
		})
	}, [])

	const setSizeRef = useRef(null)
	const holderSize = useResizeObserver({ ref: setSizeRef })
	const useCompactButtons = (holderSize.width ?? 0) < 670 // Cutoff for what of the action buttons fit in their large mode

	const getButton = (label: string, icon: IconProp, func: string) => {
		let color: ButtonColor = 'light'
		let disabled = false
		if (activeFunction === func) {
			color = 'success'
		} else if (activeFunction) {
			disabled = true
		}

		return (
			!disabled && (
				<Button color={color} disabled={disabled} onClick={() => startFunction(func)} title={label}>
					<FontAwesomeIcon icon={icon} /> {useCompactButtons ? '' : label}
				</Button>
			)
		)
	}

	const getCopyIncrementButton = () => {
		let color: ButtonColor = 'light'
		let disabled = false
		if (activeFunction === 'copy-increment') {
			color = 'success'
		} else if (activeFunction) {
			disabled = true
		}

		return (
			!disabled && (
				<Button color={color} disabled={disabled} onClick={() => startFunction('copy-increment')} title="Copy +1">
					<span className="button-grid-copy-increment-icon">
						<FontAwesomeIcon icon={faCopy} />
						<span className="button-grid-copy-increment-icon-badge">+1</span>
					</span>
				</Button>
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
	const copyControlWithOffsetMutation = useMutationExt(trpc.controls.copyControlWithOffset.mutationOptions())
	const moveControlMutation = useMutationExt(trpc.controls.moveControl.mutationOptions())
	const swapControlMutation = useMutationExt(trpc.controls.swapControl.mutationOptions())

	useImperativeHandle(
		ref,
		() => ({
			buttonClick(location, isDown) {
				if (isDown) {
					switch (activeFunction) {
						case 'delete':
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
						case 'copy-increment':
							if (activeFunctionButton) {
								if (copyIncrementSettingsReady) {
									const fromInfo = activeFunctionButton
									copyControlWithOffsetMutation
										.mutateAsync({
											fromLocation: fromInfo,
											toLocation: location,
											incrementFieldIds: copyIncrementSelectedFieldIds,
											incrementBy: copyIncrementPasteIndex * copyIncrementStep,
										})
										.then((copied) => {
											if (copied) setCopyIncrementPasteIndex((oldIndex) => oldIndex + 1)
										})
										.catch((e) => {
											console.error(`copy +N failed: ${e}`)
										})
								}
							} else {
								prepareCopyIncrementSource(location)
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
					if (activeFunction === 'delete') {
						resetRef.current?.show('Clear button', `Clear style and actions for this button?`, 'Clear', () => {
							resetControlMutation.mutateAsync({ location }).catch((e) => {
								console.error(`Reset failed: ${e}`)
							})
						})
						stopFunction()
						return true
					} else if (activeFunction) {
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
			copyControlWithOffsetMutation,
			copyIncrementSettingsReady,
			copyIncrementSelectedFieldIds,
			copyIncrementPasteIndex,
			copyIncrementStep,
			prepareCopyIncrementSource,
		]
	)

	return (
		<>
			<GenericConfirmModal ref={resetRef} />
			<CopyIncrementSettingsModal
				open={copyIncrementModalOpen}
				loading={copyIncrementLoading}
				error={copyIncrementLoadError}
				fields={copyIncrementFields}
				selectedFieldIds={copyIncrementSelectedFieldIds}
				step={copyIncrementStep}
				onStepChange={setCopyIncrementStep}
				onFieldSelected={setCopyIncrementFieldSelected}
				onSelectAll={() => setCopyIncrementSelectedFieldIds(copyIncrementFields.map((field) => field.id))}
				onSelectNone={() => setCopyIncrementSelectedFieldIds([])}
				onCancel={stopFunction}
				onApply={applyCopyIncrementSettings}
			/>

			<Grid.Col sm={12} className={classnames({ out: isHot, fadeinout: true })}>
				<div className="button-grid-controls" ref={setSizeRef}>
					<div>
						{getButton('Copy', faCopy, 'copy')}
						&nbsp;
						{getCopyIncrementButton()}
						&nbsp;
						{getButton('Move', faArrowsAlt, 'move')}
						&nbsp;
						{getButton('Swap', faArrowsLeftRight, 'swap')}
						&nbsp;
						{getButton('Delete', faTrash, 'delete')}
						&nbsp;
					</div>
					<div style={{ display: activeFunction ? '' : 'none' }}>
						<Button color="danger" onClick={() => stopFunction()} title="Cancel">
							Cancel
						</Button>
						&nbsp;
						<Button color="disabled">{hintText}</Button>
					</div>
					<div style={{ display: activeFunction ? 'none' : undefined }} title="Reset page buttons">
						<Button color="light" onClick={() => resetPageNav()}>
							<FontAwesomeIcon icon={faCompass} /> {useCompactButtons ? '' : 'Reset page buttons'}
						</Button>
						&nbsp;
						<Button color="light" onClick={() => resetPage()} title="Wipe page">
							<FontAwesomeIcon icon={faEraser} /> {useCompactButtons ? '' : 'Wipe page'}
						</Button>
					</div>
				</div>
			</Grid.Col>
		</>
	)
})

interface CopyIncrementSettingsModalProps {
	open: boolean
	loading: boolean
	error: string | null
	fields: ControlIncrementOption[]
	selectedFieldIds: string[]
	step: number
	onStepChange: (value: number) => void
	onFieldSelected: (fieldId: string, selected: boolean) => void
	onSelectAll: () => void
	onSelectNone: () => void
	onCancel: () => void
	onApply: () => void
}

function CopyIncrementSettingsModal({
	open,
	loading,
	error,
	fields,
	selectedFieldIds,
	step,
	onStepChange,
	onFieldSelected,
	onSelectAll,
	onSelectNone,
	onCancel,
	onApply,
}: CopyIncrementSettingsModalProps): JSX.Element {
	const selectedFieldIdSet = useMemo(() => new Set(selectedFieldIds), [selectedFieldIds])
	const stepIsValid = Number.isInteger(step) && step >= -999 && step <= 999

	return (
		<Modal.Root open={open} disableDismiss>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable>
						<Modal.Header>
							<Modal.Title>Copy +N</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<div className="button-grid-copy-increment-settings">
								<label className="form-label" htmlFor="copy-increment-step">
									Increase step size
								</label>
								<NumberInputField
									id="copy-increment-step"
									value={step}
									setValue={onStepChange}
									min={-999}
									max={999}
									step={1}
									immediateValue
									checkValid={stepIsValid}
									disabled={loading}
								/>

								<div className="button-grid-copy-increment-toolbar">
									<Button color="secondary" size="sm" onClick={onSelectAll} disabled={loading || fields.length === 0}>
										Select all
									</Button>
									<Button color="secondary" size="sm" onClick={onSelectNone} disabled={loading || fields.length === 0}>
										Select none
									</Button>
								</div>

								{loading && <p>Loading values...</p>}
								{error && <p className="text-danger">{error}</p>}
								{!loading && !error && fields.length === 0 && <p>No numeric values were found on this button.</p>}
								{!loading && !error && fields.length > 0 && (
									<div className="button-grid-copy-increment-fields">
										{fields.map((field) => (
											<CheckboxInputFieldWithLabel
												key={field.id}
												value={selectedFieldIdSet.has(field.id)}
												setValue={(selected) => onFieldSelected(field.id, selected)}
												disabled={loading}
												label={
													<span>
														<span className="button-grid-copy-increment-field-label">{field.label}</span>
														<span className="button-grid-copy-increment-field-value">{field.currentValue}</span>
													</span>
												}
											/>
										))}
									</div>
								)}
							</div>
						</Modal.Body>
						<Modal.Footer>
							<Button color="secondary" onClick={onCancel}>
								Cancel
							</Button>
							<Button color="primary" onClick={onApply} disabled={loading || !!error || !stepIsValid}>
								Use Copy +N
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
}
