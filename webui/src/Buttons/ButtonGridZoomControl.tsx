import {
	CButton,
	CDropdown,
	CDropdownMenu,
	CDropdownToggle,
	CFormRange,
	CInputGroup,
	CInputGroupText,
	CLink,
} from '@coreui/react'
import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, type GridZoomController } from './GridZoom.js'

export interface ButtonGridZoomControlProps {
	useCompactButtons: boolean
	gridZoomValue: number
	gridZoomController: GridZoomController
}
export function ButtonGridZoomControl({
	useCompactButtons,
	gridZoomValue,
	gridZoomController,
}: ButtonGridZoomControlProps): React.JSX.Element {
	return (
		<CDropdown className="dropdown-zoom btn-right" autoClose="outside" title="View Scale">
			<CDropdownToggle caret={!useCompactButtons} color="light">
				{/* <span className="sr-only">View Scale</span> */}
				<FontAwesomeIcon icon={faMagnifyingGlass} /> {useCompactButtons ? '' : `${Math.round(gridZoomValue)}%`}
			</CDropdownToggle>
			<CDropdownMenu>
				<CInputGroup>
					<CButton onClick={() => gridZoomController.zoomOut()}>
						<FontAwesomeIcon icon={faMinus} />
					</CButton>
					<CFormRange
						name="scale"
						min={ZOOM_MIN}
						max={ZOOM_MAX}
						step={ZOOM_STEP}
						title="Scale"
						value={gridZoomValue}
						onChange={(e) => gridZoomController.setZoom(parseInt(e.currentTarget.value))}
					/>
					<CButton onClick={() => gridZoomController.zoomIn()}>
						<FontAwesomeIcon icon={faPlus} />
					</CButton>
				</CInputGroup>
				<CInputGroup className="dropdown-item-padding">
					<NumberInputField value={gridZoomValue} setValue={gridZoomController.setZoom} min={ZOOM_MIN} max={ZOOM_MAX} />
					<CInputGroupText>%</CInputGroupText>
				</CInputGroup>
				<CLink className="dropdown-item" onClick={gridZoomController.zoomReset}>
					Scale to 100%
				</CLink>
			</CDropdownMenu>
		</CDropdown>
	)
}
