import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import cssStyles from './EditableInput.module.css'
import type { OnChangeFn } from '../context/useColor'
import { ClickAndDragDiv } from './ClickAndDragDiv'

const DEFAULT_ARROW_OFFSET = 1

const UP_KEY_CODE = 38
const DOWN_KEY_CODE = 40
const VALID_KEY_CODES = [UP_KEY_CODE, DOWN_KEY_CODE]
const isValidKeyCode = (keyCode: number) => VALID_KEY_CODES.indexOf(keyCode) > -1
const getNumberValue = (value: string | number) => Number(String(value).replace(/%/g, ''))

export interface EditableInputProps {
	label: string
	value: string | number
	placeholder?: string
	dragLabel?: boolean
	dragMax?: number
	onChange: OnChangeFn<string | number>
}

export function EditableInput({
	label,
	value,
	placeholder,
	dragLabel,
	dragMax,
	onChange,
}: EditableInputProps): React.JSX.Element {
	const inputId = useMemo(() => `rc-editable-input-${nanoid()}`, [])
	const inputRef = useRef<HTMLInputElement>(null)

	const [tmpValue, setTmpValue] = useState<string | null>(null)

	const handleBlur = useCallback(() => setTmpValue(null), [])

	const setUpdatedValue = useCallback(
		(value: string | number, e: React.SyntheticEvent) => {
			onChange(value, e)

			setTmpValue(value + '')
		},
		[onChange]
	)
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setUpdatedValue(e.target.value, e)
		},
		[setUpdatedValue]
	)
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			// In case `e.target.value` is a percentage remove the `%` character
			// and update accordingly with a percentage
			// https://github.com/casesandberg/react-color/issues/383
			const value = getNumberValue(e.currentTarget.value)
			if (!isNaN(value) && isValidKeyCode(e.keyCode)) {
				const offset = DEFAULT_ARROW_OFFSET
				const updatedValue = e.keyCode === UP_KEY_CODE ? value + offset : value - offset

				setUpdatedValue(updatedValue, e)
			}
		},
		[setUpdatedValue]
	)

	const valueRef = useRef<string | number>(value)
	useEffect(() => {
		valueRef.current = value
	}, [value])
	const dragChange = useCallback(
		(e: React.MouseEvent | React.TouchEvent | MouseEvent, _container: HTMLDivElement) => {
			if (!('movementX' in e) || !dragMax) return

			const valueNumber = getNumberValue(valueRef.current)
			const newValue = Math.round(valueNumber + e.movementX)
			if (newValue >= 0 && newValue <= dragMax) {
				onChange(newValue, e)
			}
		},
		[valueRef, onChange, dragMax]
	)

	const labelElement = label ? (
		<label htmlFor={inputId} className={cssStyles.inputLabel}>
			{label}
		</label>
	) : null

	return (
		<div className={cssStyles.inputWrap}>
			<input
				id={inputId}
				className={cssStyles.inputElement}
				ref={inputRef}
				value={tmpValue ?? value}
				onKeyDown={handleKeyDown}
				onChange={handleChange}
				onBlur={handleBlur}
				placeholder={placeholder}
				spellCheck="false"
			/>
			{labelElement ? (
				dragLabel ? (
					<ClickAndDragDiv onChange={dragChange} dragXy>
						{labelElement}
					</ClickAndDragDiv>
				) : (
					labelElement
				)
			) : null}
		</div>
	)
}
