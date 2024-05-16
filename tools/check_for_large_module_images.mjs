#!/usr/bin/env zx

import fs from 'fs/promises'

const fileExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
const threshold = 500 * 1024 // 200 Kb

// Images which are ok being large
const allowedImages = [
	'bundled-modules/skaarhoj-rawpanel/companion/Images/blue-pill-mode.gif',
	//
]

const largeImages = []

async function searchDir(dirPath) {
	const childList = await fs.readdir(dirPath)

	for (const child of childList) {
		if (child === 'node_modules' || child == '.' || child == '..') continue

		const childPath = path.join(dirPath, child)
		const stat = await fs.stat(childPath)

		if (stat.isDirectory()) {
			await searchDir(childPath)
		} else if (stat.isFile()) {
			const isImage = !!fileExtensions.find((ext) => child.endsWith(ext))

			if (stat.size > threshold && isImage && !allowedImages.includes(childPath)) {
				largeImages.push(`${childPath} = ${Math.round(stat.size / 1024)} kb`)
			}
		}
	}
}
await searchDir('bundled-modules')

if (largeImages.length) {
	console.log(`Found ${largeImages.length} large images:`)
	console.log(largeImages.join('\n'))
}
