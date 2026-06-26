import { mockDeep } from 'vitest-mock-extended'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'

const throwOnUnmocked = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

/**
 * Build a `DataUserConfig` mock for tests.
 *
 * Only the keys present in `values` are readable via `getKey()` — reading any other key throws, so a
 * test is forced to declare the config it actually depends on. Keys explicitly set to `undefined` count
 * as supported and return `undefined`.
 *
 * `values` is read live on each `getKey()` call, so a test can mutate the object it passed in to simulate
 * a configuration change (e.g. changing the timezone between ticks).
 *
 * Every other method on the mock throws (via vitest-mock-extended's fallback), matching the strict mocking
 * style used elsewhere (see Service/HttpApi.test.ts).
 */
export function mockUserConfig(values: Partial<UserConfigModel> = {}): DataUserConfig {
	return mockDeep<DataUserConfig>(throwOnUnmocked, {
		getKey: (key: keyof UserConfigModel) => {
			if (key in values) return values[key]
			throw new Error(`UserConfig key "${String(key)}" is not supported by this mock`)
		},
	})
}
