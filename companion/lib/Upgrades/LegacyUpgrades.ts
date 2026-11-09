import v1tov2 from './Legacy/v1tov2.js'
import v2tov3 from './Legacy/v2tov3.js'
import v3tov4 from './Legacy/v3tov4.js'
import v4tov5 from './Legacy/v4tov5.js'
import v5tov6 from './Legacy/v5tov6.js'
import v6tov7 from './Legacy/v6tov7.js'
import v7tov8 from './Legacy/v7tov8.js'
import v8tov9 from './Legacy/v8tov9.js'
import v9tov10 from './Legacy/v9tov10.js'
import v10tov11 from './Legacy/v10tov11.js'
import v11tov12 from './Legacy/v11tov12.js'
import v12tov13 from './Legacy/v12tov13.js'
import v13tov14 from './Legacy/v13tov14.js'
import v14tov15 from './Legacy/v14tov15.js'
import v15tov16 from './Legacy/v15tov16.js'
import v16tov17 from './Legacy/v16tov17.js'

/**
 * The steps from before the db and export versions were separate. Each upgrades both, so the two versions are the same
 * up to {@link LEGACY_VERSION}. New steps go in the data or export upgrades instead
 */
export const legacyUpgrades = [
	v1tov2, // 15 to 32 key
	v2tov3, // v3.0
	v3tov4, // v3.2
	v4tov5, // v3.5 - first round of sqlite rearranging
	v5tov6, // v3.5 - replace action delay property https://github.com/bitfocus/companion/pull/3163
	v6tov7, // v4.0 - rework 'entities' for better nesting https://github.com/bitfocus/companion/pull/3185
	v7tov8, // v4.0 - break out into more tables
	v8tov9, // v4.1 - convert button stepAutoProgress to stepProgression
	v9tov10, // v4.2 - surface integrations
	v10tov11, // v4.3 - internal action/feedback upgrade & options into ExpressionOrValue
	v11tov12, // v4.3 - surface plugin config field renames
	v12tov13, // v5.0 - graphics overhaul
	v13tov14, // v5.0 - split fontsize into size + allowShrink
	v14tov15, // v5.0 - move surface never_lock to the surface group
	v15tov16, // v5.0 - replace remove_topbar boolean with buttons_decoration enum
	v16tov17, // v5.1 - give style elements their default pinned properties
]

/** The db and export version reached by the legacy steps, from which the two continue separately */
export const LEGACY_VERSION = legacyUpgrades.length + 1
