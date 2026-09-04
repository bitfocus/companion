#!/usr/bin/env node
// Vendors shadcn's base Tailwind CSS (custom variants + utilities used by the
// generated components) into src/shadcn-tailwind.css, so we don't have to keep
// the heavy `shadcn` package in devDependencies just for a single CSS file.
//
// Run this after adopting/regenerating shadcn components, or to pick up newer
// shadcn CSS. It resolves the latest release on the pinned major line from the
// npm registry; pass an explicit version to override:
//   yarn workspace @companion-app/launcher-ui vendor:shadcn-css [version]
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The major version the components were generated against. Bump when adopting a
// new shadcn major (e.g. to 5) after regenerating the components for it.
const MAJOR = 4

const outFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shadcn-tailwind.css')

async function resolveLatest(major) {
	const res = await fetch('https://registry.npmjs.org/shadcn', {
		headers: { accept: 'application/vnd.npm.install-v1+json' },
	})
	if (!res.ok) throw new Error(`Failed to query registry: ${res.status} ${res.statusText}`)
	const { versions } = await res.json()

	const latest = Object.keys(versions)
		.filter((v) => !v.includes('-')) // stable releases only
		.map((v) => v.split('.').map(Number))
		.filter(([maj]) => maj === major)
		.sort(([, aMin, aPatch], [, bMin, bPatch]) => aMin - bMin || aPatch - bPatch)
		.at(-1)

	if (!latest) throw new Error(`No stable shadcn ${major}.x release found on the registry`)
	return latest.join('.')
}

const version = process.argv[2] ?? (await resolveLatest(MAJOR))
const url = `https://unpkg.com/shadcn@${version}/dist/tailwind.css`

const res = await fetch(url)
if (!res.ok) {
	throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
}
const css = await res.text()

const header =
	`/*\n` +
	` * GENERATED FILE - DO NOT EDIT.\n` +
	` * Vendored verbatim from shadcn@${version} (dist/tailwind.css).\n` +
	` * Regenerate with: yarn workspace @companion-app/launcher-ui vendor:shadcn-css\n` +
	` */\n\n`

await writeFile(outFile, header + css)
console.log(`Vendored shadcn@${version} tailwind.css -> ${outFile} (${css.split('\n').length} lines)`)
