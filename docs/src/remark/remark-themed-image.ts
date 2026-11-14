import fs from 'node:fs'
import path from 'node:path'
import type { Image, Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

// Show a screenshot taken in both themes as the one matching the theme of the site.
// Write it as a normal image, ![my screenshot](images/my-screenshot.png), with the files named my-screenshot.light.png
// and my-screenshot.dark.png (as `yarn docs:screenshots` writes them). The image becomes a pair of images, one for
// each theme, which custom.css shows or hides by the hash added to their urls.
// This has to run **before** the default remark plugins, which turn the urls into the urls of the built images.
const remarkThemedImage: Plugin<[], Root> = () => (tree, file) => {
	if (!file.path) return
	const dir = path.dirname(file.path)

	visit(tree, 'image', (node, index, parent) => {
		if (index === undefined || !parent) return

		// Only a local png which doesn't exist itself, but does in both themes
		const match = /^([^:#?]+)\.png$/i.exec(node.url)
		if (!match || fs.existsSync(path.join(dir, node.url))) return

		const base = match[1]
		const themed = (theme: 'light' | 'dark'): Image => ({
			...node,
			url: `${base}.${theme}.png#themed-${theme}`,
		})
		if (!fs.existsSync(path.join(dir, `${base}.light.png`)) || !fs.existsSync(path.join(dir, `${base}.dark.png`)))
			return

		parent.children.splice(index, 1, themed('light'), themed('dark'))
		// Skip over the pair just inserted
		return index + 2
	})
}

export default remarkThemedImage
