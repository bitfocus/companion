import { Marked } from 'marked'
import { baseUrl } from 'marked-base-url'
import { useMemo } from 'react'
import { sanitizeHtmlString } from '~/Resources/SanitizeHtml.js'
import { makeAbsolutePath } from '~/Resources/util.js'

/** Resolve a module's `helpPath` to a url that can be fetched. */
export function resolveModuleHelpUrl(helpPath: string): string {
	return helpPath.startsWith('http') ? helpPath : makeAbsolutePath(helpPath)
}

/**
 * Render a module's help markdown, with images resolved relative to where the markdown was fetched
 * from. Shared by the help modal and the connection edit panel's Help tab so both parse and
 * sanitize identically.
 */
export function ModuleHelpContent({
	markdown,
	helpUrl,
	className,
}: {
	markdown: string
	helpUrl: string
	className?: string
}): React.JSX.Element {
	const html = useMemo(() => {
		const marked = new Marked()
		if (helpUrl) marked.use(baseUrl(helpUrl))
		return { __html: sanitizeHtmlString(marked.parse(markdown) as string, { allowImages: true }) }
	}, [markdown, helpUrl])

	return <div dangerouslySetInnerHTML={html} className={className ? `markdown ${className}` : 'markdown'} />
}
