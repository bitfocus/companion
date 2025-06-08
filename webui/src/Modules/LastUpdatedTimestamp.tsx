import React from 'react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'

dayjs.extend(relativeTime)

export function LastUpdatedTimestamp({ timestamp }: { timestamp: number | undefined }): React.JSX.Element {
	let timeStr = 'Unknown'
	let titleStr: string | undefined = undefined
	if (timestamp === 0) {
		timeStr = 'Never'
	} else if (timestamp !== undefined) {
		timeStr = dayjs(timestamp).fromNow()
		titleStr = dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
	}

	return (
		<span className="last-updated" title={titleStr}>
			<span className="bold">Last updated:</span> {timeStr}
		</span>
	)
}
