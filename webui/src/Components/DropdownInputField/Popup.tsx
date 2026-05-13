import { Combobox } from '@base-ui/react/combobox'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CheckIcon, PlusIcon } from 'lucide-react'
import React, { useCallback, useRef, type Ref } from 'react'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'

export interface DropdownGroupBase {
	id: string
	label: string
	items: DropdownChoice[]
}

/** Extended choice that can carry a display hint for the indicator slot. */
export type DropdownChoiceWithMeta = DropdownChoice & { plusIndicator?: boolean }

export interface DropdownInputPopupProps {
	menuPortal: HTMLElement | undefined
	noOptionsMessage?: string
	showIndicator?: boolean
	/** When true, unselected items show a not-allowed cursor (selection is rejected by onValueChange). */
	disableUnselected?: boolean
	/** When true, renders the list using @tanstack/react-virtual for large datasets. Only supports flat (non-grouped) item lists. */
	virtualized?: boolean
	/** When true, each item renders two lines: the id (top) and the label (bottom), matching the variable dropdown style. */
	fancyFormat?: boolean
}

export function DropdownInputPopup({
	menuPortal,
	noOptionsMessage,
	showIndicator,
	disableUnselected,
	virtualized,
	fancyFormat,
}: DropdownInputPopupProps): React.JSX.Element {
	const renderItem = (item: DropdownChoiceWithMeta) => (
		<Combobox.Item
			key={item.id}
			value={item.id}
			className={fancyFormat ? 'dropdown-field-item variable-dropdown-option' : 'dropdown-field-item'}
		>
			{showIndicator && (
				<span className="dropdown-field-item-indicator">
					{item.plusIndicator ? (
						<PlusIcon className="dropdown-field-item-indicator-icon dropdown-field-item-indicator-icon--always" />
					) : (
						<CheckIcon className="dropdown-field-item-indicator-icon" />
					)}
				</span>
			)}
			{fancyFormat ? (
				<div className="dropdown-field-item-content">
					<span className="var-name">{String(item.id)}</span>
					<span className="var-label">{item.label}</span>
				</div>
			) : (
				item.label
			)}
		</Combobox.Item>
	)

	return (
		<Combobox.Portal container={menuPortal}>
			<Combobox.Positioner className="dropdown-field-positioner" sideOffset={8}>
				<Combobox.Popup className="dropdown-field-popup">
					<Combobox.Empty>
						<div className="dropdown-field-empty">{noOptionsMessage || 'No options found.'}</div>
					</Combobox.Empty>
					{virtualized ? (
						<Combobox.List
							className={`dropdown-field-list dropdown-field-list--virtualized${disableUnselected ? ' dropdown-field-list--max-reached' : ''}`}
						>
							<VirtualizedComboboxList showIndicator={showIndicator} fancyFormat={fancyFormat} />
						</Combobox.List>
					) : (
						<Combobox.List
							className={`dropdown-field-list${disableUnselected ? ' dropdown-field-list--max-reached' : ''}`}
						>
							{(item: DropdownChoiceWithMeta | DropdownGroupBase) => {
								if ('items' in item) {
									return (
										<Combobox.Group key={item.id} items={item.items} className="dropdown-field-group">
											{item.label && (
												<Combobox.GroupLabel className="dropdown-field-group-label">{item.label}</Combobox.GroupLabel>
											)}
											<Combobox.Collection>{renderItem}</Combobox.Collection>
										</Combobox.Group>
									)
								}
								return renderItem(item)
							}}
						</Combobox.List>
					)}
				</Combobox.Popup>
			</Combobox.Positioner>
		</Combobox.Portal>
	)
}

interface VirtualComboboxItemProps {
	item: DropdownChoiceWithMeta
	index: number
	start: number
	totalCount: number
	measureElement: (el: Element | null) => void
	showIndicator?: boolean
	fancyFormat?: boolean
}

const VirtualComboboxItem = React.memo(function VirtualComboboxItem({
	item,
	index,
	start,
	totalCount,
	measureElement,
	showIndicator,
	fancyFormat,
}: VirtualComboboxItemProps): React.JSX.Element {
	return (
		<Combobox.Item
			value={item.id}
			index={index}
			data-index={index}
			ref={measureElement}
			aria-setsize={totalCount}
			aria-posinset={index + 1}
			className={fancyFormat ? 'dropdown-field-item variable-dropdown-option' : 'dropdown-field-item'}
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				transform: `translateY(${start}px)`,
			}}
		>
			{showIndicator && (
				<span className="dropdown-field-item-indicator">
					{item.plusIndicator ? (
						<PlusIcon className="dropdown-field-item-indicator-icon dropdown-field-item-indicator-icon--always" />
					) : (
						<CheckIcon className="dropdown-field-item-indicator-icon" />
					)}
				</span>
			)}
			{fancyFormat ? (
				<div className="dropdown-field-item-content">
					<span className="var-name">{String(item.id)}</span>
					<span className="var-label">{item.label}</span>
				</div>
			) : (
				item.label
			)}
		</Combobox.Item>
	)
})

function VirtualizedComboboxList({
	showIndicator,
	fancyFormat,
}: {
	showIndicator?: boolean
	fancyFormat?: boolean
}): React.JSX.Element | null {
	const filteredItems = Combobox.useFilteredItems<DropdownChoiceWithMeta>()
	const scrollElementRef = useRef<HTMLDivElement | null>(null)

	const getScrollElement = useCallback(() => scrollElementRef.current, [])
	const estimateSize = useCallback(() => 37.6, [])

	// eslint-disable-next-line react-hooks/incompatible-library
	const virtualizer = useVirtualizer({
		count: filteredItems.length,
		getScrollElement,
		estimateSize,
		overscan: 20,
		paddingStart: 4,
		paddingEnd: 4,
		scrollPaddingStart: 4,
		scrollPaddingEnd: 4,
	})

	const scrollerRef: Ref<HTMLDivElement> = useCallback(
		(element: HTMLDivElement | null) => {
			scrollElementRef.current = element
			if (element) virtualizer.measure()
		},
		[virtualizer]
	)

	const totalSize = virtualizer.getTotalSize()

	if (!filteredItems.length) return null

	return (
		<div
			role="presentation"
			ref={scrollerRef}
			className="dropdown-field-list-scroller"
			style={{ '--total-size': `${totalSize}px` } as React.CSSProperties}
		>
			<div role="presentation" style={{ height: totalSize, width: '100%', position: 'relative' }}>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const item = filteredItems[virtualRow.index]
					if (!item) return null
					return (
						<VirtualComboboxItem
							key={virtualRow.key}
							item={item}
							index={virtualRow.index}
							start={virtualRow.start}
							totalCount={filteredItems.length}
							measureElement={virtualizer.measureElement}
							showIndicator={showIndicator}
							fancyFormat={fancyFormat}
						/>
					)
				})}
			</div>
		</div>
	)
}
