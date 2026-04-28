import { CButton, CButtonGroup, CCol, CForm, CFormLabel, CRow } from '@coreui/react'
import { faCompressArrowsAlt, faCopy, faExpandArrowsAlt, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { CheckboxInputField } from '~/Components/CheckboxInputField.js'
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

	return (
		<div className="editor-grid">
			<div className="cell-header">
				<div className={classNames('cell-header-item', !isCollapsed && 'span-2')}>
					<span className="variable-style">$({fullname})</span>
					<CopyToClipboard text={`$(${fullname})`} onCopy={customVariablesApi.onCopied}>
						<CButton size="sm" title="Copy variable name">
							<FontAwesomeIcon icon={faCopy} color="#d50215" />
						</CButton>
					</CopyToClipboard>
				</div>
				{isCollapsed && (
					<div className="cell-header-item grow">
						<VariableValueDisplay value={value} onCopied={customVariablesApi.onCopied} />
					</div>
				)}
				<div className="cell-header-item">
					<CButtonGroup style={{ float: 'inline-end' }}>
						{isCollapsed ? (
							<CButton onClick={doExpand} size="sm" title="Expand variable view">
								<FontAwesomeIcon icon={faExpandArrowsAlt} />
							</CButton>
						) : (
							<CButton onClick={doCollapse} size="sm" title="Collapse variable view">
								<FontAwesomeIcon icon={faCompressArrowsAlt} />
							</CButton>
						)}

						<CButton onClick={() => customVariablesApi.doDelete(info.id)} size="sm" title="Delete custom variable">
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
					</CButtonGroup>
				</div>
			</div>
			{isCollapsed ? (
				<>
					<div className="variable-description">{info.description}</div>
				</>
			) : (
				<>
					<CForm onSubmit={PreventDefaultHandler} className="cell-fields">
						<div>
							<CFormLabel>
								Persist value
								<InlineHelpIcon className="ms-1">
									If enabled, variable value will be saved and restored when Companion restarts.
								</InlineHelpIcon>
							</CFormLabel>
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
									value={info.persistCurrentValue}
									setValue={(val) => customVariablesApi.setPersistenceValue(info.id, val)}
									inline={true}
								/>
							</div>
						</div>
						<CRow>
							<CFormLabel htmlFor="colFormDescription" className="col-sm-3 align-right">
								Description:
							</CFormLabel>
							<CCol sm={9}>
								<TextInputField
									value={info.description}
									setValue={(description) => customVariablesApi.setDescription(info.id, description)}
									style={{ marginBottom: '0.5rem' }}
								/>
							</CCol>

							<CFormLabel htmlFor="colFormCurrentValue" className="col-sm-3 align-right">
								Current value:
							</CFormLabel>
							<CCol sm={9}>
								<VariableInputGroup value={value} name={info.id} setCurrentValue={customVariablesApi.setCurrentValue} />
							</CCol>

							<CFormLabel htmlFor="colFormStartupValue" className="col-sm-3 align-right">
								Startup value:
							</CFormLabel>
							<CCol sm={9}>
								<VariableInputGroup
									disabled={!!info.persistCurrentValue}
									value={info.defaultValue}
									name={info.id}
									setCurrentValue={customVariablesApi.setStartupValue}
								/>
							</CCol>
						</CRow>
					</CForm>
				</>
			)}
		</div>
	)
})
