import React, { useState } from 'react'
import { PreventDefaultHandler, useMountEffect } from '../util'
import { CButton, CCol, CForm, CFormGroup, CInput, CInputCheckbox, CRow } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faExpand } from '@fortawesome/free-solid-svg-icons'
import type { UserConfigGridSize } from '@companion/shared/Model/UserConfigModel'

interface ConfigurePanelProps {
	updateQueryUrl: (key: string, value: any) => void
	query: Record<string, string | number>
	gridSize: UserConfigGridSize
}

export function ConfigurePanel({ updateQueryUrl, query, gridSize }: ConfigurePanelProps) {
	const [show, setShow] = useState(false)
	const [fullscreen, setFullscreen] = useState(document.fullscreenElement !== null)

	useMountEffect(() => {
		const handleChange = () => setFullscreen(document.fullscreenElement !== null)

		document.addEventListener('fullscreenchange', handleChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleChange)
		}
	})

	return show ? (
		<CRow className="configure">
			<CCol sm={12}>
				<h3>
					Configure Buttons View
					<CButton className="close-config" onClick={() => setShow(false)} title="Close">
						<FontAwesomeIcon icon={faCog} />
					</CButton>
				</h3>
				<CForm onSubmit={PreventDefaultHandler}>
					<CRow>
						<CCol sm={6} xs={12}>
							<CFormGroup>
								<label>Pages</label>
								<p>use 1..6 for ranges, and commas for multiple selections. Follows provided order</p>
								<CInput
									value={query['pages'] || ''}
									onChange={(e) => updateQueryUrl('pages', e.currentTarget.value)}
									placeholder={'1..99'}
								/>
							</CFormGroup>

							<CFormGroup>
								<label>Min Column</label>
								<CInput
									type="number"
									max={query['max_col'] ?? gridSize.maxColumn}
									min={gridSize.minColumn}
									value={query['min_col'] || 0}
									onChange={(e) => updateQueryUrl('min_col', e.currentTarget.value)}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Max Column</label>
								<CInput
									type="number"
									min={query['min_col'] ?? gridSize.minColumn}
									max={gridSize.maxColumn}
									value={query['max_col'] || gridSize.maxColumn}
									onChange={(e) => updateQueryUrl('max_col', e.currentTarget.value)}
								/>
							</CFormGroup>

							<CFormGroup>
								<label>Min Row</label>
								<CInput
									type="number"
									max={query['max_row'] ?? gridSize.maxRow}
									min={gridSize.minRow}
									value={query['min_row'] || 0}
									onChange={(e) => updateQueryUrl('min_row', e.currentTarget.value)}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Max Row</label>
								<CInput
									type="number"
									min={query['min_row'] ?? gridSize.minRow}
									max={gridSize.maxRow}
									value={query['max_row'] || gridSize.maxRow}
									onChange={(e) => updateQueryUrl('max_row', e.currentTarget.value)}
								/>
							</CFormGroup>
						</CCol>
						<CCol sm={6} xs={12}>
							<CFormGroup>
								<label>Hide configure button</label>
								<CInputCheckbox
									type="checkbox"
									checked={!!query['noconfigure']}
									onChange={(e) => updateQueryUrl('noconfigure', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Hide fullscreen button</label>
								<CInputCheckbox
									type="checkbox"
									checked={!!query['nofullscreen']}
									onChange={(e) => updateQueryUrl('nofullscreen', !!e.currentTarget.checked)}
								/>
							</CFormGroup>

							<CFormGroup>
								<label>Show page headings</label>
								<CInputCheckbox
									type="checkbox"
									checked={!!query['showpages']}
									onChange={(e) => updateQueryUrl('showpages', !!e.currentTarget.checked)}
								/>
							</CFormGroup>
							<CFormGroup>
								<label>Display Columns (0 for dynamic)</label>
								<CInput
									type="number"
									min={0}
									value={query['display_cols'] || '0'}
									onChange={(e) => updateQueryUrl('display_cols', e.currentTarget.value)}
								/>
							</CFormGroup>
						</CCol>
					</CRow>
				</CForm>
			</CCol>
		</CRow>
	) : (
		<CRow className="header">
			<CCol xs={12}>
				{(!fullscreen || !query['noconfigure']) && !query['nofullscreen'] && (
					<CButton onClick={() => document.documentElement.requestFullscreen()} title="Fullscreen">
						<FontAwesomeIcon icon={faExpand} />
					</CButton>
				)}
				{!query['noconfigure'] && (
					<CButton className="open-config" onClick={() => setShow(true)} title="Configure">
						<FontAwesomeIcon icon={faCog} />
					</CButton>
				)}
			</CCol>
		</CRow>
	)
}
