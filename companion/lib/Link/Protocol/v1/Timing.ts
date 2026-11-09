/** Timings of major version 1 of the Link protocol */

/** How long a subscription lasts without being renewed */
export const LINK_SUBSCRIPTION_LEASE_MS = 60_000

/** How often subscribers renew their subscriptions, comfortably inside the lease */
export const LINK_SUBSCRIPTION_RENEW_MS = 20_000

/** How long to wait for the answer to a `pages.request` */
export const LINK_PAGES_TIMEOUT_MS = 5_000

/** How long to wait for a pong before giving up on a ping */
export const LINK_PING_TIMEOUT_MS = 2_000

/**
 * How long after it is sent a press or rotation may still be acted on. Acting on one late (eg a camera cut seconds
 * after the button was pressed) is worse than not at all
 */
export const LINK_PRESS_EXPIRY_MS = 2_000

/**
 * How long an estimate of how far apart the clocks of two installations are is kept, unless a more accurate one is
 * measured, so that a clock that has been corrected is noticed
 */
export const LINK_CLOCK_ESTIMATE_MAX_AGE_MS = 5 * 60_000
