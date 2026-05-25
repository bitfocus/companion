import { faMagnifyingGlass, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '~/Components/Button.js'
import { InputGroup, InputGroupText } from '~/Components/Form.js'
import { NumberInputField, SliderInputField } from '~/Components/NumberInputField.js'
import { Popover } from '~/Components/Popover.js'
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
		<Popover.Root>
			<Popover.Trigger color="light" caret={!useCompactButtons} title="View Scale">
				<FontAwesomeIcon icon={faMagnifyingGlass} /> {useCompactButtons ? '' : `${Math.round(gridZoomValue)}%`}
			</Popover.Trigger>
			<Popover.Popup>
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
				<Popover.Item onClick={gridZoomController.zoomReset}>Scale to 100%</Popover.Item>
			</Popover.Popup>
		</Popover.Root>
	)
}
