import { CAlert, CButton, CPopover } from '@coreui/react'
import { faCopy, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useRef, useState } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import type { PanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'
import { VARIABLE_UNKNOWN_VALUE } from '~/Resources/Constants.js'
import { VariableTypeIcon, type VariableTypeIconType } from './VariableTypeIcon.js'

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

	/** If true, forces the value to always be shown in full (not collapsed). Useful when rendering inside a popover. */
	forceExpanded?: boolean

	/** If false, suppresses the native title tooltip on the compact code element. Defaults to true. Pass false when a popover already provides the expanded view. */
	showHoverTitle?: boolean
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
	forceExpanded = false,
	showHoverTitle = true,
	...props
}) => {
	// Use the collapseHelper if we have all necessary information, otherwise use loal state
	let collapser: { isPanelCollapsed: () => boolean; setPanelCollapsed: (b: boolean) => void }
	const [collapsed, setCollapsed] = useState(!forceExpanded)
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

	const displayValue = forceExpanded
		? valueStr
		: (useCollapseHelper && collapser.isPanelCollapsed()) || (!useCollapseHelper && collapsed)
			? compactValue
			: valueStr

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

	const valuePill = (
		<div
			style={{
				backgroundColor,
				color,
				borderRadius: '6px',
				padding: '4px 6px',
				display: compact || forceExpanded ? 'flex' : 'inline-table',
				lineHeight: '14px',
				...(compact
					? {
							minWidth: 0,
							maxWidth: '300px',
							alignItems: 'center',
						}
					: forceExpanded
						? {
								flex: 1,
								minWidth: 0,
								alignItems: 'flex-start',
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
						display: compact || forceExpanded ? 'flex' : 'table-cell',
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
					display: compact || forceExpanded ? 'block' : 'table-cell',
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
						: forceExpanded
							? {
									whiteSpace: 'pre-wrap',
									flex: 1,
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
				title={compact && showHoverTitle ? compactValue : undefined}
			>
				{elms /*displayValue */}
				{!compact &&
					!forceExpanded &&
					(valueStr.length <= TRUNCATE_LENGTH ? (
						''
					) : collapser.isPanelCollapsed() ? (
						<button style={btnstyle} onClick={() => collapser.setPanelCollapsed(false)}>
							More
						</button>
					) : (
						<button style={btnstyle} onClick={() => collapser.setPanelCollapsed(true)}>
							Less
						</button>
					))}
			</code>
		</div>
	)

	return (
		<div className="variable-value-display" {...props}>
			<div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
				{valuePill}
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

interface VariableValueDisplayPopoverProps {
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
}

export const VariableValueDisplayPopover: React.FC<VariableValueDisplayPopoverProps> = ({
	value,
	panelCollapseHelper,
	collapsePanelId,
	showIcon = true,
	showCopy = true,
	icon,
	onCopied = () => {},
	invalidReason,
}) => {
	const [expanded, setExpanded] = useState(false)
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const cancelClose = useCallback(() => {
		if (closeTimerRef.current !== null) {
			clearTimeout(closeTimerRef.current)
			closeTimerRef.current = null
		}
	}, [])

	const scheduleClose = useCallback(() => {
		cancelClose()
		closeTimerRef.current = setTimeout(() => {
			setExpanded(false)
			closeTimerRef.current = null
		}, 300)
	}, [cancelClose])

	return (
		<CPopover
			visible={expanded}
			onHide={() => setExpanded(false)}
			placement="bottom"
			fallbackPlacements={['top', 'bottom', 'right', 'left']}
			className="variable-value-expanded"
			content={
				<div
					onMouseEnter={cancelClose}
					onMouseLeave={scheduleClose}
					style={{
						maxWidth: '500px',
						maxHeight: '300px',
						overflowY: 'auto',
						paddingRight: '0.25rem',
					}}
				>
					{invalidReason && (
						<CAlert color="danger" className="mb-2">
							<FontAwesomeIcon icon={faTriangleExclamation} /> {invalidReason}
						</CAlert>
					)}
					<VariableValueDisplay
						value={value}
						onCopied={onCopied}
						showCopy={false}
						showIcon={showIcon}
						icon={icon}
						forceExpanded
						panelCollapseHelper={panelCollapseHelper}
						collapsePanelId={collapsePanelId}
					/>
				</div>
			}
		>
			<div
				onMouseEnter={() => {
					cancelClose()
					setExpanded(true)
				}}
				onMouseLeave={scheduleClose}
				style={{ minWidth: 0 }}
			>
				<VariableValueDisplay
					value={value}
					onCopied={onCopied}
					showCopy={showCopy}
					showIcon={showIcon}
					icon={icon}
					compact
					showHoverTitle={false}
					invalidReason={invalidReason}
					panelCollapseHelper={panelCollapseHelper}
					collapsePanelId={collapsePanelId}
				/>
			</div>
		</CPopover>
	)
}
