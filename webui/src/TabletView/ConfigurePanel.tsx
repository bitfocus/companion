import { CCol, CRow } from '@coreui/react'
import { faCog, faExpand } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useId, useState } from 'react'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { Button } from '~/Components/Button'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'
import { Form, FormLabel } from '~/Components/Form.js'
import { NumberInputField } from '~/Components/NumberInputField'
import { TextInputFieldSimple } from '~/Components/TextInputField'
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

	const pagesFieldId = useId()
	const minColFieldId = useId()
	const maxColFieldId = useId()
	const minRowFieldId = useId()
	const maxRowFieldId = useId()
	const displayColumnFieldId = useId()

	return show ? (
		<CRow className="configure">
			<CCol sm={12}>
				<h3>
					Configure Buttons View
					<Button className="close-config" onClick={() => setShow(false)} title="Close">
						<FontAwesomeIcon icon={faCog} />
					</Button>
				</h3>
				<Form onSubmit={PreventDefaultHandler}>
					<CRow>
						<CCol sm={6} xs={12}>
							<FormLabel htmlFor={pagesFieldId}>Pages</FormLabel>
							<TextInputFieldSimple
								id={pagesFieldId}
								value={query['pages'] ? String(query['pages']) : ''}
								setValue={(val) => updateQueryUrl('pages', val)}
								placeholder={'1..99'}
							/>
							<p className="text-muted">
								use 1..6 for ranges, and commas for multiple selections. Follows provided order
							</p>

							<FormLabel htmlFor={minColFieldId}>Min Column</FormLabel>
							<NumberInputField
								id={minColFieldId}
								value={Number(query['min_col']) || 0}
								setValue={(val) => updateQueryUrl('min_col', val)}
								max={Number(query['max_col']) || gridSize.maxColumn}
								min={gridSize.minColumn}
							/>

							<FormLabel htmlFor={maxColFieldId}>Max Column</FormLabel>
							<NumberInputField
								id={maxColFieldId}
								value={Number(query['max_col']) || 0}
								setValue={(val) => updateQueryUrl('max_col', val)}
								max={gridSize.maxColumn}
								min={Number(query['min_col']) || gridSize.minColumn}
							/>

							<FormLabel htmlFor={minRowFieldId}>Min Row</FormLabel>
							<NumberInputField
								id={minRowFieldId}
								value={Number(query['min_row']) || 0}
								setValue={(val) => updateQueryUrl('min_row', val)}
								max={Number(query['max_row']) || gridSize.maxRow}
								min={gridSize.minRow}
							/>

							<FormLabel htmlFor={maxRowFieldId}>Max Row</FormLabel>
							<NumberInputField
								id={maxRowFieldId}
								value={Number(query['max_row']) || 0}
								setValue={(val) => updateQueryUrl('max_row', val)}
								max={gridSize.maxRow}
								min={Number(query['min_row']) || gridSize.minRow}
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

							<FormLabel htmlFor={displayColumnFieldId}>Display Columns (0 for dynamic)</FormLabel>
							<NumberInputField
								id={displayColumnFieldId}
								value={Number(query['display_cols']) || 0}
								setValue={(val) => updateQueryUrl('display_cols', val)}
								min={0}
							/>
						</CCol>
					</CRow>
				</Form>
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
