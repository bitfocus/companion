import { Select } from '@base-ui/react/select'
import classNames from 'classnames'
import { ChevronDownIcon } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo } from 'react'
import type { ReadonlyDeep } from 'type-fest'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { useDropdownChoicesForSelect, type DropdownChoicesOrGroups } from './DropdownChoices.js'
import { MenuPortalContext } from './MenuPortalContext.js'

interface SimpleDropdownInputFieldProps {
	id?: string
	className?: string
	choices: DropdownChoicesOrGroups | ReadonlyDeep<DropdownChoicesOrGroups>
	tooltip?: string
	value: DropdownChoiceId
	setValue: (value: DropdownChoiceId) => void
	disabled?: boolean
	checkValid?: (value: DropdownChoiceId) => boolean
	noOptionsMessage?: string
	badOptionPrefix?: string
	onBlur?: React.FocusEventHandler<HTMLButtonElement>
}

/**
 * A simple and lightweight dropdown input field.
 * Does not support searching, multi-select, custom values or other features.
 */
export const SimpleDropdownInputField = observer(function SimpleDropdownInputField({
	id,
	className,
	choices,
	tooltip,
	value,
	setValue,
	disabled,
	checkValid,
	noOptionsMessage,
	badOptionPrefix,
	onBlur,
}: SimpleDropdownInputFieldProps): React.JSX.Element {
	const menuPortal = useContext(MenuPortalContext)
	const { options, flatOptions } = useDropdownChoicesForSelect(choices as DropdownChoicesOrGroups)

	const onChange = useCallback(
		(v: DropdownChoiceId | null) => {
			setValue(v as DropdownChoiceId)
		},
		[setValue]
	)

	const stringValue = String(value)
	const stringFlatOptions = useMemo(
		() => flatOptions.map((o) => ({ value: String(o.value), label: o.label })),
		[flatOptions]
	)
	const isKnownValue = stringFlatOptions.some((o) => o.value === stringValue) || options.length === 0
	const itemsForLookup = useMemo(
		() =>
			isKnownValue
				? stringFlatOptions
				: [
						...stringFlatOptions,
						{
							value: stringValue,
							label: badOptionPrefix ? `${badOptionPrefix}: ${stringValue}` : `?? (${stringValue})`,
						},
					],
		[isKnownValue, stringFlatOptions, stringValue, badOptionPrefix]
	)

	const noOptionsMessageFull = noOptionsMessage || 'No options available'

	return (
		<div
			className={classNames(
				'dropdown-field',
				{
					'dropdown-field-invalid': !isKnownValue || (!!checkValid && !checkValid(value)),
				},
				className
			)}
			title={tooltip}
		>
			<Select.Root<DropdownChoiceId>
				id={id}
				value={options.length === 0 ? '' : stringValue}
				onValueChange={onChange}
				items={itemsForLookup}
				disabled={disabled}
			>
				<Select.Trigger className="dropdown-field-select-trigger" onBlur={onBlur}>
					<Select.Value
						className="dropdown-field-select-value"
						placeholder={options.length === 0 ? noOptionsMessageFull : 'Select...'}
					/>
					<Select.Icon className="dropdown-field-trigger">
						<ChevronDownIcon className="dropdown-field-icon" />
					</Select.Icon>
				</Select.Trigger>
				<Select.Portal container={menuPortal ?? undefined}>
					<Select.Positioner className="dropdown-field-positioner" alignItemWithTrigger={false}>
						<Select.Popup className="dropdown-field-popup">
							<Select.List className="dropdown-field-list">
								{!options.length && (
									<Select.Item key="no-options" value="" className="dropdown-field-item" disabled>
										<Select.ItemText>{noOptionsMessageFull}</Select.ItemText>
									</Select.Item>
								)}
								{options.map((item) => {
									if ('options' in item) {
										return (
											<Select.Group key={item.label} className="dropdown-field-group">
												<Select.GroupLabel className="dropdown-field-group-label">{item.label}</Select.GroupLabel>
												{item.options.map((opt) => (
													<Select.Item
														key={String(opt.value)}
														value={String(opt.value)}
														className="dropdown-field-item"
													>
														<Select.ItemText>{opt.label}</Select.ItemText>
													</Select.Item>
												))}
											</Select.Group>
										)
									}
									return (
										<Select.Item key={String(item.value)} value={String(item.value)} className="dropdown-field-item">
											<Select.ItemText>{item.label}</Select.ItemText>
										</Select.Item>
									)
								})}
							</Select.List>
						</Select.Popup>
					</Select.Positioner>
				</Select.Portal>
			</Select.Root>
		</div>
	)
})
