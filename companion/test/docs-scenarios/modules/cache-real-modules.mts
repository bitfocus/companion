/*
 * Download the pinned versions of the real modules the docs screenshots use, so that the scenarios don't have to while
 * an app is starting (see DemoModules.ts). Run by the global setup of the docs screenshots.
 */
import { cacheRealModules } from './DemoModules.js'

await cacheRealModules()
