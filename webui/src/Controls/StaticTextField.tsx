import { parse } from 'marked'
import sanitizeHtml from 'sanitize-html'

export function StaticTextFieldText({
	id,
	value,
	label,
	tooltip,
	allowImages,
}: {
	id?: string
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

		return <div id={id} title={tooltip} dangerouslySetInnerHTML={descriptionHtml} className="static-text-content"></div>
	}

	return null
}
