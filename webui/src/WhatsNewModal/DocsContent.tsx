import React from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useQuery } from '@tanstack/react-query'
import { makeAbsolutePath } from '~/Resources/util.js'

interface DocsContentProps {
	file: string
}

export function DocsContent({ file }: DocsContentProps): React.JSX.Element {
	const { isPending, error, data } = useQuery<string>({
		queryKey: [`docs_${file}`],
		queryFn: async () => fetch(makeAbsolutePath(`/whatsnew/${file}.md`)).then(async (res) => res.text()),
		retry: false,
	})

	return (
		<div>
			{isPending && 'loading'}
			{error && <div>Error: {error.message}</div>}
			{data && (
				<ReactMarkdown
					urlTransform={(src, key, _node) => {
						if (key === 'src' || (key === 'href' && !src.startsWith('http') && !src.startsWith('#'))) {
							// img tag
							return makeAbsolutePath(`/whatsnew/${defaultUrlTransform(src)}`)
						} else {
							return defaultUrlTransform(src)
						}
					}}
					children={data}
					remarkPlugins={[remarkGfm]}
				/>
			)}
		</div>
	)
}
