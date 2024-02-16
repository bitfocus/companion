import {
	CButton,
	CCol,
	CInput,
	CInputGroup,
	CInputGroupAppend,
	CInputGroupPrepend,
	CInputGroupText,
	CRow,
} from '@coreui/react'
import React, { useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { NumberInputField } from '../Components/NumberInputField.js'

export interface ButtonGridZoomSlider {
	value: number
	setValue: (value: number) => void
}
export function ButtonGridZoomSlider({ value, setValue }: ButtonGridZoomSlider) {
	const minZoom = 50
	const maxZoom = 200
	const zoomStep = 10

	const incrementZoom = useCallback(() => setValue(Math.min(value + zoomStep, maxZoom)), [value, setValue])
	const decrementZoom = useCallback(() => setValue(Math.max(value - zoomStep, minZoom)), [value, setValue])

	return (
		<CRow>
			<CCol sm={{ size: 5, offset: 3 }}>
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
			</CCol>
			<CCol sm={4}>
				<CInputGroup>
					{/* <CInputGroupPrepend>
            <CButton
                color="info"
                variant="outline"
                onClick={resetZoom}
                title={'Reset'}
            >
                <FontAwesomeIcon icon={faMagnifyingGlass} />
            </CButton>
        </CInputGroupPrepend> */}
					<NumberInputField value={value} setValue={setValue} min={minZoom} max={maxZoom} />
					<CInputGroupAppend>
						<CInputGroupText>%</CInputGroupText>
					</CInputGroupAppend>
				</CInputGroup>
			</CCol>
		</CRow>
	)
}
