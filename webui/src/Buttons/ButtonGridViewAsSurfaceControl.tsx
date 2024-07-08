import { CDropdown, CDropdownMenu, CDropdownToggle } from '@coreui/react'
import { faMobileScreen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React from 'react'

export interface ButtonGridViewAsSurfaceControlProps {
	useCompactButtons: boolean
	// gridZoomValue: number
	// gridZoomController: GridZoomController
}

export const ButtonGridViewAsSurfaceControl = observer(function ButtonGridViewAsSurfaceControl({
	useCompactButtons,
}: ButtonGridViewAsSurfaceControlProps) {
	return (
		<CDropdown className="dropdown-zoom btn-right" autoClose="outside" title="View Scale">
			<CDropdownToggle caret={!useCompactButtons} color="light">
				<span className="sr-only">View Scale</span>
				<FontAwesomeIcon icon={faMobileScreen} /> {useCompactButtons ? '' : 'View As'}
			</CDropdownToggle>
			<CDropdownMenu>
				{/* <CInputGroup>
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
				</CLink> */}
			</CDropdownMenu>
		</CDropdown>
	)
})
