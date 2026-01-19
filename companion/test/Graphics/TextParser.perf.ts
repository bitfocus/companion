#!/usr/bin/env tsx
/**
 * Performance benchmark for drawAlignedText
 *
 * Run with: yarn tsx companion/test/Graphics/TextParser.perf.ts
 *
 * This benchmarks the text rendering performance with cache disabled
 * to measure the actual computation cost.
 */

import { Image, TextLayoutCache } from '../../lib/Graphics/Image.js'

interface BenchmarkResult {
	name: string
	iterations: number
	totalMs: number
	avgMs: number
	opsPerSec: number
}

interface BenchmarkCase {
	name: string
	text: string
	width: number
	height: number
	fontSize: number | 'auto'
}

const WARMUP_ITERATIONS = 10
const BENCHMARK_ITERATIONS = 100

const testCases: BenchmarkCase[] = [
	// Standard button sizes
	{
		name: '72x72 short text auto',
		text: 'Hello',
		width: 72,
		height: 72,
		fontSize: 'auto',
	},
	{
		name: '72x72 medium text auto',
		text: 'This is a medium length text that will wrap',
		width: 72,
		height: 72,
		fontSize: 'auto',
	},
	{
		name: '72x72 long text auto',
		text: 'This is a very long text that will definitely need to wrap across multiple lines and will test the wrapping algorithm performance',
		width: 72,
		height: 72,
		fontSize: 'auto',
	},
	{
		name: '72x72 very long text auto',
		text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
		width: 72,
		height: 72,
		fontSize: 'auto',
	},
	{
		name: '72x72 short text fixed 14px',
		text: 'Hello',
		width: 72,
		height: 72,
		fontSize: 14,
	},
	{
		name: '72x72 medium text fixed 10px',
		text: 'This is a medium length text that will wrap',
		width: 72,
		height: 72,
		fontSize: 10,
	},

	// Larger buttons
	{
		name: '144x144 short text auto',
		text: 'Hello',
		width: 144,
		height: 144,
		fontSize: 'auto',
	},
	{
		name: '144x144 medium text auto',
		text: 'This is a medium length text',
		width: 144,
		height: 144,
		fontSize: 'auto',
	},
	{
		name: '144x144 long text auto',
		text: 'This is a very long text that will definitely need to wrap across multiple lines and will test the wrapping algorithm performance with larger button sizes',
		width: 144,
		height: 144,
		fontSize: 'auto',
	},

	// Large displays
	{
		name: '360x360 medium text auto',
		text: 'Medium text on large display',
		width: 360,
		height: 360,
		fontSize: 'auto',
	},
	{
		name: '360x360 very long text auto',
		text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
		width: 360,
		height: 360,
		fontSize: 'auto',
	},

	// Unicode and emoji
	{
		name: '72x72 emoji text auto',
		text: '🎉 Hello 😀 World 🎨',
		width: 72,
		height: 72,
		fontSize: 'auto',
	},
	{
		name: '72x72 chinese text auto',
		text: '你好世界 这是一个测试文本',
		width: 72,
		height: 72,
		fontSize: 'auto',
	},
	{
		name: '72x72 mixed unicode auto',
		text: 'Hello 你好 🎉 café ਸਤਿ 안녕',
		width: 72,
		height: 72,
		fontSize: 'auto',
	},

	// Newlines
	{
		name: '72x72 newlines auto',
		text: 'Line 1\nLine 2\nLine 3\nLine 4',
		width: 72,
		height: 72,
		fontSize: 'auto',
	},

	// Extreme cases
	{
		name: '72x72 extremely long text auto',
		text: 'a'.repeat(2000),
		width: 72,
		height: 72,
		fontSize: 'auto',
	},
]

function runBenchmark(testCase: BenchmarkCase, iterations: number): BenchmarkResult {
	// Create a single image instance to reuse (no cache)
	const image = new Image(testCase.width, testCase.height, 1, null)

	const startTime = performance.now()

	for (let i = 0; i < iterations; i++) {
		// Clear the canvas between runs
		image.fillColor('#000000')

		// Run the text drawing
		image.drawAlignedText(
			0,
			0,
			testCase.width,
			testCase.height,
			testCase.text,
			'#ffffff',
			testCase.fontSize,
			'center',
			'center'
		)
	}

	const endTime = performance.now()
	const totalMs = endTime - startTime
	const avgMs = totalMs / iterations
	const opsPerSec = 1000 / avgMs

	return {
		name: testCase.name,
		iterations,
		totalMs,
		avgMs,
		opsPerSec,
	}
}

function formatNumber(num: number, decimals: number = 2): string {
	return num.toFixed(decimals)
}

function formatOpsPerSec(ops: number): string {
	if (ops >= 1000) {
		return `${formatNumber(ops / 1000, 1)}k`
	}
	return formatNumber(ops, 0)
}

function runAllBenchmarks(): void {
	console.log('='.repeat(80))
	console.log('drawAlignedText Performance Benchmark')
	console.log('='.repeat(80))
	console.log(`Warmup iterations: ${WARMUP_ITERATIONS}`)
	console.log(`Benchmark iterations: ${BENCHMARK_ITERATIONS}`)
	console.log(`Cache: disabled`)
	console.log('='.repeat(80))
	console.log()

	const results: BenchmarkResult[] = []

	for (const testCase of testCases) {
		// Warmup
		process.stdout.write(`Warming up: ${testCase.name}... `)
		runBenchmark(testCase, WARMUP_ITERATIONS)
		console.log('done')

		// Actual benchmark
		process.stdout.write(`Benchmarking: ${testCase.name}... `)
		const result = runBenchmark(testCase, BENCHMARK_ITERATIONS)
		results.push(result)
		console.log(`${formatNumber(result.avgMs)}ms avg`)
	}

	console.log()
	console.log('='.repeat(80))
	console.log('Results')
	console.log('='.repeat(80))
	console.log()

	// Print table header
	console.log('Test Case'.padEnd(40) + 'Avg (ms)'.padStart(12) + 'Total (ms)'.padStart(14) + 'Ops/sec'.padStart(12))
	console.log('-'.repeat(80))

	// Print results
	for (const result of results) {
		console.log(
			result.name.padEnd(40) +
				formatNumber(result.avgMs, 3).padStart(12) +
				formatNumber(result.totalMs, 1).padStart(14) +
				formatOpsPerSec(result.opsPerSec).padStart(12)
		)
	}

	console.log()
	console.log('='.repeat(80))

	// Summary statistics
	const avgTimes = results.map((r) => r.avgMs)
	const totalTime = results.reduce((sum, r) => sum + r.totalMs, 0)
	const avgOfAvgs = avgTimes.reduce((sum, t) => sum + t, 0) / avgTimes.length
	const minTime = Math.min(...avgTimes)
	const maxTime = Math.max(...avgTimes)

	console.log('Summary:')
	console.log(`  Total benchmark time: ${formatNumber(totalTime / 1000, 2)}s`)
	console.log(`  Average time across all tests: ${formatNumber(avgOfAvgs, 3)}ms`)
	console.log(`  Fastest test: ${formatNumber(minTime, 3)}ms`)
	console.log(`  Slowest test: ${formatNumber(maxTime, 3)}ms`)
	console.log('='.repeat(80))
}

// Run the benchmarks
runAllBenchmarks()
