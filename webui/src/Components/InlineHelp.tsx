import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import './InlineHelp.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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
			<FontAwesomeIcon icon={faQuestionCircle} />
		</InlineHelpCustom>
	)
}
