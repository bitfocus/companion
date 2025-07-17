import React, { FormEvent, forwardRef, useCallback, useImperativeHandle, useState, useContext } from 'react'
import { CButton, CForm, CFormCheck, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { makeAbsolutePath, PreventDefaultHandler } from '~/Resources/util.js'
import { ExportFormatDefault, SelectExportFormat } from './ExportFormat.js'
import { MenuPortalContext } from '~/Components/MenuPortalContext.js'
import { ClientExportSelection } from '@companion-app/shared/Model/ImportExport.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { observer } from 'mobx-react-lite'

export interface ExportWizardModalRef {
	show(): void
}

export const ExportWizardModal = observer(
	forwardRef<ExportWizardModalRef>(function ExportWizardModal(_props, ref) {
		const { userConfig } = useContext(RootAppStoreContext)

		const [show, setShow] = useState(false)
		const [config, setConfig] = useState<ClientExportSelection>({
			connections: true,
			buttons: true,
			surfaces: true,
			triggers: true,
			customVariables: true,
			// userconfig: true,
			format: ExportFormatDefault,
			filename: userConfig.properties?.default_export_filename,
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
				link.href = makeAbsolutePath(`/int/export/custom?${params}`)
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

		const defaultExportFilename = userConfig.properties?.default_export_filename ?? ''

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
						filename: defaultExportFilename,
					})

					setShow(true)
				},
			}),
			[defaultExportFilename]
		)

		const canExport = Object.values(config).find((v) => !!v)

		const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null)

		return (
			<CModal ref={setModalRef} visible={show} onClose={doClose} className={'wizard'} backdrop="static">
				<MenuPortalContext.Provider value={modalRef}>
					<CForm className={'flex-form'} onSubmit={PreventDefaultHandler}>
						<CModalHeader>
							<h2>
								<img src={makeAbsolutePath('/img/icons/48x48.png')} height="30" alt="logo" />
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
	})
)

interface ExportOptionsStepProps {
	config: ClientExportSelection
	setValue: (key: keyof ClientExportSelection, value: any) => void
}

function ExportOptionsStep({ config, setValue }: ExportOptionsStepProps) {
	const updateProp = useCallback((val: string) => setValue('filename', val), [setValue])
	return (
		<div>
			<h5>Export Options</h5>
			<p>Please select the components you'd like to export:</p>
			<div className="indent3">
				<CFormCheck
					id="wizard_connections"
					checked={config.connections}
					onChange={(e) => setValue('connections', e.currentTarget.checked)}
					label="Connections"
				/>
				{/* {!config.connections && (config.buttons || config.triggers) && (
					<CAlert color="warning">
						Any connections referenced by buttons or triggers will still be included in the export, with the config
						options removed.
					</CAlert>
				)} */}
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.buttons}
					onChange={(e) => setValue('buttons', e.currentTarget.checked)}
					label="Buttons"
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.triggers}
					onChange={(e) => setValue('triggers', e.currentTarget.checked)}
					label="Triggers"
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.customVariables}
					onChange={(e) => setValue('customVariables', e.currentTarget.checked)}
					label="Custom Variables"
				/>
			</div>
			<div className="indent3">
				<CFormCheck
					checked={config.surfaces}
					onChange={(e) => setValue('surfaces', e.currentTarget.checked)}
					label="Surfaces"
				/>
			</div>
			{/* <div className="indent3">
				<CFormCheck
					checked={config.userconfig}
					onChange={(e) => setValue('userconfig', e.currentTarget.checked)}
					label='Settings'
				/>
			</div> */}
			<div style={{ paddingTop: '1em' }}>
				<SelectExportFormat value={config.format} setValue={(val) => setValue('format', val)} label="File format" />
			</div>
			<div style={{ paddingTop: '1em' }}>
				<TextInputField value={String(config.filename)} setValue={updateProp} label="File name" useVariables={true} />
			</div>
		</div>
	)
}
