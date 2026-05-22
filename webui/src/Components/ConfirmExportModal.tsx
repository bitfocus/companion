import { CCol, CForm, CFormLabel, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { forwardRef, useCallback, useContext, useImperativeHandle, useRef, useState } from 'react'
import { Button } from '~/Components/Button'
import { windowLinkOpen } from '~/Helpers/Window.js'
import { ExportFormatDefault, SelectExportFormat } from '~/ImportExport/ExportFormat.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { InlineHelpIcon } from './InlineHelp.js'
import { MenuPortalContext } from './MenuPortalContext.js'
import { SwitchInputField } from './SwitchInputField.js'
import { TextInputField } from './TextInputField.js'

export interface ConfirmExportModalRef {
	show(url: string): void
}

interface ConfirmExportModalProps {
	title?: string
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

		const buttonFocus = () => {
			setTimeout(() => {
				if (buttonRef.current) {
					buttonRef.current.focus()
				}
			}, 500)
		}

		const doClose = useCallback(() => {
			setShow(false)

			// Delay clearing the data so the modal can animate out
			setTimeout(() => {
				setData(null)
			}, 1500)
		}, [])
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

					// Focus the button asap. It also gets focused once the open is complete
					setTimeout(buttonFocus, 50)
				},
			}),
			[defaultExportFilename]
		)

		const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null)

		return (
			<CModal ref={setModalRef} visible={show} onClose={doClose} onShow={buttonFocus}>
				<MenuPortalContext.Provider value={modalRef}>
					<CModalHeader closeButton>
						<h5>{props.title}</h5>
					</CModalHeader>
					<CModalBody>
						<CForm className="row g-3" onSubmit={doAction}>
							<CFormLabel htmlFor="colFormLabelSm" className="col-sm-4 col-form-label col-form-label-sm">
								File format
							</CFormLabel>
							<CCol sm={8}>
								<SelectExportFormat value={format} setValue={setFormat} />
							</CCol>
							<CFormLabel htmlFor="colFormLabelSm" className="col-sm-4 col-form-label col-form-label-sm">
								File name
							</CFormLabel>
							<CCol sm={8}>
								<TextInputField value={filename} setValue={setFilename} useVariables={true} />
							</CCol>
							<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
								Include secrets
								<InlineHelpIcon className="ms-1">
									Some connections have secret values that can be omitted from the export. Not all modules are
									compatible with this
								</InlineHelpIcon>
							</CFormLabel>
							<CCol sm={8} className="d-flex align-items-center">
								<SwitchInputField id="export_include_secrets" value={includeSecrets} setValue={setIncludeSecrets} />
							</CCol>
						</CForm>
					</CModalBody>
					<CModalFooter>
						<Button color="secondary" onClick={doClose}>
							Cancel
						</Button>
						<Button ref={buttonRef} color="primary" onClick={doAction}>
							Export
						</Button>
					</CModalFooter>
				</MenuPortalContext.Provider>
			</CModal>
		)
	})
)
