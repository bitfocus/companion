import React, { useState } from 'react'
// import { CompanionVariableValues } from '@companion-module/base'
import { VARIABLE_UNKNOWN_VALUE } from '~/Constants.js'
import { VariableTypeIcon } from './VariableTypeIcon.js'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopy } from '@fortawesome/free-solid-svg-icons'
import { CButton } from '@coreui/react'
import { PanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'

interface VariableValueDisplay {
	/** Value to show */
	value: any

	/** An optional collaps helper for collapsing all items in the list, falls back to local state if omitted */
	panelCollapseHelper?: PanelCollapseHelperLite

	/** Needed for the collapse helper, ID of this panel */
	collapsePanelId?: string

	/** Show a type annotation icon, optional, defaults to true */
	showIcon?: boolean

	/** Show the copy to clipboard button, optional, defaults to true */
	showCopy?: boolean

	/** Use a specific icon for type annotation, optional, by default the icon is derived from the value type */
	icon?: string

	/** Will be called when copy is clicked, optional */
	onCopied: () => void

	[prop: string]: any
}

const TRUNCATE_LENGHT = 100

export const VariableValueDisplay: React.FC<VariableValueDisplay> = ({
	value,
	panelCollapseHelper,
	collapsePanelId,
	showIcon = true,
	showCopy = true,
	icon,
	onCopied = () => {},
	...props
}) => {
	// Use the collapseHelper if we have all neccessary information, otherwise use loal state
	let collapser: { isPanelCollapsed: () => boolean; setPanelCollapsed: (b: boolean) => void }
	let collapsed: boolean = true,
		setCollapsed: React.Dispatch<React.SetStateAction<boolean>>
	;[collapsed, setCollapsed] = useState(true)
	let useCollapseHelper: boolean
	if (panelCollapseHelper && collapsePanelId) {
		collapser = {
			isPanelCollapsed: () => panelCollapseHelper.isPanelCollapsed(collapsePanelId ?? ''),
			setPanelCollapsed: (val: boolean) => {
				panelCollapseHelper.setPanelCollapsed(collapsePanelId ?? '', val)
				setCollapsed(val)
			},
		}
		useCollapseHelper = true
	} else {
		useCollapseHelper = false
		collapser = {
			isPanelCollapsed: () => collapsed,
			setPanelCollapsed: (val: boolean) => {
				setCollapsed(val)
			},
		}
	}

	collapsePanelId ??= ''

	let valueStr: string
	if (typeof value === 'string') valueStr = value
	else if (value === undefined) valueStr = VARIABLE_UNKNOWN_VALUE
	else valueStr = JSON.stringify(value, undefined, '\t') ?? VARIABLE_UNKNOWN_VALUE

	const compactValue = valueStr.length > TRUNCATE_LENGHT ? `${valueStr.substring(0, TRUNCATE_LENGHT)}...` : valueStr

	let displayValue =
		(useCollapseHelper && collapser.isPanelCollapsed()) || (!useCollapseHelper && collapsed) ? compactValue : valueStr

	const elms: Array<string | JSX.Element> = []
	const lines = displayValue.split('\\n')
	lines.forEach((l, i) => {
		elms.push(l)
		if (i <= lines.length - 2) {
			elms.push(<br key={i} />)
		}
	})

	let color = '#0000c8'
	let backgroundColor = '#e5e5f9'

	// Use optional colors from style, remove them and reinject it into children
	if (props?.style?.color) {
		color = props.style.color
		delete props.style.color
	}
	if (props?.style?.backgroundColor) {
		backgroundColor = props.style.backgroundColor
		delete props.style.backgroundColor
	}

	let typeDescription = 'unknown'
	let iconPath = 'unknown'
	if (icon === 'string' || typeof value === 'string') {
		iconPath = 'string'
		typeDescription = 'Text string'
	} else if (icon === 'undefined' || value === undefined) {
		iconPath = 'undefined'
		typeDescription = 'Undefined'
	} else if (icon === 'null' || value === null) {
		iconPath = 'null'
		typeDescription = 'Null'
	} else if (icon === 'NaN' || (typeof value === 'number' && isNaN(value))) {
		iconPath = 'NaN'
		typeDescription = 'Not a Number'
	} else if (icon === 'number' || typeof value === 'number') {
		iconPath = 'number'
		typeDescription = 'Numeric value'
	} else if (icon === 'boolean' || typeof value === 'boolean') {
		iconPath = 'boolean'
		typeDescription = 'Boolean value'
	} else if (icon === 'object' || typeof value === 'object') {
		iconPath = 'object'
		typeDescription = 'JSON Object or Array'
	}

	const btnstyle = { marginLeft: '4px', borderRadius: '4px' }

	return (
		<div className="variable-value-display" {...props}>
			<div style={{ display: 'flex', alignItems: 'center' }}>
				<div
					style={{
						backgroundColor,
						color,
						borderRadius: '6px',
						padding: '4px 12px',
						display: 'inline-table',
						lineHeight: '14px',
					}}
				>
					{showIcon && (
						<span
							style={{
								padding: '4px',
								paddingLeft: '6px',
								display: 'table-cell',
								verticalAlign: 'top',
							}}
							title={`Variable type: ${typeDescription}`}
						>
							<VariableTypeIcon width={12} height={12} icon={iconPath} fill={color} style={{ verticalAlign: '-1px' }} />
						</span>
					)}
					<code
						style={{
							display: 'table-cell',
							verticalAlign: 'top',
							color,
							padding: '5.5px 6px 5.5px 4px',
							whiteSpace: 'pre-wrap',
						}}
						title={compactValue}
					>
						{elms /*displayValue */}
						{valueStr.length <= TRUNCATE_LENGHT ? (
							''
						) : collapser.isPanelCollapsed() ? (
							<button style={btnstyle} onClick={() => collapser.setPanelCollapsed(false)}>
								More
							</button>
						) : (
							<button style={btnstyle} onClick={() => collapser.setPanelCollapsed(true)}>
								Less
							</button>
						)}
					</code>
				</div>
				{showCopy && (
					<CopyToClipboard text={valueStr} onCopy={onCopied}>
						<CButton size="sm" title="Copy variable value">
							<FontAwesomeIcon icon={faCopy} color={color} />
						</CButton>
					</CopyToClipboard>
				)}
			</div>
		</div>
	)
}
