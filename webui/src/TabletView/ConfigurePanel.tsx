import { faCog, faExpand } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useId, useState } from 'react'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { Button } from '~/Components/Button'
import { CheckboxInputFieldWithLabel } from '~/Components/CheckboxInputField'
import { Form, FormLabel } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal'
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

	return (
		<>
			<Modal.Root open={show} onOpenChange={setShow}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup size="lg">
							<Modal.Header closeButton>
								<Modal.Title>Configure Tablet View</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<Form onSubmit={PreventDefaultHandler} className="space-y-4">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="space-y-3">
											<div>
												<FormLabel
													htmlFor={pagesFieldId}
													className="text-xs font-semibold text-muted uppercase tracking-wider mb-1 block"
												>
													Pages
												</FormLabel>
												<TextInputFieldSimple
													id={pagesFieldId}
													value={query['pages'] ? String(query['pages']) : ''}
													setValue={(val) => updateQueryUrl('pages', val)}
													placeholder={'1..99'}
												/>
												<p className="text-3xs text-muted mt-1 mb-0">
													Use <code>1..6</code> for ranges, and commas for multiple selections.
												</p>
											</div>

											<div className="grid grid-cols-2 gap-2">
												<div>
													<FormLabel htmlFor={minColFieldId} className="text-2xs text-muted mb-1 block">
														Min Col
													</FormLabel>
													<NumberInputField
														id={minColFieldId}
														value={Number(query['min_col']) || 0}
														setValue={(val) => updateQueryUrl('min_col', val)}
														max={Number(query['max_col']) || gridSize.maxColumn}
														min={gridSize.minColumn}
													/>
												</div>
												<div>
													<FormLabel htmlFor={maxColFieldId} className="text-2xs text-muted mb-1 block">
														Max Col
													</FormLabel>
													<NumberInputField
														id={maxColFieldId}
														value={Number(query['max_col']) || 0}
														setValue={(val) => updateQueryUrl('max_col', val)}
														max={gridSize.maxColumn}
														min={Number(query['min_col']) || gridSize.minColumn}
													/>
												</div>
											</div>

											<div className="grid grid-cols-2 gap-2">
												<div>
													<FormLabel htmlFor={minRowFieldId} className="text-2xs text-muted mb-1 block">
														Min Row
													</FormLabel>
													<NumberInputField
														id={minRowFieldId}
														value={Number(query['min_row']) || 0}
														setValue={(val) => updateQueryUrl('min_row', val)}
														max={Number(query['max_row']) || gridSize.maxRow}
														min={gridSize.minRow}
													/>
												</div>
												<div>
													<FormLabel htmlFor={maxRowFieldId} className="text-2xs text-muted mb-1 block">
														Max Row
													</FormLabel>
													<NumberInputField
														id={maxRowFieldId}
														value={Number(query['max_row']) || 0}
														setValue={(val) => updateQueryUrl('max_row', val)}
														max={gridSize.maxRow}
														min={Number(query['min_row']) || gridSize.minRow}
													/>
												</div>
											</div>
										</div>

										<div className="space-y-2.5 bg-surface-muted/30 p-3 rounded-xl border border-border/70">
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

											<div className="pt-2">
												<FormLabel htmlFor={displayColumnFieldId} className="text-2xs text-muted mb-1 block">
													Display Columns (0 for dynamic)
												</FormLabel>
												<NumberInputField
													id={displayColumnFieldId}
													value={Number(query['display_cols']) || 0}
													setValue={(val) => updateQueryUrl('display_cols', val)}
													min={0}
												/>
											</div>
										</div>
									</div>
								</Form>
							</Modal.Body>
							<Modal.Footer>
								<Modal.Close color="primary">Done</Modal.Close>
							</Modal.Footer>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>

			<div className="absolute top-2 right-2 z-40 flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
				{(!fullscreen || !query['noconfigure']) && !query['nofullscreen'] && (
					<Button
						color="secondary"
						size="sm"
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
					<Button color="secondary" size="sm" onClick={() => setShow(true)} title="Configure">
						<FontAwesomeIcon icon={faCog} />
					</Button>
				)}
			</div>
		</>
	)
}
