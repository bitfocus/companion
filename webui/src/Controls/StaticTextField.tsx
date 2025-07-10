import { parse } from 'marked'
import React from 'react'
import sanitizeHtml from 'sanitize-html'

export function StaticTextFieldText({
	value,
	label,
	tooltip,
	allowImages,
}: {
	value: string
	label?: string
	tooltip?: string
	allowImages?: boolean
}): JSX.Element | null {
	if (value && value != label) {
		const descriptionHtml = {
			__html: sanitizeHtml(parse(value?.trim() ?? '') as string, {
				allowedTags: sanitizeHtml.defaults.allowedTags.concat(allowImages ? ['img'] : []),
				disallowedTagsMode: 'escape',
			}),
		}

		return <p title={tooltip} dangerouslySetInnerHTML={descriptionHtml}></p>
	}

	return null
}
