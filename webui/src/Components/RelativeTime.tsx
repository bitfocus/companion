import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import { useNow } from '~/Hooks/useNow.js'

dayjs.extend(relativeTime)

interface RelativeTimeProps {
	/** Unix timestamp in ms */
	timestamp: number
	/** dayjs format of the absolute time shown on hover. Defaults to the date and time */
	titleFormat?: string
	/** Text before the absolute time on hover, eg `Last seen` */
	titlePrefix?: string
	className?: string
}

/**
 * A time relative to now (eg `3 hours ago`), with the absolute time on hover. Refreshes every minute so it stays
 * current while nothing else re-renders it.
 */
export function RelativeTime({
	timestamp,
	titleFormat = 'YYYY-MM-DD HH:mm:ss',
	titlePrefix,
	className,
}: RelativeTimeProps): React.JSX.Element {
	const now = useNow(60_000)

	const time = dayjs(timestamp)
	const absolute = time.format(titleFormat)

	return (
		<span className={className} title={titlePrefix ? `${titlePrefix} ${absolute}` : absolute}>
			{time.from(now)}
		</span>
	)
}
