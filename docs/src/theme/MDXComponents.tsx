// Import original components to extend them
import MDXComponents from '@theme-original/MDXComponents'
import React, { type ComponentProps } from 'react'

const CustomImg = (props: ComponentProps<'img'>): React.JSX.Element => {
	// 1. Destructure and "throw away" img-only props that break <video>
	// 2. Keep 'src' and 'alt' for logic
	// 3. Collect everything else in 'rest'
	const { src, alt, loading, decoding, fetchPriority, ...rest } = props

	// Use case-insensitive regex to catch local video extensions
	const isVideo = src?.match(/\.(mp4|webm|ogg)$/i)

	if (isVideo) {
		const vtype = isVideo[1].toLowerCase()
		return (
			<video controls preload="metadata" aria-label={alt} {...(rest as ComponentProps<'video'>)}>
				<source src={src} type={`video/${vtype}`} />
				Your browser does not support the video tag.
			</video>
		)
	}

	// Use the default Docusaurus image renderer for normal images
	return <img {...props} />
}

export default {
	...MDXComponents,
	img: CustomImg,
}
