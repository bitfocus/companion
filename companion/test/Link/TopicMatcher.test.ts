import { describe, expect, test } from 'vitest'
import { linkTopicMatches } from '../../lib/Link/TopicMatcher.js'

describe('linkTopicMatches', () => {
	test.each([
		['a/b/c', 'a/b/c', true],
		['a/b/c', 'a/b/d', false],
		['a/+/c', 'a/b/c', true],
		['a/+/c', 'a/b/b/c', false],
		['a/+', 'a', false],
		['a/#', 'a/b/c', true],
		['a/#', 'a', true],
		['#', 'a/b', true],
		['a/b', 'a/b/c', false],
		['a/b/c', 'a/b', false],
		['companion-link/discovery/+', 'companion-link/discovery/abc', true],
		['companion-link/discovery/+', 'companion-link/abc/inbox', false],
	])('%s matches %s: %s', (pattern, topic, expected) => {
		expect(linkTopicMatches(pattern, topic)).toBe(expected)
	})
})
