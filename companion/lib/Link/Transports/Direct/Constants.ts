/** The port direct connections are accepted on, unless configured otherwise */
export const DIRECT_DEFAULT_PORT = 16624

/**
 * The mDNS service type direct connections are announced as, so that other installations can find this one. Not
 * `companion-link`, which Apple devices announce for their own Companion Link protocol
 */
export const DIRECT_MDNS_SERVICE_TYPE = 'companion-link-ws'

/** The txt record key the Link id is announced under, so that an installation can leave itself out of discovery */
export const DIRECT_MDNS_LINK_ID_TXT = 'linkId'
