import { defineConfig, devices } from '@playwright/test'

// Optional override for environments with a pre-provisioned chromium that doesn't match the
// installed playwright version (e.g. sandboxes)
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH

/**
 * Takes the screenshots of the user guide, in light and dark, from a real Companion seeded with the examples the
 * pages describe. Run with `yarn docs:screenshots`, which rewrites only the images which have changed. Without
 * `--update-snapshots` it instead checks that the images in the docs are still up to date.
 */
export default defineConfig({
	testDir: './docs-screenshots',
	testMatch: '*.shots.ts',
	outputDir: './test-results/docs-screenshots',
	globalSetup: './support/global-setup.ts',
	// The images are written straight into the docs, next to the pages which show them
	snapshotPathTemplate: '../docs/user-guide/{arg}{ext}',
	timeout: 120_000,
	expect: {
		timeout: 15_000,
		toHaveScreenshot: {
			animations: 'disabled',
			caret: 'hide',
			scale: 'device',
			// Tolerate antialiasing noise, so that an image is only rewritten when it really changed
			maxDiffPixelRatio: 0.002,
		},
	},
	// Each file seeds its own app, and the screenshots are taken in order, so keep it simple
	workers: 1,
	fullyParallel: false,
	reporter: [['list']],
	use: {
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				// Tall, so that an edit panel shows all of its content
				viewport: { width: 1440, height: 1800 },
				// Sharp on high density screens
				deviceScaleFactor: 2,
				launchOptions: executablePath ? { executablePath } : {},
			},
		},
	],
})
