import { CCol, CRow } from '@coreui/react'
import { faCompressArrowsAlt, faCopy, faExpandArrowsAlt, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useId } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { InlineHelpIcon } from '~/Components/InlineHelp'
import { TextInputField } from '~/Components/TextInputField.js'
import VariableInputGroup from '~/Components/VariableInputGroup.js'
import { VariableValueDisplay } from '~/Components/VariableValueDisplay.js'
import { usePanelCollapseHelperContext } from '~/Helpers/CollapseHelper.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import type { CustomVariableDefinitionExt } from './CustomVariablesList'
import { useCustomVariablesTableContext } from './CustomVariablesTableContext'

interface CustomVariableRowProps {
	info: CustomVariableDefinitionExt
}

export const CustomVariableRow = observer(function CustomVariableRow({ info }: CustomVariableRowProps) {
	const fullname = `custom:${info.id}`

	const { customVariablesApi, customVariableValues } = useCustomVariablesTableContext()
	const panelCollapseHelper = usePanelCollapseHelperContext()

	const doCollapse = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(info.id, true),
		[panelCollapseHelper, info.id]
	)
	const doExpand = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(info.id, false),
		[panelCollapseHelper, info.id]
	)
	// Don't consider the collection as the parent, as the contents doesn't want to follow the collapse state of the collection
	const isCollapsed = panelCollapseHelper.isPanelCollapsed(null, info.id)

	const value = customVariableValues.get(info.id)

	const persistFieldId = useId()
	const descriptionFieldId = useId()
	const currentValueFieldId = useId()
	const startupValueFieldId = useId()

	return (
		<div className="editor-grid">
			<div className="cell-header">
				<div className={classNames('cell-header-item', !isCollapsed && 'span-2')}>
					<span className="variable-style">$({fullname})</span>
					<CopyToClipboard text={`$(${fullname})`} onCopy={customVariablesApi.onCopied}>
						<Button size="sm" title="Copy variable name">
							<FontAwesomeIcon icon={faCopy} color="#d50215" />
						</Button>
					</CopyToClipboard>
				</div>
				{isCollapsed && (
					<div className="cell-header-item grow">
						<VariableValueDisplay value={value} onCopied={customVariablesApi.onCopied} />
					</div>
				)}
				<div className="cell-header-item">
					<ButtonGroup className="float-end">
						{isCollapsed ? (
							<Button onClick={doExpand} size="sm" title="Expand variable view">
								<FontAwesomeIcon icon={faExpandArrowsAlt} />
							</Button>
						) : (
							<Button onClick={doCollapse} size="sm" title="Collapse variable view">
								<FontAwesomeIcon icon={faCompressArrowsAlt} />
							</Button>
						)}

						<Button onClick={() => customVariablesApi.doDelete(info.id)} size="sm" title="Delete custom variable">
							<FontAwesomeIcon icon={faTrash} />
						</Button>
					</ButtonGroup>
				</div>
			</div>
			{isCollapsed ? (
				<>
					<div className="variable-description">{info.description}</div>
				</>
			) : (
				<>
					<Form onSubmit={PreventDefaultHandler} className="cell-fields">
						<div>
							<FormLabel htmlFor={persistFieldId}>
								Persist value
								<InlineHelpIcon className="ms-1">
									If enabled, variable value will be saved and restored when Companion restarts.
								</InlineHelpIcon>
							</FormLabel>
							<div
								style={{
									display: 'inline-flex',
									alignItems: 'center',
									verticalAlign: 'middle',
									marginLeft: '1em',
									paddingBottom: '.5em',
									paddingTop: '.3em',
								}}
							>
								<CheckboxInputField
									id={persistFieldId}
									value={info.persistCurrentValue}
									setValue={(val) => customVariablesApi.setPersistenceValue(info.id, val)}
								/>
							</div>
						</div>
						<CRow>
							<FormLabel htmlFor={descriptionFieldId} className="col-sm-3 align-right">
								Description:
							</FormLabel>
							<CCol sm={9}>
								<TextInputField
									id={descriptionFieldId}
									value={info.description}
									setValue={(description) => customVariablesApi.setDescription(info.id, description)}
									className="mb-2"
								/>
							</CCol>

							<FormLabel htmlFor={currentValueFieldId} className="col-sm-3 align-right">
								Current value:
							</FormLabel>
							<CCol sm={9}>
								<VariableInputGroup
									id={currentValueFieldId}
									value={value}
									name={info.id}
									setCurrentValue={customVariablesApi.setCurrentValue}
								/>
							</CCol>

							<FormLabel htmlFor={startupValueFieldId} className="col-sm-3 align-right">
								Startup value:
							</FormLabel>
							<CCol sm={9}>
								<VariableInputGroup
									id={startupValueFieldId}
									disabled={!!info.persistCurrentValue}
									value={info.defaultValue}
									name={info.id}
									setCurrentValue={customVariablesApi.setStartupValue}
								/>
							</CCol>
						</CRow>
					</Form>
				</>
			)}
		</div>
	)
})
