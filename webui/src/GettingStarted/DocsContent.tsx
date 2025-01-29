import React, { useState, useEffect } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useQuery } from '@tanstack/react-query'

interface DocsContentProps {
	file: string
}

export function DocsContent({ file }: DocsContentProps) {
	// strip filename
	const baseUrl = `${file}`.replace(/\/[^/]+$/, '/')

	const { isPending, error, data } = useQuery<string>({
		queryKey: [`docs_${file}`],
		queryFn: () => fetch(`/docs/${file}`).then((res) => res.text()),
		retry: false,
	})

	return (
		<div>
			{isPending && 'loading'}
			{error && <div>Error: {error.message}</div>}
			{data && (
				<ReactMarkdown
					urlTransform={(src, key, _node) => {
						if (key === 'src') {
							// img tag
							return `/docs/${baseUrl}${defaultUrlTransform(src)}`
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
