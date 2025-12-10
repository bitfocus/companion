import React, { useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import type { EmulatorLockedState } from '@companion-app/shared/Model/Common.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { useMutationExt, trpc } from '~/Resources/TRPC.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLock } from '@fortawesome/free-solid-svg-icons'

interface EmulatorLockedPageProps {
	emulatorId: string
	lockedState: EmulatorLockedState
}

export const EmulatorLockedPage = observer(function EmulatorLockedPage({
	emulatorId,
	lockedState,
}: EmulatorLockedPageProps) {
	const pinEntryMutation = useMutationExt(trpc.surfaces.emulatorPinEntry.mutationOptions())

	const handleDigitClick = useCallback(
		(digit: number) => {
			pinEntryMutation.mutate({
				id: emulatorId,
				digit,
			})
		},
		[pinEntryMutation, emulatorId]
	)

	return (
		<MyErrorBoundary>
			<div className="emulator-locked">
				<div className="emulator-locked-content">
					<div className="emulator-locked-header">
						<FontAwesomeIcon icon={faLock} size="3x" />
						<h2>Emulator Locked</h2>
						<div className="emulator-locked-dots">
							{Array.from({ length: lockedState.characterCount }).map((_, i) => (
								<span key={i} className="dot filled" />
							))}
						</div>
					</div>

					<NumericKeypad onDigitClick={handleDigitClick} />
				</div>
			</div>
		</MyErrorBoundary>
	)
})

interface NumericKeypadProps {
	onDigitClick: (digit: number) => void
}

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]

const NumericKeypad = observer(function NumericKeypad({ onDigitClick }: NumericKeypadProps) {
	return (
		<div className="emulator-keypad">
			{digits.map((digit) => (
				<KeypadButton key={digit} digit={digit} onClick={onDigitClick} />
			))}
		</div>
	)
})

interface KeypadButtonProps {
	digit: number
	onClick: (digit: number) => void
}

const KeypadButton = React.memo(function KeypadButton({ digit, onClick }: KeypadButtonProps) {
	const handleClick = useCallback(
		(e: React.MouseEvent | React.TouchEvent) => {
			e.preventDefault()
			e.stopPropagation()
			onClick(digit)
		},
		[onClick, digit]
	)

	const hasPointerEvents = 'onpointerdown' in window

	return (
		<div
			className="keypad-button"
			onPointerDown={hasPointerEvents ? handleClick : undefined}
			onMouseDown={!hasPointerEvents ? handleClick : undefined}
			onTouchStart={!hasPointerEvents ? handleClick : undefined}
			onContextMenu={(e) => {
				e.preventDefault()
				e.stopPropagation()
				return false
			}}
		>
			<div className="keypad-button-content">{digit}</div>
		</div>
	)
})
