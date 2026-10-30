import { observer } from 'mobx-react-lite'
import { forwardRef, useCallback, useContext, useId, useImperativeHandle, useRef, useState } from 'react'
import { ExportFormatDefault } from '@companion-app/shared/Model/ExportFormat.js'
import { EXPORT_NOTES_MAX_LENGTH, type ClientExportTarget } from '@companion-app/shared/Model/ImportExport.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { assertNever } from '@companion-app/shared/Util.js'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { Modal } from '~/Components/Modal'
import { SelectExportFormat } from '~/ImportExport/ExportFormat.js'
import { useExportDownload } from '~/ImportExport/useExportDownload.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { InlineHelpIcon } from './InlineHelp.js'
import { SwitchInputField } from './SwitchInputField.js'
import { TextInputField } from './TextInputField.js'

/** What to export; whether to include secrets is chosen in the modal */
export type ConfirmExportTarget = DistributiveOmit<Exclude<ClientExportTarget, { type: 'custom' }>, 'includeSecrets'>
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export interface ConfirmExportModalRef {
	show(target: ConfirmExportTarget): void
}

export const ConfirmExportModal = observer(
	forwardRef<ConfirmExportModalRef>(function ConfirmExportModal(_props, ref) {
		const { userConfig, notifier } = useContext(RootAppStoreContext)

		const defaultExportFormat = userConfig.properties?.default_export_format ?? ExportFormatDefault

		const [target, setTarget] = useState<ConfirmExportTarget | null>(null)
		const [show, setShow] = useState(false)
		const [format, setFormat] = useState(defaultExportFormat)
		const [filename, setFilename] = useState<string>('')
		const [includeSecrets, setIncludeSecrets] = useState<boolean>(true)
		const [notes, setNotes] = useState<string>('')
		const notesValid = notes.length <= EXPORT_NOTES_MAX_LENGTH

		const buttonRef = useRef<HTMLButtonElement>(null)

		const exportDownload = useExportDownload()
		const doAction = useCallback(() => {
			if (!target || !notesValid) return

			exportDownload({
				target: { ...target, includeSecrets },
				output: { format, filename, notes },
			})
				.then(() => setShow(false))
				.catch((e) => {
					notifier.show('Export failed', stringifyError(e), 10000)
				})
		}, [exportDownload, notifier, target, format, filename, includeSecrets, notes, notesValid])

		const defaultExportFilename = userConfig.properties?.default_export_filename ?? ''
		useImperativeHandle(
			ref,
			() => ({
				show(target) {
					setTarget(target)
					setShow(true)

					// Reset to defaults each time modal is opened
					setFormat(defaultExportFormat)
					setFilename(String(defaultExportFilename))
					setIncludeSecrets(true)
					setNotes('')
				},
			}),
			[defaultExportFilename, defaultExportFormat]
		)

		const exportFormatId = useId()
		const exportNameId = useId()
		const exportSecretsId = useId()
		const exportNotesId = useId()

		const onOpenChangeComplete = useCallback((open: boolean) => {
			// Clear data
			if (!open) setTarget(null)
		}, [])

		return (
			<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup initialFocus={buttonRef}>
							<Modal.Header closeButton>
								<Modal.Title>{target ? getExportTitle(target) : 'Export'}</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<Form row className="gap-4" onSubmit={doAction}>
									<FormLabel htmlFor={exportFormatId} sm={4} column="sm">
										File format
									</FormLabel>
									<Grid.Col sm={8}>
										<SelectExportFormat id={exportFormatId} value={format} setValue={setFormat} />
									</Grid.Col>

									<FormLabel htmlFor={exportNameId} sm={4} column="sm">
										File name
									</FormLabel>
									<Grid.Col sm={8}>
										<TextInputField
											id={exportNameId}
											value={filename}
											setValue={setFilename}
											useVariables
											immediateValue
										/>
									</Grid.Col>

									<FormLabel htmlFor={exportSecretsId} sm={4} column="sm">
										Include secrets
										<InlineHelpIcon className="ms-1">
											Some connections have secret values that can be omitted from the export. Not all modules are
											compatible with this
										</InlineHelpIcon>
									</FormLabel>
									<Grid.Col sm={8} className="flex items-center">
										<SwitchInputField id={exportSecretsId} value={includeSecrets} setValue={setIncludeSecrets} />
									</Grid.Col>

									<FormLabel htmlFor={exportNotesId} sm={4} column="sm">
										Notes
										<InlineHelpIcon className="ms-1">Shown to whoever imports this file</InlineHelpIcon>
									</FormLabel>
									<Grid.Col sm={8}>
										<TextInputField
											id={exportNotesId}
											value={notes}
											setValue={setNotes}
											checkValid={() => (notesValid ? undefined : false)}
											placeholder="Optional. Describe what changed"
											multiline
											immediateValue
										/>
									</Grid.Col>
								</Form>
							</Modal.Body>
							<Modal.Footer>
								<Modal.Close>Cancel</Modal.Close>
								<Button ref={buttonRef} color="primary" onClick={doAction} disabled={!notesValid}>
									Export
								</Button>
							</Modal.Footer>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	})
)

function getExportTitle(target: ConfirmExportTarget): string {
	switch (target.type) {
		case 'page':
			return `Export Page ${target.pageNumber}`
		case 'triggers':
			return 'Export Triggers'
		case 'trigger':
			return 'Export Trigger'
		default:
			assertNever(target)
			return 'Export'
	}
}
