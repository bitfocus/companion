import React, { useCallback, useState } from 'react'
import { VARIABLE_UNKNOWN_VALUE } from '~/Resources/Constants.js'
import { VariableTypeIcon, type VariableTypeIconType } from './VariableTypeIcon.js'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretDown, faCaretRight, faCopy, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { CAlert, CButton, CPopover } from '@coreui/react'
import type { PanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'

interface VariableValueDisplay {
	/** Value to show */
	value: any

	/** An optional collapse helper for collapsing all items in the list, falls back to local state if omitted */
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

	/** If set, displays the value in an invalid/error style and shows the reason as a tooltip */
	invalidReason?: string

	/** If true, constrains to a single line with ellipsis overflow instead of wrapping */
	compact?: boolean

	/** Limit the number of visible lines. Content beyond this is hidden with ellipsis. Ignored when compact is true. */
	maxLines?: number

	[prop: string]: any
}

const TRUNCATE_LENGTH = 100

export const VariableValueDisplay: React.FC<VariableValueDisplay> = ({
	value,
	panelCollapseHelper,
	collapsePanelId,
	showIcon = true,
	showCopy = true,
	icon,
	onCopied = () => {},
	invalidReason,
	compact = false,
	maxLines,
	...props
}) => {
	// Use the collapseHelper if we have all necessary information, otherwise use loal state
	let collapser: { isPanelCollapsed: () => boolean; setPanelCollapsed: (b: boolean) => void }
	const [collapsed, setCollapsed] = useState(true)
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

	const compactValue = valueStr.length > TRUNCATE_LENGTH ? `${valueStr.substring(0, TRUNCATE_LENGTH)}...` : valueStr

	const displayValue =
		(useCollapseHelper && collapser.isPanelCollapsed()) || (!useCollapseHelper && collapsed) ? compactValue : valueStr

	const elms: Array<string | JSX.Element> = []
	const lines = displayValue.split('\\n')
	lines.forEach((l, i) => {
		elms.push(l)
		if (i <= lines.length - 2) {
			elms.push(<br key={i} />)
		}
	})

	const color = invalidReason ? '#c83232' : '#0000c8'
	const backgroundColor = invalidReason ? '#f9e5e5' : '#e5e5f9'

	let typeDescription = 'unknown'
	let iconPath: VariableTypeIconType = 'unknown'
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

	const [expanded, setExpanded] = useState(false)
	const toggleExpanded = useCallback(() => setExpanded((v) => !v), [])

	return (
		<div className="variable-value-display" {...props}>
			<div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
				<div
					style={{
						backgroundColor,
						color,
						borderRadius: '6px',
						padding: '4px 6px',
						display: compact ? 'flex' : 'inline-table',
						lineHeight: '14px',
						...(compact
							? {
									minWidth: 0,
									maxWidth: '300px',
									alignItems: 'center',
								}
							: {
									maxWidth: '100%',
								}),
					}}
				>
					{showIcon && (
						<span
							style={{
								padding: '4px',
								paddingLeft: '6px',
								display: compact ? 'flex' : 'table-cell',
								verticalAlign: 'top',
								flexShrink: 0,
							}}
							title={`Variable type: ${typeDescription}`}
						>
							<VariableTypeIcon width={12} height={12} icon={iconPath} fill={color} style={{ verticalAlign: '-1px' }} />
						</span>
					)}
					<code
						style={{
							display: compact ? 'block' : 'table-cell',
							verticalAlign: 'top',
							color,
							padding: '5.5px 6px 5.5px 4px',
							...(compact
								? {
										whiteSpace: 'nowrap',
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										minWidth: 0,
									}
								: maxLines
									? {
											whiteSpace: 'pre-wrap',
											overflow: 'hidden',
											display: '-webkit-box',
											WebkitLineClamp: maxLines,
											WebkitBoxOrient: 'vertical',
											textOverflow: 'ellipsis',
										}
									: {
											whiteSpace: 'pre-wrap',
										}),
						}}
						title={compactValue}
					>
						{elms /*displayValue */}
						{valueStr.length <= TRUNCATE_LENGTH ? (
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
					{compact && (
						<CPopover
							visible={expanded}
							onHide={() => setExpanded(false)}
							placement="auto"
							trigger="focus"
							className="variable-value-expanded"
							content={
								<div
									style={{
										maxWidth: '500px',
										maxHeight: '300px',
										overflowY: 'auto',
									}}
								>
									{invalidReason && (
										<CAlert color="danger">
											<FontAwesomeIcon icon={faTriangleExclamation} /> {invalidReason}
										</CAlert>
									)}
									<code
										style={{
											whiteSpace: 'pre-wrap',
											wordBreak: 'break-all',
											padding: '0.5rem',
											color: '#212529',
											backgroundColor: '#f8f9fa',
											borderRadius: '0.25rem',
											display: 'block',
										}}
									>
										{valueStr}
									</code>
								</div>
							}
						>
							<span
								style={{
									padding: '4px 4px 4px 2px',
									cursor: 'pointer',
									flexShrink: 0,
									display: 'flex',
									alignItems: 'center',
								}}
								onClick={toggleExpanded}
								title={expanded ? 'Collapse' : 'Expand to see full value'}
							>
								<FontAwesomeIcon icon={expanded ? faCaretDown : faCaretRight} fixedWidth style={{ fontSize: '10px' }} />
							</span>
						</CPopover>
					)}
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
