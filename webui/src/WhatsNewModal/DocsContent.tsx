import React from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { makeAbsolutePath } from '~/Resources/util.js'
import type { WhatsNewContent } from './content'

interface DocsContentProps {
	file: WhatsNewContent
}

export function DocsContent({ file }: DocsContentProps): React.JSX.Element {
	// strip filename

	const data = file.default
	const baseUrl = '123'

	return (
		<div>
			<ReactMarkdown
				urlTransform={(src, key, _node) => {
					if (key === 'src' || (key === 'href' && !src.startsWith('http') && !src.startsWith('#'))) {
						// img tag
						return makeAbsolutePath(`/docs/${baseUrl}${defaultUrlTransform(src)}`)
					} else {
						return defaultUrlTransform(src)
					}
				}}
				children={data}
				remarkPlugins={[remarkGfm]}
			/>
		</div>
	)
}
