import React, { useEffect, useState } from 'react'
import Classnames from 'classnames'
import { CCol, CInputCheckbox, CLabel, CSelect } from '@coreui/react'
import { useCallback } from 'react'

function InputCheckbox({ config, allowKeys, keyName, setValue, label }) {
	const disabled = allowKeys && !allowKeys.includes(keyName)

	const setValue2 = useCallback((e) => setValue(keyName, !!e.currentTarget.checked), [setValue, keyName])

	return (
		<div className="indent3">
			<div className="form-check form-check-inline mr-1">
				<CInputCheckbox
					id="wizard_connections"
					checked={!disabled && !!config[keyName]}
					onChange={setValue2}
					disabled={disabled}
				/>
				<CLabel
					htmlFor="wizard_connections"
					className={Classnames({
						disabled: disabled,
					})}
				>
					{label}
				</CLabel>
			</div>
		</div>
	)
}

export function ImportOptionsStep({ config, setValue, snapshotKeys }) {
	return (
		<div>
			<h5>Import Options</h5>
			<p>Please select the components you'd like to import.</p>

			<InputCheckbox
				config={config}
				allowKeys={snapshotKeys}
				keyName="connections"
				setValue={setValue}
				label="Connections"
			/>

			<InputCheckbox config={config} allowKeys={snapshotKeys} keyName="buttons" setValue={setValue} label="Buttons" />

			<InputCheckbox config={config} allowKeys={snapshotKeys} keyName="triggers" setValue={setValue} label="Triggers" />

			<InputCheckbox
				config={config}
				allowKeys={snapshotKeys}
				keyName="customVariables"
				setValue={setValue}
				label="Custom Variables"
			/>

			<InputCheckbox config={config} allowKeys={snapshotKeys} keyName="surfaces" setValue={setValue} label="Surfaces" />

			{/* <InputCheckbox
				config={config}
				allowKeys={snapshotKeys}
				keyName="userconfig"
				setValue={setValue}
				label="Settings"
			/> */}
		</div>
	)
}

// export function ResetApplyStep({ config }) {
// 	const changes = []

// 	if (config.connections && !config.buttons && !config.triggers) {
// 		changes.push(<li key="connections">All connections including their actions, feedbacks, and triggers.</li>)
// 	} else if (config.connections && !config.buttons) {
// 		changes.push(<li key="connections">All connections including their button actions and feedbacks.</li>)
// 	} else if (config.connections && !config.triggers) {
// 		changes.push(<li key="connections">All connections including their triggers and trigger actions.</li>)
// 	} else if (config.connections) {
// 		changes.push(<li key="connections">All connections.</li>)
// 	}

// 	if (config.buttons) {
// 		changes.push(<li key="buttons">All button styles, actions, and feedbacks.</li>)
// 	}

// 	if (config.surfaces) {
// 		changes.push(<li key="surfaces">All surface settings.</li>)
// 	}

// 	if (config.triggers) {
// 		changes.push(<li key="triggers">All triggers.</li>)
// 	}

// 	if (config.customVariables) {
// 		changes.push(<li key="custom-variables">All custom variables.</li>)
// 	}

// 	if (config.userconfig) {
// 		changes.push(<li key="userconfig">All settings, including enabled remote control services.</li>)
// 	}

// 	if (changes.length === 0) {
// 		changes.push(<li key="no-change">No changes to the configuration will be made.</li>)
// 	}

// 	return (
// 		<div>
// 			<h5>Review Changes</h5>
// 			<p>The following data will be reset:</p>
// 			<ul>{changes}</ul>
// 			{changes.length > 0 ? <CAlert color="danger">Proceeding will permanently clear the above data.</CAlert> : ''}
// 		</div>
// 	)
// }

// export function ResetFinishStep({ applyError }) {
// 	return (
// 		<div>
// 			{applyError ? (
// 				<>
// 					<CAlert color="danger">
// 						<p>Reset failed with error:</p>
// 						<p>{applyError}</p>
// 					</CAlert>
// 				</>
// 			) : (
// 				<>
// 					<p>Configuration has been successfully reset</p>
// 				</>
// 			)}
// 		</div>
// 	)
// }

export function ImportPageSelectionStep({ config, setValue, snapshot }) {
	return (
		<div>
			<h5>Import Page</h5>
			{/* <ButtonImportGrid page={snapshot?.oldPageNumber ?? null} /> */}

			<hr />

			<h5>Destination Page</h5>
		</div>
	)
}
