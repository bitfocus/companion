import { CircleHelp } from 'lucide-react'
import './InlineHelp.css'
import classnames from 'classnames'
import { Tooltip } from '~/Components/Tooltip.js'

export const InlineHelpCustom = ({
	help,
	children,
	className,
}: {
	help: string | React.ReactNode
	children: React.ReactNode
	className?: string
}): React.JSX.Element => {
	return (
		<Tooltip.Root>
			<Tooltip.Trigger
				render={
					<span tabIndex={0} className={classnames('inline-help-outer', className)}>
						{children}
					</span>
				}
				delay={300}
				closeDelay={100}
			/>
			<Tooltip.Popup side="bottom" arrow size="md">
				<div className="inline-help">{help}</div>
			</Tooltip.Popup>
		</Tooltip.Root>
	)
}

export const InlineHelpIcon = ({
	children,
	className,
}: {
	children: React.ReactNode
	className?: string
}): React.JSX.Element => {
	return (
		<InlineHelpCustom help={children} className={className}>
			<CircleHelp className="w-3.5 h-3.5 inline-block opacity-70 hover:opacity-100 transition-opacity" />
		</InlineHelpCustom>
	)
}
