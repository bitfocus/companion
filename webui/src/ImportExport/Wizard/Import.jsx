import React, { useEffect, useState } from 'react'
import Classnames from 'classnames'
import { CCol, CInputCheckbox, CLabel, CSelect } from '@coreui/react'
import { useCallback } from 'react'
import { useContext } from 'react'
import { InstancesContext, ModulesContext, SocketContext, socketEmitPromise } from '../../util'
import { CreateBankControlId } from '@companion/shared/ControlId'
import { MAX_COLS, MAX_ROWS } from '../../Constants'
import { ButtonPreview, dataToButtonImage } from '../../Components/ButtonPreview'

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
			<ButtonImportGrid page={snapshot?.oldPageNumber ?? null} />

			<hr />

			<h5>Destination Page</h5>
		</div>
	)
}

export function ImportRemap({ snapshot, instanceRemap, setInstanceRemap }) {
	const modules = useContext(ModulesContext)
	const instancesContext = useContext(InstancesContext)

	return (
		<div id="import_resolve">
			<h5>Link config connections with local connections</h5>

			<table className="table table-responsive-sm">
				<thead>
					<tr>
						<th>Select connection</th>
						<th>Config connection type</th>
						<th>Config connection name</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(snapshot.instances || {}).map(([key, instance]) => {
						const snapshotModule = modules[instance.instance_type]
						const currentInstances = Object.entries(instancesContext).filter(
							([id, inst]) => inst.instance_type === instance.instance_type
						)

						return (
							<tr>
								<td>
									{snapshotModule ? (
										<CSelect value={instanceRemap[key] ?? ''} onChange={(e) => setInstanceRemap(key, e.target.value)}>
											<option value="">[ Create new connection ]</option>
											{currentInstances.map(([id, inst]) => (
												<option key={id} value={id}>
													{inst.label}
												</option>
											))}
										</CSelect>
									) : (
										'Ignored'
									)}
								</td>
								<td>{snapshotModule ? snapshotModule.name : `Unknown module (${instance.instance_type})`}</td>
								<td>{instance.label}</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

function ButtonImportGrid({ page }) {
	return (
		<>
			{Array(MAX_ROWS)
				.fill(0)
				.map((_, y) => {
					return (
						<CCol key={y} className="pagebank-row">
							{Array(MAX_COLS)
								.fill(0)
								.map((_, x) => {
									const index = y * MAX_COLS + x + 1
									return (
										<ButtonImportPreview key={x} controlId={CreateBankControlId(page, index)} alt={`Button ${index}`} />
									)
								})}
						</CCol>
					)
				})}
		</>
	)
}

function ButtonImportPreview({ controlId, instanceId, ...childProps }) {
	const socket = useContext(SocketContext)
	const [previewImage, setPreviewImage] = useState(null)

	useEffect(() => {
		setPreviewImage(null)

		socketEmitPromise(socket, 'loadsave:control-preview', [controlId])
			.then((img) => {
				setPreviewImage(img ? dataToButtonImage(img) : null)
			})
			.catch((e) => {
				console.error(`Failed to preview bank: ${e}`)
			})
	}, [controlId, socket])

	return <ButtonPreview {...childProps} preview={previewImage} />
}
