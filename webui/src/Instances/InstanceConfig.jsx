import React from 'react'
import { CompanionContext, socketEmit } from '../util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { CRow, CCol, CButton } from '@coreui/react'

import { ConfigField } from '../Components'

export class InstanceConfig extends React.Component {
	static contextType = CompanionContext

	state = {
		loaded: false,

		helpContent: null,

		label: '',
		configFields: [],
		instanceConfig: {},
		validFields: {},
	}

	componentDidMount() {
		socketEmit(this.context.socket, 'instance_edit', [this.props.instanceId]).then(([_instanceId, configFields, instanceConfig]) => {
			const validFields = {}
			for (const field of configFields) {
				// TODO - validate field
				validFields[field.id] = true
			}

			this.setState({
				loaded: true,
				label: instanceConfig.label,
				configFields: configFields,
				instanceConfig: instanceConfig,
				validFields: validFields,

			})
		}).catch((e) => {
			console.error('Failed to load instance edit info:', e)
		})
	}

	saveConfig = () => {
		// TODO - cleaner error reporting to user
		const isInvalid = Object.values(this.state.validFields).find(v => !v) === false
		if (isInvalid) {
			alert(`New instance config is not valid`)
			return
		}

		socketEmit(this.context.socket, 'instance_config_put', [this.props.instanceId, this.state.instanceConfig]).then(([err, ok]) => {
			if (err) {
				if (err === 'duplicate label') {
					alert(`The label "${this.state.instanceConfig.label}" is already in use. Please use a unique name for this module instance`);
				} else {
					alert(`Unable to save instance config: "${err}"`);
				}
			} else {
				// TODO
			}
		}).catch((e) => {
			alert(`Failed to save instance config: ${e}`)
		})
	}

	setValue = (key, value, isValid) => {
		console.log('set value', key, value)

		const newState = {}
		if (value !== this.state.instanceConfig[key]) {
			newState.instanceConfig = {
				...this.state.instanceConfig,
				[key]: value,
			}
		}
		if (isValid !== this.state.validFields[key]) {
			newState.validFields = {
				...this.state.validFields,
				[key]: isValid,
			}
		}

		if (Object.keys(newState).length > 0) {
			this.setState(newState)
		}
	}
	setValid = (key, isValid) => {
		console.log('set valid', key, isValid)

		this.setState({
			validFields: {
				...this.state.validFields,
				[key]: isValid,
			}
		})
	}

	renderVariablesTable() {
		const label = this.state.label
		const variableDefinitions = this.context.variableDefinitions[label] || []
		const variableValues = this.context.variableValues || {}

		if (variableDefinitions.length > 0) {
			return (
				<CRow>
					<h4>List of dynamic variables</h4>
					<table className="table table-responsive-sm">
						<thead>
							<tr>
								<th>Variable</th>
								<th>Description</th>
								<th>Current value</th>
							</tr>
						</thead>
						<tbody>
							{
								variableDefinitions.map((variable) => <tr key={variable.name}>
									<td>$({label}:{variable.name})</td>
									<td>{variable.label}</td>
									<td>{variableValues[label + ':' + variable.name]}</td>
								</tr>)
							}
						</tbody>
					</table>
				</CRow>
			)
		} else {
			return ''
		}
	}

	render() {
		if (!this.state.loaded) {
			return <p>Loading...</p>
		}

		const { instanceConfig, validFields } = this.state
		const moduleInfo = this.context.modules[instanceConfig.instance_type]

		return <>
			<h4 style={{ textTransform: 'capitalize' }}>
				{
					moduleInfo?.help ? <div className="instance_help" onClick={() => this.props.showHelp(instanceConfig.instance_type)}><FontAwesomeIcon icon={faQuestionCircle} /></div> : ''
				}
				{moduleInfo?.shortname ?? instanceConfig.instance_type} configuration
            </h4>
			<CRow>
				{this.state.configFields.map((field, i) => {
					return (
						<CCol key={i} className={`fieldtype-${field.type}`} sm={field.width}>
							<label>{field.label}</label>
							<ConfigField
								definition={field}
								value={instanceConfig[field.id]}
								valid={validFields[field.id]}
								setValue={(val, valid) => this.setValue(field.id, val, valid)}
								setValid={(valid) => this.setValid(field.id, valid)}
							/>
						</CCol>
					)
				})}
			</CRow>
			<CRow style={{ paddingTop: '12px' }}>
				<CCol xs={12}>
					<CButton color="primary" disabled={Object.values(validFields).find(v => !v) === false} onClick={this.saveConfig}>Apply changes</CButton>
				</CCol>
			</CRow>
			<hr />
			{ this.renderVariablesTable()}
		</>
	}
}