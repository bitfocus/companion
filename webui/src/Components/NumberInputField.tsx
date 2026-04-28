import { NumberField } from '@base-ui/react/number-field'
import { Slider } from '@base-ui/react/slider'
import classNames from 'classnames'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useCallback, useState } from 'react'

interface NumberInputFieldProps {
	min?: number
	max?: number
	step?: number
	tooltip?: string
	range?: boolean
	value: number
	setValue: (value: number) => void
	disabled?: boolean
	checkValid?: (value: number) => boolean
	// When true, show the min value as a visual -∞ when value <= min
	showMinAsNegativeInfinity?: boolean
	// When true, show the max value as a visual ∞ when value >= max
	showMaxAsPositiveInfinity?: boolean
}

export function NumberInputField({
	min,
	max,
	step,
	tooltip,
	range,
	value,
	setValue,
	disabled,
	checkValid,
	showMinAsNegativeInfinity,
	showMaxAsPositiveInfinity,
}: NumberInputFieldProps): React.JSX.Element {
	const [tmpValue, setTmpValue] = useState<number | string | null>(null)

	const onChangeValue = useCallback(
		(value: number | null) => {
			if (value !== null && !isNaN(value)) {
				setTmpValue(value)
				setValue(value)
			}
		},
		[setValue]
	)

	// Compute whether we should visually show -∞ or ∞.
	const numericEffective = Number(tmpValue ?? value ?? 0)
	let showOverlayValue: string | null = null
	if (
		!!showMinAsNegativeInfinity &&
		typeof min !== 'undefined' &&
		!isNaN(numericEffective) &&
		numericEffective <= min
	) {
		showOverlayValue = '-∞'
	} else if (
		!!showMaxAsPositiveInfinity &&
		typeof max !== 'undefined' &&
		!isNaN(numericEffective) &&
		numericEffective >= max
	) {
		showOverlayValue = '∞'
	}

	const valueIsInvalid = !!checkValid && !checkValid(Number(tmpValue ?? value))

	const input = (
		<NumberField.Root
			//id={id}
			disabled={disabled}
			value={Number(tmpValue ?? value ?? 0)}
			onValueChange={onChangeValue}
			min={min}
			max={max}
			step={step ?? 'any'}
			title={tooltip}
			className="number-field"
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
					<Slider.Root
						disabled={disabled}
						value={Number(tmpValue ?? value ?? 0)}
						min={min}
						max={max}
						step={step}
						title={tooltip}
						onValueChange={onChangeValue}
						onFocus={() => setTmpValue(value ?? '')}
						onValueCommitted={() => setTmpValue(null)}
						thumbAlignment="edge"
					>
						<Slider.Control className="number-range">
							<Slider.Track className="number-range-track">
								<Slider.Indicator className="number-range-indicator" />
								<Slider.Thumb aria-label="Value" className="number-range-thumb" />
							</Slider.Track>
						</Slider.Control>
					</Slider.Root>
				</div>
			</div>
		)
	} else {
		return input
	}
}
