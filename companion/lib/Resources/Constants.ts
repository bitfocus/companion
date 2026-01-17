export const LEGACY_MAX_BUTTONS = 32
export const LEGACY_BUTTONS_PER_ROW = 8
export const LEGACY_BUTTONS_PER_COLUMN = 4

export const LEGACY_PAGE_COUNT = 99

export const DISABLE_IPv6 = !!process.env.DISABLE_IPV6
export const GLOBAL_BIND_ADDRESS = DISABLE_IPv6 ? '0.0.0.0' : '::'
