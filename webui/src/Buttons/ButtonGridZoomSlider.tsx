import {
	CButton,
	CDropdown,
	CDropdownMenu,
	CDropdownToggle,
	CInput,
	CInputGroup,
	CInputGroupAppend,
	CInputGroupPrepend,
	CInputGroupText,
	CLink,
} from '@coreui/react'
import React, { useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { NumberInputField } from '../Components/NumberInputField.js'

export interface ButtonGridZoomControlProps {
	useCompactButtons: boolean
	value: number
	setValue: (value: number) => void
}
export function ButtonGridZoomControl({ useCompactButtons, value, setValue }: ButtonGridZoomControlProps) {
	const minZoom = 50
	const maxZoom = 200
	const zoomStep = 10

	const incrementZoom = useCallback(() => setValue(Math.min(value + zoomStep, maxZoom)), [value, setValue])
	const decrementZoom = useCallback(() => setValue(Math.max(value - zoomStep, minZoom)), [value, setValue])

	return (
		<CDropdown className="dropdown-zoom">
			<CDropdownToggle caret={!useCompactButtons} color="light">
				<span className="sr-only">Zoom</span>
				<FontAwesomeIcon icon={faMagnifyingGlass} /> {useCompactButtons ? '' : `${Math.round(value)}%`}
			</CDropdownToggle>
			<CDropdownMenu>
				<CInputGroup className={'fieldtype-range'}>
					<CInputGroupPrepend>
						<CButton onClick={decrementZoom}>
							<FontAwesomeIcon icon={faMinus} />
						</CButton>
					</CInputGroupPrepend>
					<CInput
						name="zoom"
						type="range"
						min={minZoom}
						max={maxZoom}
						step={zoomStep}
						title="Zoom"
						value={value}
						onChange={(e) => setValue(parseInt(e.currentTarget.value))}
					/>
					<CInputGroupAppend>
						<CButton onClick={incrementZoom}>
							<FontAwesomeIcon icon={faPlus} />
						</CButton>
					</CInputGroupAppend>
				</CInputGroup>
				<CInputGroup className="dropdown-item-padding">
					<NumberInputField value={value} setValue={setValue} min={minZoom} max={maxZoom} />
					<CInputGroupAppend>
						<CInputGroupText>%</CInputGroupText>
					</CInputGroupAppend>
				</CInputGroup>
				<CLink className="dropdown-item" onClick={() => setValue(100)}>
					Zoom to 100%
				</CLink>
			</CDropdownMenu>
		</CDropdown>
	)
}
