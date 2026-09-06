import type { LicenseOverrides } from '@companion-module/tools/license'

/**
 * Packages which ship no license declaration in their package.json, but whose license has been confirmed by reading
 * what they publish. Only add an entry after checking that version yourself, and record where the license was found.
 *
 * Keys are exact `name@version`, as a later release can change license. A declared license always wins over this
 * list, so an entry can never hide what a package says about itself.
 */
const KNOWN_PACKAGE_LICENSES: Record<string, string> = {
	// No overrides yet
}

/**
 * Packages which declare a license that is not a valid SPDX expression, mapped to what the license text they publish
 * actually is. Unlike KNOWN_PACKAGE_LICENSES this overrides what a package says about itself, so it is only
 * consulted when the declaration cannot be parsed, and can never turn a real license into a more convenient one.
 *
 * Only add an entry after reading the license text shipped in that exact version, and record what identified it.
 * Keys are exact `name@version`, so a later release declaring something different is unaffected.
 */
const CORRECTED_PACKAGE_LICENSES: Record<string, string> = {
	// Declares "MIT, BSD-3-Clause, BSD-2-Clause", which is the list of licenses that apply rather than an SPDX
	// expression. LICENSE is the MIT License, and LICENSE_node-segfault-handler is BSD-3-Clause, including the
	// clause forbidding use of the copyright holder's name to endorse derived products. Recorded as AND, since all
	// of them apply to the package rather than offering a choice, https://github.com/julusian/segfault-raub
	'@julusian/segfault-raub@2.3.3': '(MIT AND BSD-3-Clause AND BSD-2-Clause)',
}

/**
 * Companion keeps its own overrides rather than sharing the module tooling's, so that adding one is a change here
 * and not a release of @companion-module/tools, and so that neither repository carries entries for a dependency tree
 * it does not have.
 */
export const COMPANION_LICENSE_OVERRIDES: LicenseOverrides = {
	knownPackageLicenses: KNOWN_PACKAGE_LICENSES,
	correctedPackageLicenses: CORRECTED_PACKAGE_LICENSES,
}
