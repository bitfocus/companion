import { observer } from 'mobx-react-lite'
import { forwardRef, useCallback, useContext, useId, useImperativeHandle, useRef, useState } from 'react'
import { ExportFormatDefault } from '@companion-app/shared/Model/ExportFormat.js'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { Modal } from '~/Components/Modal'
import { windowLinkOpen } from '~/Helpers/Window.js'
import { SelectExportFormat } from '~/ImportExport/ExportFormat.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { InlineHelpIcon } from './InlineHelp.js'
import { SwitchInputField } from './SwitchInputField.js'
import { TextInputField } from './TextInputField.js'

export interface ConfirmExportModalRef {
	show(url: string): void
}

interface ConfirmExportModalProps {
	title: string
}

export const ConfirmExportModal = observer(
	forwardRef<ConfirmExportModalRef, ConfirmExportModalProps>(function ConfirmExportModal(props, ref) {
		const { userConfig } = useContext(RootAppStoreContext)

		const defaultExportFormat = userConfig.properties?.default_export_format ?? ExportFormatDefault

		const [data, setData] = useState<string | null>(null)
		const [show, setShow] = useState(false)
		const [format, setFormat] = useState(defaultExportFormat)
		const [filename, setFilename] = useState<string>('')
		const [includeSecrets, setIncludeSecrets] = useState<boolean>(true)

		const buttonRef = useRef<HTMLButtonElement>(null)

		const doAction = useCallback(() => {
			setData(null)
			setShow(false)

			if (data) {
				const url = new URL(data, window.location.origin)
				url.searchParams.set('format', format)
				url.searchParams.set('filename', filename)
				url.searchParams.set('includeSecrets', includeSecrets ? 'true' : 'false')

				windowLinkOpen({ href: url.toString() })
			}
		}, [data, format, filename, includeSecrets])

		const defaultExportFilename = userConfig.properties?.default_export_filename ?? ''
		useImperativeHandle(
			ref,
			() => ({
				show(url) {
					setData(url)
					setShow(true)

					// Reset to defaults each time modal is opened
					setFormat(defaultExportFormat)
					setFilename(String(defaultExportFilename))
					setIncludeSecrets(true)
				},
			}),
			[defaultExportFilename, defaultExportFormat]
		)

		const exportFormatId = useId()
		const exportNameId = useId()
		const exportSecretsId = useId()

		const onOpenChangeComplete = useCallback((open: boolean) => {
			// Clear data
			if (!open) setData(null)
		}, [])

		return (
			<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup initialFocus={buttonRef}>
							<Modal.Header closeButton>
								<Modal.Title>{props.title}</Modal.Title>
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
								</Form>
							</Modal.Body>
							<Modal.Footer>
								<Modal.Close>Cancel</Modal.Close>
								<Button ref={buttonRef} color="primary" onClick={doAction}>
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
