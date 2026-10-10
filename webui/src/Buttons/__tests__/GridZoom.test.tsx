import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	FIT_ZOOM_MAX,
	FIT_ZOOM_MIN,
	fitZoom,
	parseStoredZoom,
	useGridZoom,
	useSurfaceZoom,
	ZOOM_MAX,
	ZOOM_MIN,
	ZOOM_STEP,
} from '../GridZoom.js'

let stored: Map<string, string>

/** Storage that works, backed by `stored` */
function workingStorage() {
	return {
		getItem: (key: string) => stored.get(key) ?? null,
		setItem: (key: string, value: string) => void stored.set(key, value),
		removeItem: (key: string) => void stored.delete(key),
	}
}

/** Storage that refuses everything, as a browser with it blocked does */
function failingStorage() {
	const fail = () => {
		throw new Error('storage is blocked')
	}
	return { getItem: fail, setItem: fail, removeItem: fail }
}

beforeEach(() => {
	stored = new Map()
	vi.stubGlobal('localStorage', workingStorage())
	// A storage write that fails is logged rather than thrown; keep that out of the test output
	vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('useGridZoom', () => {
	describe('the level it starts at', () => {
		it('starts at 100% when nothing was stored', () => {
			const { result } = renderHook(() => useGridZoom('grid'))

			expect(result.current[1]).toBe(100)
		})

		it('starts at the level stored for it', () => {
			stored.set('grid-zoom-scale:grid', '70')

			expect(renderHook(() => useGridZoom('grid')).result.current[1]).toBe(70)
		})

		it('keeps each zoom apart, by its id', () => {
			stored.set('grid-zoom-scale:grid', '70')
			stored.set('grid-zoom-scale:import', '130')

			expect(renderHook(() => useGridZoom('grid')).result.current[1]).toBe(70)
			expect(renderHook(() => useGridZoom('import')).result.current[1]).toBe(130)
		})

		it.each([
			['something which is not a number', 'big'],
			['an empty value', ''],
			['zero', '0'],
		])('starts at 100%% when %s was stored', (_, value) => {
			stored.set('grid-zoom-scale:grid', value)

			expect(renderHook(() => useGridZoom('grid')).result.current[1]).toBe(100)
		})

		it('starts at 100% when storage cannot be read at all', () => {
			vi.stubGlobal('localStorage', failingStorage())

			expect(renderHook(() => useGridZoom('grid')).result.current[1]).toBe(100)
		})
	})

	describe('zooming in', () => {
		it('steps up, and remembers the level', () => {
			const { result } = renderHook(() => useGridZoom('grid'))

			act(() => result.current[0].zoomIn())

			expect(result.current[1]).toBe(100 + ZOOM_STEP)
			expect(stored.get('grid-zoom-scale:grid')).toBe(String(100 + ZOOM_STEP))
		})

		it('stops at the most it allows', () => {
			stored.set('grid-zoom-scale:grid', String(ZOOM_MAX - ZOOM_STEP / 2))
			const { result } = renderHook(() => useGridZoom('grid'))

			act(() => result.current[0].zoomIn())
			expect(result.current[1]).toBe(ZOOM_MAX)

			act(() => result.current[0].zoomIn())
			expect(result.current[1]).toBe(ZOOM_MAX)
		})

		it('carries on past that when asked to, as the wheel does', () => {
			stored.set('grid-zoom-scale:grid', String(ZOOM_MAX))
			const { result } = renderHook(() => useGridZoom('grid'))

			act(() => result.current[0].zoomIn(true))

			expect(result.current[1]).toBe(ZOOM_MAX + ZOOM_STEP)
		})

		it('takes every step of a burst, rather than losing those which land before a render', () => {
			const { result } = renderHook(() => useGridZoom('grid'))

			act(() => {
				result.current[0].zoomIn()
				result.current[0].zoomIn()
				result.current[0].zoomIn()
			})

			expect(result.current[1]).toBe(100 + 3 * ZOOM_STEP)
			expect(stored.get('grid-zoom-scale:grid')).toBe(String(100 + 3 * ZOOM_STEP))
		})
	})

	describe('zooming out', () => {
		it('steps down, and remembers the level', () => {
			const { result } = renderHook(() => useGridZoom('grid'))

			act(() => result.current[0].zoomOut())

			expect(result.current[1]).toBe(100 - ZOOM_STEP)
			expect(stored.get('grid-zoom-scale:grid')).toBe(String(100 - ZOOM_STEP))
		})

		it('stops at the least it allows', () => {
			stored.set('grid-zoom-scale:grid', String(ZOOM_MIN + ZOOM_STEP / 2))
			const { result } = renderHook(() => useGridZoom('grid'))

			act(() => result.current[0].zoomOut())
			expect(result.current[1]).toBe(ZOOM_MIN)

			act(() => result.current[0].zoomOut())
			expect(result.current[1]).toBe(ZOOM_MIN)
		})

		it('carries on past that when asked to, but never to nothing', () => {
			stored.set('grid-zoom-scale:grid', String(ZOOM_MIN))
			const { result } = renderHook(() => useGridZoom('grid'))

			act(() => result.current[0].zoomOut(true))
			expect(result.current[1]).toBe(ZOOM_MIN - ZOOM_STEP)

			for (let i = 0; i < 10; i++) act(() => result.current[0].zoomOut(true))
			expect(result.current[1]).toBe(10)
		})
	})

	describe('setting a level', () => {
		it('goes back to 100%, and remembers it', () => {
			stored.set('grid-zoom-scale:grid', '150')
			const { result } = renderHook(() => useGridZoom('grid'))

			act(() => result.current[0].zoomReset())

			expect(result.current[1]).toBe(100)
			expect(stored.get('grid-zoom-scale:grid')).toBe('100')
		})

		it('takes the level it is given as it is', () => {
			const { result } = renderHook(() => useGridZoom('grid'))

			act(() => result.current[0].setZoom(137))

			expect(result.current[1]).toBe(137)
			expect(stored.get('grid-zoom-scale:grid')).toBe('137')
		})

		it('still zooms when storage refuses to remember it', () => {
			const { result } = renderHook(() => useGridZoom('grid'))
			vi.stubGlobal('localStorage', failingStorage())

			act(() => result.current[0].zoomIn())

			expect(result.current[1]).toBe(100 + ZOOM_STEP)
		})
	})

	it('hands back the same controller as the level changes, so what uses it does not redo its work', () => {
		const { result } = renderHook(() => useGridZoom('grid'))
		const controller = result.current[0]

		act(() => controller.zoomIn())

		expect(result.current[0]).toBe(controller)
	})
})

describe('fitZoom', () => {
	it('fits the width into the space', () => {
		expect(fitZoom(1000, 800)).toBe(80)
	})

	it('rounds down, so what it fits never overflows the space', () => {
		expect(fitZoom(1000, 879)).toBe(87)
	})

	it('does not shrink a very wide surface past the point its keys are too small to read', () => {
		expect(fitZoom(2000, 600)).toBe(FIT_ZOOM_MIN)
	})

	it('does not blow a small surface up past its natural size', () => {
		expect(fitZoom(300, 1200)).toBe(FIT_ZOOM_MAX)
	})

	it('reaches the ends of its range exactly', () => {
		expect(fitZoom(1000, FIT_ZOOM_MIN * 10)).toBe(FIT_ZOOM_MIN)
		expect(fitZoom(1000, FIT_ZOOM_MAX * 10)).toBe(FIT_ZOOM_MAX)
	})

	it.each([
		['the space has not been measured yet', 1000, 0],
		['the space is negative', 1000, -50],
		['there is nothing to fit', 0, 800],
		['the width is not a number', NaN, 800],
		['the space is not a number', 1000, NaN],
	])('stays at the natural size when %s', (_, width, space) => {
		expect(fitZoom(width, space)).toBe(FIT_ZOOM_MAX)
	})
})

describe('parseStoredZoom', () => {
	it('reads back a level, or fitting', () => {
		expect(parseStoredZoom('70')).toBe(70)
		expect(parseStoredZoom('72.5')).toBe(72.5)
		expect(parseStoredZoom('fit')).toBe('fit')
	})

	it.each([
		['nothing', null],
		['an empty value', ''],
		['something which is not a number', 'rubbish'],
		['zero', '0'],
		['a negative level', '-5'],
		['an infinite level', 'Infinity'],
	])('fits when %s was stored', (_, value) => {
		expect(parseStoredZoom(value)).toBe('fit')
	})
})

describe('useSurfaceZoom', () => {
	const KEY = 'grid-zoom-scale:surface:model:neo'

	describe('when no surface is being viewed as', () => {
		it('is not there, as the grid keeps its own zoom', () => {
			const { result } = renderHook(() => useSurfaceZoom(null, 80))

			expect(result.current).toBeNull()
		})

		it('takes up where it was once a surface is chosen', () => {
			stored.set(KEY, '120')
			const { result, rerender } = renderHook(({ key }) => useSurfaceZoom(key, 80), {
				initialProps: { key: null as string | null },
			})

			rerender({ key: 'model:neo' })

			expect(result.current?.value).toBe(120)
		})
	})

	describe('fitting', () => {
		it('fits a kind of surface not seen before, following the space as it changes', () => {
			const { result, rerender } = renderHook(({ fit }) => useSurfaceZoom('model:neo', fit), {
				initialProps: { fit: 80 },
			})

			expect(result.current?.value).toBe(80)
			expect(result.current?.fit.active).toBe(true)

			rerender({ fit: 70 })
			expect(result.current?.value).toBe(70)
		})

		it('fits when it was left fitting', () => {
			stored.set(KEY, 'fit')

			const { result } = renderHook(() => useSurfaceZoom('model:neo', 75))

			expect(result.current?.value).toBe(75)
			expect(result.current?.fit.active).toBe(true)
		})

		it('fits when what was stored cannot be used', () => {
			stored.set(KEY, 'rubbish')

			expect(renderHook(() => useSurfaceZoom('model:neo', 75)).result.current?.value).toBe(75)
		})

		it('fits when storage cannot be read at all', () => {
			vi.stubGlobal('localStorage', failingStorage())

			expect(renderHook(() => useSurfaceZoom('model:neo', 75)).result.current?.value).toBe(75)
		})

		it('goes back to fitting when asked, and remembers that', () => {
			stored.set(KEY, '150')
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))
			expect(result.current?.value).toBe(150)
			expect(result.current?.fit.active).toBe(false)

			act(() => result.current?.fit.enable())

			expect(result.current?.value).toBe(80)
			expect(result.current?.fit.active).toBe(true)
			expect(stored.get(KEY)).toBe('fit')
		})
	})

	describe('a level chosen by hand', () => {
		it('is the level, whatever the space', () => {
			stored.set(KEY, '130')
			const { result, rerender } = renderHook(({ fit }) => useSurfaceZoom('model:neo', fit), {
				initialProps: { fit: 80 },
			})

			rerender({ fit: 60 })

			expect(result.current?.value).toBe(130)
			expect(result.current?.fit.active).toBe(false)
		})

		it('zooms in on from the fitted level, and stops fitting', () => {
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))

			act(() => result.current?.controller.zoomIn())

			expect(result.current?.value).toBe(80 + ZOOM_STEP)
			expect(result.current?.fit.active).toBe(false)
			expect(stored.get(KEY)).toBe(String(80 + ZOOM_STEP))
		})

		it('zooms out on from the fitted level, and stops fitting', () => {
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 65))

			act(() => result.current?.controller.zoomOut())

			expect(result.current?.value).toBe(65 - ZOOM_STEP)
			expect(result.current?.fit.active).toBe(false)
		})

		it('stops zooming in at the most it allows, unless asked to carry on', () => {
			stored.set(KEY, String(ZOOM_MAX))
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))

			act(() => result.current?.controller.zoomIn())
			expect(result.current?.value).toBe(ZOOM_MAX)

			act(() => result.current?.controller.zoomIn(true))
			expect(result.current?.value).toBe(ZOOM_MAX + ZOOM_STEP)
		})

		it('stops zooming out at the least it allows, unless asked to carry on - but never to nothing', () => {
			stored.set(KEY, String(ZOOM_MIN))
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))

			act(() => result.current?.controller.zoomOut())
			expect(result.current?.value).toBe(ZOOM_MIN)

			act(() => result.current?.controller.zoomOut(true))
			expect(result.current?.value).toBe(ZOOM_MIN - ZOOM_STEP)

			for (let i = 0; i < 10; i++) act(() => result.current?.controller.zoomOut(true))
			expect(result.current?.value).toBe(10)
		})

		it('goes to 100% on a reset, rather than back to fitting', () => {
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))

			act(() => result.current?.controller.zoomReset())

			expect(result.current?.value).toBe(100)
			expect(result.current?.fit.active).toBe(false)
			expect(stored.get(KEY)).toBe('100')
		})

		it('takes a level it is given as it is', () => {
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))

			act(() => result.current?.controller.setZoom(137))

			expect(result.current?.value).toBe(137)
			expect(stored.get(KEY)).toBe('137')
		})

		it('still zooms when storage refuses to remember it', () => {
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))
			vi.stubGlobal('localStorage', failingStorage())

			act(() => result.current?.controller.zoomIn())

			expect(result.current?.value).toBe(80 + ZOOM_STEP)
		})

		it('takes every step of a burst, rather than losing those which land before a render', () => {
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))
			const controller = result.current!.controller

			act(() => {
				controller.zoomIn()
				controller.zoomIn()
				controller.zoomIn()
			})

			expect(result.current?.value).toBe(80 + 3 * ZOOM_STEP)
			expect(stored.get(KEY)).toBe(String(80 + 3 * ZOOM_STEP))
		})

		it('starts a burst from the space as it is now, not as it was when the controller was handed out', () => {
			const { result, rerender } = renderHook(({ fit }) => useSurfaceZoom('model:neo', fit), {
				initialProps: { fit: 80 },
			})
			const controller = result.current!.controller

			rerender({ fit: 60 })
			act(() => controller.zoomIn())

			expect(result.current?.value).toBe(60 + ZOOM_STEP)
		})
	})

	describe('several kinds of surface', () => {
		it('remembers each apart', () => {
			stored.set('grid-zoom-scale:surface:model:studio', '60')
			const { result, rerender } = renderHook(({ key }) => useSurfaceZoom(key, 80), {
				initialProps: { key: 'model:neo' },
			})

			act(() => result.current?.controller.setZoom(130))
			rerender({ key: 'model:studio' })
			expect(result.current?.value).toBe(60)

			rerender({ key: 'model:neo' })
			expect(result.current?.value).toBe(130)
		})

		it('fits one not seen before, whatever the last was set to', () => {
			const { result, rerender } = renderHook(({ key }) => useSurfaceZoom(key, 80), {
				initialProps: { key: 'model:neo' },
			})

			act(() => result.current?.controller.setZoom(130))
			rerender({ key: 'model:plus' })

			expect(result.current?.value).toBe(80)
			expect(result.current?.fit.active).toBe(true)
		})

		it('only touches the one being zoomed', () => {
			stored.set('grid-zoom-scale:surface:model:studio', '60')
			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))

			act(() => result.current?.controller.setZoom(130))

			expect(stored.get('grid-zoom-scale:surface:model:studio')).toBe('60')
		})

		it('does not share a zoom with the grid itself', () => {
			stored.set('grid-zoom-scale:grid', '150')

			const { result } = renderHook(() => useSurfaceZoom('model:neo', 80))
			act(() => result.current?.controller.setZoom(130))

			expect(result.current?.value).toBe(130)
			expect(stored.get('grid-zoom-scale:grid')).toBe('150')
		})
	})

	it('hands back the same zoom while nothing about it changes, so what uses it does not redo its work', () => {
		const { result, rerender } = renderHook(({ fit }) => useSurfaceZoom('model:neo', fit), {
			initialProps: { fit: 80 },
		})
		const first = result.current

		rerender({ fit: 80 })

		expect(result.current).toBe(first)
	})

	it('hands back the same controller as the level changes, so what uses it does not redo its work', () => {
		const { result, rerender } = renderHook(({ fit }) => useSurfaceZoom('model:neo', fit), {
			initialProps: { fit: 80 },
		})
		const controller = result.current!.controller

		act(() => controller.zoomIn())
		rerender({ fit: 70 })

		expect(result.current?.controller).toBe(controller)
	})
})
