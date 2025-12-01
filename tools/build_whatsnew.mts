#!/usr/bin/env tsx

/**
 * Build script to process WhatsNew markdown files
 * - Discovers markdown files automatically
 * - Extracts version info from frontmatter
 * - Strips YAML frontmatter
 * - Copies images to webui public directory
 * - Generates manifest JSON for the UI
 */

import fs from 'fs/promises'
import path from 'path'

const rootDir = path.resolve(import.meta.dirname, '..')
const docsDir = path.join(rootDir, 'docs', 'user-guide', '9_whatsnew')
const outputDir = path.join(rootDir, 'webui', 'public', 'whatsnew')

interface WhatsNewFile {
	version: string
	label: string
	file: string
}

interface FrontmatterData {
	title?: string
	sidebar_position?: number
}

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { data: FrontmatterData; content: string } {
	const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/
	const match = content.match(frontmatterRegex)

	if (!match) {
		return { data: {}, content }
	}

	const frontmatterText = match[1]
	const data: FrontmatterData = {}

	// Simple YAML parser for our needs
	const lines = frontmatterText.split('\n')
	for (const line of lines) {
		const [key, ...valueParts] = line.split(':')
		if (key && valueParts.length > 0) {
			const value = valueParts.join(':').trim()
			if (key.trim() === 'title') {
				data.title = value
			} else if (key.trim() === 'sidebar_position') {
				data.sidebar_position = parseInt(value, 10)
			}
		}
	}

	const contentWithoutFrontmatter = content.replace(frontmatterRegex, '').trim()
	return { data, content: contentWithoutFrontmatter }
}

/**
 * Discover and process markdown files from the docs directory
 */
async function discoverVersions(): Promise<WhatsNewFile[]> {
	const entries = await fs.readdir(docsDir, { withFileTypes: true })
	const versions: WhatsNewFile[] = []

	for (const entry of entries) {
		if (entry.isFile() && entry.name.endsWith('.md')) {
			const filePath = path.join(docsDir, entry.name)
			const content = await fs.readFile(filePath, 'utf-8')
			const { data } = parseFrontmatter(content)

			const fileBaseName = entry.name.replace('.md', '')
			const title = data.title || fileBaseName

			// Convert title to version number (e.g., "v4.1.0" -> "4.1.0")
			const versionMatch = title.match(/v?(\d+\.\d+\.\d+)/)
			const version = versionMatch ? versionMatch[1] : fileBaseName

			versions.push({
				version,
				label: title,
				file: fileBaseName,
			})
		}
	}

	// Sort by version (newest first)
	versions.sort((a, b) => {
		const versionA = a.version.split('.').map(Number)
		const versionB = b.version.split('.').map(Number)

		for (let i = 0; i < 3; i++) {
			if (versionA[i] !== versionB[i]) {
				return versionB[i] - versionA[i]
			}
		}
		return 0
	})

	return versions
}

/**
 * Process a single markdown file
 */
async function processMarkdownFile(version: WhatsNewFile): Promise<void> {
	const inputPath = path.join(docsDir, `${version.file}.md`)
	const outputPath = path.join(outputDir, `${version.file}.md`)

	console.log(`Processing ${version.label}...`)

	// Read the markdown file
	const content = await fs.readFile(inputPath, 'utf-8')

	// Strip frontmatter
	const { content: processedContent } = parseFrontmatter(content)

	// Write the processed file
	await fs.writeFile(outputPath, processedContent, 'utf-8')
}

/**
 * Copy images for a version
 */
async function copyImages(version: WhatsNewFile): Promise<void> {
	const sourceImageDir = path.join(docsDir, version.file)
	const destImageDir = path.join(outputDir, version.file)

	try {
		// Check if source directory exists
		await fs.access(sourceImageDir)

		// Create destination directory
		await fs.mkdir(destImageDir, { recursive: true })

		// Copy all files from source to destination
		const files = await fs.readdir(sourceImageDir)

		for (const file of files) {
			const sourcePath = path.join(sourceImageDir, file)
			const destPath = path.join(destImageDir, file)

			const stat = await fs.stat(sourcePath)
			if (stat.isFile()) {
				await fs.copyFile(sourcePath, destPath)
				console.log(`  Copied image: ${file}`)
			}
		}
	} catch (error) {
		console.log(`  No images directory for ${version.file}`)
	}
}

/**
 * Main build function
 */
console.log('Building WhatsNew content...')

// Create output directory
await fs.mkdir(outputDir, { recursive: true })

// Discover versions from docs directory
const versions = await discoverVersions()

console.log(`Found ${versions.length} versions:`, versions.map((v) => v.label).join(', '))

// Process each version
for (const version of versions) {
	await processMarkdownFile(version)
	await copyImages(version)
}

// Write manifest file for the UI to consume
const manifestPath = path.join(outputDir, 'manifest.json')
await fs.writeFile(manifestPath, JSON.stringify(versions, null, 2), 'utf-8')
console.log(`Wrote manifest with ${versions.length} versions`)

console.log('WhatsNew content built successfully!')
