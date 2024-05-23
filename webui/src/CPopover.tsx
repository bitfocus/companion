import React, { useEffect, useRef, useMemo } from 'react'
import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'

//component - CoreUI / CPopover
const generateContent = (content: ChildElement | undefined, header: ChildElement | undefined) => {
	return (
		<>
			<h3 className="popover-header">{header}</h3>
			<div className="popover-body">{content}</div>
		</>
	)
}

type ChildElement = JSX.Element | string

interface CTooltipProps {
	// children?: ChildElement
	content?: ChildElement
	interactive?: boolean
	placement?:
		| ''
		| 'top-end'
		| 'top'
		| 'top-start'
		| 'bottom-end'
		| 'bottom'
		| 'bottom-start'
		| 'right-start'
		| 'right'
		| 'right-end'
		| 'left-start'
		| 'left'
		| 'left-end'
	trigger?: string
	advancedOptions?: object
}

//component - CoreUI / CTooltip
const CTooltip = (props: React.PropsWithChildren<CTooltipProps>) => {
	let {
		//
		children,
		content,
		interactive,
		placement,
		trigger,
		advancedOptions,
	} = props

	const config: any = {
		allowHTML: true,
		content,
		interactive,
		placement,
		trigger,
		...advancedOptions,
	}

	const key = useMemo(() => Math.random().toString(36).substr(2), [])
	const instance = useRef<tippy.Instance>()

	useEffect(() => {
		if (instance.current) {
			instance.current.setProps(config)
		}
	})

	useEffect(() => {
		const node = document.querySelector(`[data-tooltip="${key}"]`)!
		instance.current = (tippy as any)(node, config)
		return () => instance.current?.destroy()
	}, [key])

	return (
		<React.Fragment>
			{React.cloneElement(children as any, {
				'data-tooltip': key,
			})}
		</React.Fragment>
	)
}

// CTooltip.propTypes = {
//   children: PropTypes.node,
//   content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
//   interactive: PropTypes.bool,
//   placement: PropTypes.oneOf([
//     '', 'top-end', 'top', 'top-start',
//     'bottom-end', 'bottom', 'bottom-start',
//     'right-start', 'right', 'right-end',
//     'left-start', 'left', 'left-end'
//   ]),
//   trigger: PropTypes.string,
//   advancedOptions: PropTypes.object
// }

// CTooltip.defaultProps = {
//   content: '',
//   interactive: false,
//   placement: 'top',
//   trigger: 'mouseenter focus',
//   advancedOptions: {}
// }

interface CPopoverProps extends CTooltipProps {
	content?: ChildElement
	header?: ChildElement
}

export const CPopover = (props: React.PropsWithChildren<CPopoverProps>) => {
	let { header, children, content, ...config } = props

	const computedContent = useMemo(() => generateContent(content, header), [content, header])

	const advancedOptions = {
		...(config ? config.advancedOptions || {} : {}),
		theme: 'cpopover',
	}

	const computedConfig = {
		...config,
		advancedOptions,
	}

	return (
		<CTooltip content={computedContent} {...computedConfig}>
			{children}
		</CTooltip>
	)
}
