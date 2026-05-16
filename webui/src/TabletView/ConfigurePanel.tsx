import { CCol, CForm, CFormInput, CRow } from '@coreui/react'
import { faCog, faExpand } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useState } from 'react'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { Button } from '~/Components/Button'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'
import { PreventDefaultHandler, useMountEffect } from '~/Resources/util.js'

interface ConfigurePanelProps {
	updateQueryUrl: (key: string, value: any) => void
	query: Record<string, string | number>
	gridSize: UserConfigGridSize
}

export function ConfigurePanel({ updateQueryUrl, query, gridSize }: ConfigurePanelProps): React.JSX.Element {
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
					<Button className="close-config" onClick={() => setShow(false)} title="Close">
						<FontAwesomeIcon icon={faCog} />
					</Button>
				</h3>
				<CForm onSubmit={PreventDefaultHandler}>
					<CRow>
						<CCol sm={6} xs={12}>
							<CFormInput
								label="Pages"
								value={query['pages'] || ''}
								onChange={(e) => updateQueryUrl('pages', e.currentTarget.value)}
								placeholder={'1..99'}
							/>
							<p>use 1..6 for ranges, and commas for multiple selections. Follows provided order</p>

							<CFormInput
								label="Min Column"
								type="number"
								max={query['max_col'] ?? gridSize.maxColumn}
								min={gridSize.minColumn}
								value={query['min_col'] || 0}
								onChange={(e) => updateQueryUrl('min_col', e.currentTarget.value)}
							/>
							<CFormInput
								label="Max Column"
								type="number"
								min={query['min_col'] ?? gridSize.minColumn}
								max={gridSize.maxColumn}
								value={query['max_col'] || gridSize.maxColumn}
								onChange={(e) => updateQueryUrl('max_col', e.currentTarget.value)}
							/>

							<CFormInput
								label="Min Row"
								type="number"
								max={query['max_row'] ?? gridSize.maxRow}
								min={gridSize.minRow}
								value={query['min_row'] || 0}
								onChange={(e) => updateQueryUrl('min_row', e.currentTarget.value)}
							/>
							<CFormInput
								label="Max Row"
								type="number"
								min={query['min_row'] ?? gridSize.minRow}
								max={gridSize.maxRow}
								value={query['max_row'] || gridSize.maxRow}
								onChange={(e) => updateQueryUrl('max_row', e.currentTarget.value)}
							/>
						</CCol>
						<CCol sm={6} xs={12}>
							<CheckboxInputFieldWithLabel
								className="my-1"
								label="Hide configure button"
								value={!!query['noconfigure']}
								setValue={(val) => updateQueryUrl('noconfigure', val)}
							/>
							<CheckboxInputFieldWithLabel
								className="my-1"
								label="Hide fullscreen button"
								value={!!query['nofullscreen']}
								setValue={(val) => updateQueryUrl('nofullscreen', val)}
							/>

							<CheckboxInputFieldWithLabel
								className="my-1"
								label="Show page headings"
								value={!!query['showpages']}
								setValue={(val) => updateQueryUrl('showpages', val)}
							/>
							<CFormInput
								label="Display Columns (0 for dynamic)"
								type="number"
								min={0}
								value={query['display_cols'] || '0'}
								onChange={(e) => updateQueryUrl('display_cols', e.currentTarget.value)}
							/>
						</CCol>
					</CRow>
				</CForm>
			</CCol>
		</CRow>
	) : (
		<CRow className="header">
			<CCol xs={12}>
				{(!fullscreen || !query['noconfigure']) && !query['nofullscreen'] && (
					<Button
						onClick={() => {
							document.documentElement.requestFullscreen().catch((err) => {
								console.error('Error attempting to enable full-screen mode:', err)
							})
						}}
						disabled={!document.documentElement.requestFullscreen}
						title="Fullscreen"
					>
						<FontAwesomeIcon icon={faExpand} />
					</Button>
				)}
				{!query['noconfigure'] && (
					<Button className="open-config" onClick={() => setShow(true)} title="Configure">
						<FontAwesomeIcon icon={faCog} />
					</Button>
				)}
			</CCol>
		</CRow>
	)
}
