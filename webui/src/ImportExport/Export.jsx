import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react'
import { CButton, CForm, CInputCheckbox, CLabel, CModal, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { PreventDefaultHandler } from '../util'

export const ExportWizardModal = forwardRef(function WizardModal(_props, ref) {
	const [show, setShow] = useState(false)
	const [config, setConfig] = useState({})

	const doClose = useCallback(() => {
		setShow(false)
	}, [])

	const doSave = useCallback(
		(e) => {
			e.preventDefault()

			const params = new URLSearchParams()
			for (const [key, value] of Object.entries(config)) {
				params.set(key, value ? '1' : '0')
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

	const setValue = (key, value) => {
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
				})

				setShow(true)
			},
		}),
		[]
	)

	const canExport = Object.values(config).find((v) => !!v)

	return (
		<CModal show={show} onClose={doClose} className={'wizard'} closeOnBackdrop={false}>
			<CForm className={'edit-button-panel'} onSubmit={PreventDefaultHandler}>
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
		</CModal>
	)
})

function ExportOptionsStep({ config, setValue }) {
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
		</div>
	)
}
