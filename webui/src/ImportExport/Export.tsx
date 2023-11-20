import React, { FormEvent, forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { CButton, CForm, CInputCheckbox, CLabel, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { PreventDefaultHandler } from '../util'
import { ExportFormatDefault, SelectExportFormat } from './ExportFormat'
import { MenuPortalContext } from '../Components/DropdownInputField'
import { ClientExportSelection } from '@companion/shared/Model/ImportExport'

interface ExportWizardModalProps {}
export interface ExportWizardModalRef {
	show(): void
}

export const ExportWizardModal = forwardRef<ExportWizardModalRef, ExportWizardModalProps>(
	function ExportWizardModal(_props, ref) {
		const [show, setShow] = useState(false)
		const [config, setConfig] = useState<ClientExportSelection>({
			connections: true,
			buttons: true,
			surfaces: true,
			triggers: true,
			customVariables: true,
			// userconfig: true,
			format: ExportFormatDefault,
		})

		const doClose = useCallback(() => {
			setShow(false)
		}, [])

		const doSave = useCallback(
			(e: FormEvent) => {
				e.preventDefault()

				const params = new URLSearchParams()
				for (const [key, value] of Object.entries(config)) {
					if (typeof value === 'boolean') {
						params.set(key, value ? '1' : '0')
					} else {
						params.set(key, value + '')
					}
				}

				const link = document.createElement('a')
				link.setAttribute('download', 'export.companionconfig')
				link.href = `/int/export/custom?${params}`
				document.body.appendChild(link)
				link.click()
				link.remove()

				doClose()
			},
			[config, doClose]
		)

		const setValue = (key: keyof ClientExportSelection, value: any) => {
			setConfig((oldState) => ({
				...oldState,
				[key]: value,
			}))
		}

		useImperativeHandle(
			ref,
			() => ({
				show() {
					setConfig({
						connections: true,
						buttons: true,
						surfaces: true,
						triggers: true,
						customVariables: true,
						// userconfig: true,
						format: ExportFormatDefault,
					})

					setShow(true)
				},
			}),
			[]
		)

		const canExport = Object.values(config).find((v) => !!v)

		const [modalRef, setModalRef] = useState(null)

		return (
			<CModal innerRef={setModalRef} show={show} onClose={doClose} className={'wizard'} closeOnBackdrop={false}>
				<MenuPortalContext.Provider value={modalRef}>
					<CForm className={'flex-form'} onSubmit={PreventDefaultHandler}>
						<CModalHeader>
							<h2>
								<img src="/img/icons/48x48.png" height="30" alt="logo" />
								Export Configuration
							</h2>
						</CModalHeader>
						<CModalBody>
							<ExportOptionsStep config={config} setValue={setValue} />
						</CModalBody>
						<CModalFooter>
							<CButton color="secondary" onClick={doClose}>
								Close
							</CButton>
							<CButton color="primary" onClick={doSave} disabled={!canExport}>
								Download
							</CButton>
						</CModalFooter>
					</CForm>
				</MenuPortalContext.Provider>
			</CModal>
		)
	}
)

interface ExportOptionsStepProps {
	config: ClientExportSelection
	setValue: (key: keyof ClientExportSelection, value: any) => void
}

function ExportOptionsStep({ config, setValue }: ExportOptionsStepProps) {
	return (
		<div>
			<h5>Export Options</h5>
			<p>Please select the components you'd like to export.</p>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="wizard_connections"
						checked={config.connections}
						onChange={(e) => setValue('connections', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="wizard_connections">Connections</CLabel>
				</div>
				{/* {!config.connections && (config.buttons || config.triggers) && (
					<CAlert color="warning">
						Any connections referenced by buttons or triggers will still be included in the export, with the config
						options removed.
					</CAlert>
				)} */}
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="wizard_buttons"
						checked={config.buttons}
						onChange={(e) => setValue('buttons', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="wizard_buttons">Buttons</CLabel>
				</div>
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="wizard_triggers"
						checked={config.triggers}
						onChange={(e) => setValue('triggers', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="wizard_triggers">Triggers</CLabel>
				</div>
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="wizard_custom_variables"
						checked={config.customVariables}
						onChange={(e) => setValue('customVariables', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="wizard_custom_variables">Custom Variables</CLabel>
				</div>
			</div>
			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="wizard_surfaces"
						checked={config.surfaces}
						onChange={(e) => setValue('surfaces', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="wizard_surfaces">Surfaces</CLabel>
				</div>
			</div>
			{/* <div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CInputCheckbox
						id="wizard_userconfig"
						checked={config.userconfig}
						onChange={(e) => setValue('userconfig', e.currentTarget.checked)}
					/>
					<CLabel htmlFor="wizard_userconfig">Settings</CLabel>
				</div>
			</div> */}

			<div className="indent3">
				<div className="form-check form-check-inline mr-1">
					<CLabel htmlFor="file_format">File format</CLabel>
					&nbsp;
					<SelectExportFormat value={config.format} setValue={(val) => setValue('format', val)} />
				</div>
			</div>
		</div>
	)
}
