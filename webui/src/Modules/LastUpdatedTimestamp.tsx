import { RelativeTime } from '~/Components/RelativeTime.js'

export function LastUpdatedTimestamp({ timestamp }: { timestamp: number | undefined }): React.JSX.Element {
	let time: React.ReactNode = 'Unknown'
	if (timestamp === 0) {
		time = 'Never'
	} else if (timestamp !== undefined) {
		time = <RelativeTime timestamp={timestamp} />
	}

	return (
		<span className="last-updated">
			<span className="bold">Last updated:</span> {time}
		</span>
	)
}
