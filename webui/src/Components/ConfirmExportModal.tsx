import { observer } from 'mobx-react-lite'
import { forwardRef, useCallback, useContext, useId, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '~/Components/Button'
import { Form, FormLabel } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal'
import { windowLinkOpen } from '~/Helpers/Window.js'
import { ExportFormatDefault, SelectExportFormat } from '~/ImportExport/ExportFormat.js'
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

		const [data, setData] = useState<string | null>(null)
		const [show, setShow] = useState(false)
		const [format, setFormat] = useState(ExportFormatDefault)
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

					// Reset to default filename each time modal is opened
					setFilename(String(defaultExportFilename))
					setIncludeSecrets(true)
				},
			}),
			[defaultExportFilename]
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
								<Form className="row g-3" onSubmit={doAction}>
									<FormLabel htmlFor={exportFormatId} className="col-sm-4 col-form-label col-form-label-sm">
										File format
									</FormLabel>
									<div className="col-sm-8">
										<SelectExportFormat id={exportFormatId} value={format} setValue={setFormat} />
									</div>

									<FormLabel htmlFor={exportNameId} className="col-sm-4 col-form-label col-form-label-sm">
										File name
									</FormLabel>
									<div className="col-sm-8">
										<TextInputField
											id={exportNameId}
											value={filename}
											setValue={setFilename}
											useVariables
											immediateValue
										/>
									</div>

									<FormLabel htmlFor={exportSecretsId} className="col-sm-4 col-form-label col-form-label-sm">
										Include secrets
										<InlineHelpIcon className="ms-1">
											Some connections have secret values that can be omitted from the export. Not all modules are
											compatible with this
										</InlineHelpIcon>
									</FormLabel>
									<div className="col-sm-8 d-flex align-items-center">
										<SwitchInputField id={exportSecretsId} value={includeSecrets} setValue={setIncludeSecrets} />
									</div>
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
