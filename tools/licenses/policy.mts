import type { LicensePolicyDescriptor } from '@companion-module/tools/license'

/**
 * How the shared policy engine talks about Companion itself. Modules declare a distribution license in their
 * manifest separately from the license of their source; Companion ships under the one license it is written under,
 * so it has no separate source license rule.
 */
export const COMPANION_LICENSE_POLICY: LicensePolicyDescriptor = {
	subject: 'application',
	distributionLicenseLocation: 'package.json',
	requiredSourceLicense: undefined,
	externaliseAdvice:
		'Add it to companionNativeExternals in tools/companion-externals.mts, so it is installed into dist/node_modules and loaded at runtime instead of being built into the bundle.',
	helpMessage:
		'Not sure what to do about these? Ask in the Bitfocus community Slack, we are happy to help you work out what they mean.',
}
