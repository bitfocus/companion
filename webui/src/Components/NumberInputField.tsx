import { NumberField } from '@base-ui/react/number-field'
import './NumberInputField.css'
import { Slider } from '@base-ui/react/slider'
import classNames from 'classnames'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useCallback, useState } from 'react'

interface NumberInputFieldProps {
	id: string | undefined
	min?: number
	max?: number
	step?: number
	tooltip?: string
	range?: boolean
	value: number | null | undefined
	setValue: (value: number) => void
	onBlur?: (e: React.FocusEvent<HTMLElement>) => void
	disabled?: boolean
	// When true, the field can be cleared to the "auto" state (displayed as "auto"), which invokes `onClear`.
	allowNull?: boolean
	// Called when a nullable field is cleared. Only meaningful together with `allowNull`.
	onClear?: () => void
	checkValid?: boolean | ((value: number) => boolean | undefined)
	// When true, show the min value as a visual -∞ when value <= min
	showMinAsNegativeInfinity?: boolean
	// When true, show the max value as a visual ∞ when value >= max
	showMaxAsPositiveInfinity?: boolean
	immediateValue?: boolean
}

export function NumberInputField({
	id,
	min,
	max,
	step,
	tooltip,
	range,
	value,
	setValue,
	onBlur,
	disabled,
	allowNull,
	onClear,
	checkValid,
	showMinAsNegativeInfinity,
	showMaxAsPositiveInfinity,
	immediateValue,
}: NumberInputFieldProps): React.JSX.Element {
	const [tmpValue, setTmpValue] = useState<number | string | null>(null)

	const onChangeValue = useCallback(
		(value: number | null) => {
			if (value === null) {
				// A cleared field. When the field is nullable this is the "auto" state; otherwise ignore it
				// (base-ui reports null for a transiently-empty input mid-edit).
				if (allowNull) {
					setTmpValue(null)
					onClear?.()
				}
				return
			}
			if (!isNaN(value)) {
				if (!immediateValue) setTmpValue(value)
				setValue(value)
			}
		},
		[allowNull, onClear, immediateValue, setValue]
	)

	const handleBlur = useCallback(
		(e: React.FocusEvent<HTMLElement>) => {
			setTmpValue(null)
			onBlur?.(e)
		},
		[onBlur]
	)

	// The value currently in effect (the in-progress edit, else the committed value).
	const rawEffective = (immediateValue ? null : tmpValue) ?? value
	// A nullable ("auto") field stays null when empty so base-ui renders the placeholder; otherwise coerce to a number.
	const controlledValue: number | null = allowNull
		? rawEffective == null
			? null
			: Number(rawEffective)
		: Number(rawEffective ?? 0)
	// Compute whether we should visually show -∞ or ∞.
	const numericEffective = Number(rawEffective ?? 0)
	// Only show infinity overlays when the user has explicitly set a value.
	const hasExplicitValue = (!immediateValue && tmpValue !== null) || value !== undefined
	let showOverlayValue: string | null = null
	if (
		hasExplicitValue &&
		!!showMinAsNegativeInfinity &&
		typeof min !== 'undefined' &&
		!isNaN(numericEffective) &&
		numericEffective <= min
	) {
		showOverlayValue = '-∞'
	} else if (
		hasExplicitValue &&
		!!showMaxAsPositiveInfinity &&
		typeof max !== 'undefined' &&
		!isNaN(numericEffective) &&
		numericEffective >= max
	) {
		showOverlayValue = '∞'
	}

	// checkValid is tri-state: false = invalid, true/undefined = not invalid (undefined means unknown)
	const valueIsInvalid = (typeof checkValid === 'function' ? checkValid(numericEffective) : checkValid) === false

	const input = (
		<NumberField.Root
			id={id}
			disabled={disabled}
			value={controlledValue}
			onValueChange={onChangeValue}
			onBlur={handleBlur}
			min={min}
			max={max}
			step={step ?? 'any'}
			title={tooltip}
			className="number-field"
			format={{ useGrouping: false }}
		>
			<NumberField.Group className="number-field-group">
				<NumberField.Input
					className={classNames('form-input', 'number-field-input', { 'invalid-value': valueIsInvalid })}
					placeholder={allowNull ? 'auto' : undefined}
				/>

				<NumberField.Increment className="number-field-increment">
					<PlusIcon />
				</NumberField.Increment>
				<NumberField.Decrement className="number-field-decrement">
					<MinusIcon />
				</NumberField.Decrement>

				{!!showOverlayValue && (
					<span className={classNames('number-field-inf-overlay', { 'invalid-value': valueIsInvalid })}>
						{showOverlayValue}
					</span>
				)}
			</NumberField.Group>
		</NumberField.Root>
	)

	if (range) {
		return (
			<div className="grid grid-col">
				<div>{input}</div>
				<div>
					<SliderInputField
						disabled={disabled}
						value={numericEffective}
						min={min}
						max={max}
						step={step}
						tooltip={tooltip}
						setValue={onChangeValue}
						onFocus={() => {
							if (!immediateValue) setTmpValue(value ?? '')
						}}
						onValueCommitted={() => setTmpValue(null)}
					/>
				</div>
			</div>
		)
	} else {
		return input
	}
}

interface SliderInputFieldProps {
	value: number
	setValue: (value: number) => void
	min?: number
	max?: number
	step?: number
	disabled?: boolean
	tooltip?: string
	className?: string
	onFocus?: () => void
	onValueCommitted?: (value: number) => void
}

export function SliderInputField({
	value,
	setValue,
	min,
	max,
	step,
	disabled,
	tooltip,
	className,
	onFocus,
	onValueCommitted,
}: SliderInputFieldProps): React.JSX.Element {
	return (
		<Slider.Root
			disabled={disabled}
			value={value}
			min={min}
			max={max}
			step={step}
			title={tooltip}
			onValueChange={setValue}
			onFocus={onFocus}
			onValueCommitted={onValueCommitted}
			thumbAlignment="edge"
			className={className}
		>
			<Slider.Control className="number-range">
				<Slider.Track className="number-range-track">
					<Slider.Indicator className="number-range-indicator" />
					<Slider.Thumb aria-label="Value" className="number-range-thumb" />
				</Slider.Track>
			</Slider.Control>
		</Slider.Root>
	)
}
