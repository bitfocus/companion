import { Progress } from '@base-ui/react/progress'
import classNames from 'classnames'
import { forwardRef, type HTMLAttributes } from 'react'

export interface ProgressBarProps extends Pick<HTMLAttributes<HTMLDivElement>, 'className' | 'style'> {
	value?: number
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(({ className, style, value }, ref) => {
	return (
		<Progress.Root value={value ?? 0} className={classNames('progress2', className)} style={style} ref={ref}>
			<Progress.Track style={{ display: 'contents' }}>
				<Progress.Indicator className="progress2-bar" style={{ width: `${value ?? 0}%` }} />
			</Progress.Track>
		</Progress.Root>
	)
})
