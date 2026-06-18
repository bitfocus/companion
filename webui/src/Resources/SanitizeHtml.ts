import sanitizeHtml from 'sanitize-html'

export interface SanitizeHtmlOptions {
	/** Allow `<img>` tags (including `data:` image sources) */
	allowImages?: boolean
}

/**
 * Sanitize a string of HTML for rendering with `dangerouslySetInnerHTML`.
 *
 * Disallowed tags are escaped rather than dropped, and all `<a>` tags are
 * mangled to open in a new tab with `rel="noopener noreferrer"`.
 */
export function sanitizeHtmlString(html: string, options?: SanitizeHtmlOptions): string {
	return sanitizeHtml(html, {
		allowedTags: sanitizeHtml.defaults.allowedTags.concat(options?.allowImages ? ['img'] : []),
		disallowedTagsMode: 'escape',
		allowedSchemes: ['http', 'https'],
		allowedAttributes: {
			...sanitizeHtml.defaults.allowedAttributes,
			// `rel` is needed for the anchor mangling below, but isn't allowed by default
			a: [...(sanitizeHtml.defaults.allowedAttributes.a ?? []), 'rel'],
		},
		allowedSchemesByTag: options?.allowImages
			? {
					// Permit inline (data:) images in addition to the default http(s) schemes
					img: ['http', 'https', 'data'],
				}
			: {},
		transformTags: {
			a: (tagName, attribs) => {
				// Ensure links hide the referrer and open in a new window
				return { tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }
			},
		},
	})
}
