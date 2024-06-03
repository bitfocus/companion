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

export const ZOOM_MIN = 50
export const ZOOM_MAX = 200
export const ZOOM_STEP = 10

export interface ButtonGridZoomControlProps {
	useCompactButtons: boolean
	value: number
	setValue: (updater: ((oldValue: number) => number) | number) => void
}
export function ButtonGridZoomControl({ useCompactButtons, value, setValue }: ButtonGridZoomControlProps) {
	const incrementZoom = useCallback(() => setValue((oldValue) => Math.min(oldValue + ZOOM_STEP, ZOOM_MAX)), [setValue])
	const decrementZoom = useCallback(() => setValue((oldValue) => Math.max(oldValue - ZOOM_STEP, ZOOM_MIN)), [setValue])

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
						min={ZOOM_MIN}
						max={ZOOM_MAX}
						step={ZOOM_STEP}
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
					<NumberInputField value={value} setValue={setValue} min={ZOOM_MIN} max={ZOOM_MAX} />
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
