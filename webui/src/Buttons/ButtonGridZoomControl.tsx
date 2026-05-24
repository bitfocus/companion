import { CDropdown, CDropdownMenu, CDropdownToggle, CLink } from '@coreui/react'
import { faMagnifyingGlass, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '~/Components/Button.js'
import { InputGroup, InputGroupText } from '~/Components/Form.js'
import { NumberInputField, SliderInputField } from '~/Components/NumberInputField.js'
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
		<CDropdown className="dropdown-zoom" autoClose="outside" title="View Scale">
			<CDropdownToggle caret={!useCompactButtons} color="light">
				{/* <span className="sr-only">View Scale</span> */}
				<FontAwesomeIcon icon={faMagnifyingGlass} /> {useCompactButtons ? '' : `${Math.round(gridZoomValue)}%`}
			</CDropdownToggle>
			<CDropdownMenu>
				<InputGroup>
					<Button onClick={() => gridZoomController.zoomOut()}>
						<FontAwesomeIcon icon={faMinus} />
					</Button>
					<SliderInputField
						className="w-full align-self-center"
						min={ZOOM_MIN}
						max={ZOOM_MAX}
						step={ZOOM_STEP}
						tooltip="Scale"
						value={gridZoomValue}
						setValue={(val) => gridZoomController.setZoom(val)}
					/>
					<Button onClick={() => gridZoomController.zoomIn()}>
						<FontAwesomeIcon icon={faPlus} />
					</Button>
				</InputGroup>
				<InputGroup className="py-2 px-2">
					<NumberInputField
						id={undefined}
						value={gridZoomValue}
						setValue={gridZoomController.setZoom}
						min={ZOOM_MIN}
						max={ZOOM_MAX}
					/>
					<InputGroupText>%</InputGroupText>
				</InputGroup>
				<CLink className="dropdown-item" onClick={gridZoomController.zoomReset}>
					Scale to 100%
				</CLink>
			</CDropdownMenu>
		</CDropdown>
	)
}
