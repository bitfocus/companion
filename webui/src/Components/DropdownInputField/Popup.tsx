import { Combobox } from '@base-ui/react/combobox'
import React from 'react'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'

// nocommit - unify this with elsewhere
export interface DropdownGroupBase {
	id: string
	label: string
	options: DropdownChoice[]
}

export interface DropdownInputPopupProps {
	menuPortal: HTMLElement | undefined
	noOptionsMessage?: string
}

export function DropdownInputPopup({ menuPortal, noOptionsMessage }: DropdownInputPopupProps): React.JSX.Element {
	return (
		<Combobox.Portal container={menuPortal}>
			<Combobox.Positioner className="dropdown-field-positioner" sideOffset={8}>
				<Combobox.Popup className="dropdown-field-popup">
					<Combobox.Empty>
						<div className="dropdown-field-empty">{noOptionsMessage || 'No options found.'}</div>
					</Combobox.Empty>
					<Combobox.List className="dropdown-field-list">
						{(item: DropdownChoice | DropdownGroupBase) => {
							if ('options' in item) {
								return (
									<Combobox.Group key={item.id} items={item.options} className="dropdown-field-group">
										<Combobox.GroupLabel className="dropdown-field-group-label">{item.label}</Combobox.GroupLabel>
										<Combobox.Collection>
											{(item: DropdownChoice) => (
												<Combobox.Item key={item.id} value={item.id} className="dropdown-field-item">
													{item.label}
												</Combobox.Item>
											)}
										</Combobox.Collection>
									</Combobox.Group>
								)
							}

							return (
								<Combobox.Item key={item.id} value={item.id} className="dropdown-field-item">
									{item.label}
								</Combobox.Item>
							)
						}}
					</Combobox.List>
				</Combobox.Popup>
			</Combobox.Positioner>
		</Combobox.Portal>
	)
}
