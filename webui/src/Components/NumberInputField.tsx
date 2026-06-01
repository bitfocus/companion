import { NumberField } from '@base-ui/react/number-field'
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
	value: number | undefined
	setValue: (value: number) => void
	onBlur?: (e: React.FocusEvent<HTMLElement>) => void
	disabled?: boolean
	checkValid?: boolean | ((value: number) => boolean)
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
	checkValid,
	showMinAsNegativeInfinity,
	showMaxAsPositiveInfinity,
	immediateValue,
}: NumberInputFieldProps): React.JSX.Element {
	const [tmpValue, setTmpValue] = useState<number | string | null>(null)

	const onChangeValue = useCallback(
		(value: number | null) => {
			if (value !== null && !isNaN(value)) {
				if (!immediateValue) setTmpValue(value)
				setValue(value)
			}
		},
		[immediateValue, setValue]
	)

	const handleBlur = useCallback(
		(e: React.FocusEvent<HTMLElement>) => {
			setTmpValue(null)
			onBlur?.(e)
		},
		[onBlur]
	)

	// Compute whether we should visually show -∞ or ∞.
	const numericEffective = Number((immediateValue ? null : tmpValue) ?? value ?? 0)
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

	const valueIsInvalid = typeof checkValid === 'boolean' ? !checkValid : !!checkValid && !checkValid(numericEffective)

	const input = (
		<NumberField.Root
			id={id}
			disabled={disabled}
			value={numericEffective}
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
				<NumberField.Input className={classNames('number-field-input', { 'invalid-value': valueIsInvalid })} />

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
			<div className="d-grid grid-col">
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
