/**
 * Check whether a topic matches a subscription pattern, using MQTT rules:
 * levels are separated by `/`, `+` matches exactly one level and a trailing `#` matches any remaining levels
 * (including none).
 *
 * For transports that are not an MQTT broker and need to do their own topic routing.
 */
export function linkTopicMatches(pattern: string, topic: string): boolean {
	if (pattern === topic) return true

	const patternLevels = pattern.split('/')
	const topicLevels = topic.split('/')

	for (let i = 0; i < patternLevels.length; i++) {
		const level = patternLevels[i]
		if (level === '#') return i === patternLevels.length - 1
		if (i >= topicLevels.length) return false
		if (level !== '+' && level !== topicLevels[i]) return false
	}

	return patternLevels.length === topicLevels.length
}
