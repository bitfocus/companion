import { parse } from 'marked'
import { sanitizeHtmlString } from '~/Resources/SanitizeHtml.js'

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
			__html: sanitizeHtmlString(parse(value?.trim() ?? '') as string, { allowImages }),
		}

		return <div id={id} title={tooltip} dangerouslySetInnerHTML={descriptionHtml} className="static-text-content"></div>
	}

	return null
}
