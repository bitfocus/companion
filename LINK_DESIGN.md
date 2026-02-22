# Companion Link Design Document

**Status:** Planning  
**Date:** February 14, 2026  
**Purpose:** Replace deprecated Bitfocus Cloud with self-hosted MQTT-based "Companion Link"

## Overview

Deprecate the centralized Bitfocus Cloud service and replace it with a modular, self-hosted "Companion Link" system using MQTT 5.0 as the first transport backend. Enable remote button control and state synchronization via selective subscription event bus with service discovery and chunking support for large messages.

**Critical:** Keep existing [companion/lib/Cloud/](companion/lib/Cloud/) code completely untouched.

## Architecture

### Core Components

- **LinkController** - Main orchestrator (replaces CloudController for Link)
- **LinkTransport** - Abstract transport interface
- **MqttTransport** - First implementation using MQTT 5.0
- **Protocol Messages** - Transport-agnostic message types with JSON Schema
- **ChunkManager** - Handles chunking/reassembly for large messages
- **PeerRegistry** - Tracks discovered peers (online/offline) and which transports they're reachable on
- **TransportManager** - Manages multiple transport instances, routes messages appropriately

### Transport Decision: MQTT vs Redis

**Chosen: MQTT 5.0**

Reasons:

- Purpose-built for pub/sub event buses
- QoS levels for reliable delivery
- Native request/response with correlation data (MQTT 5)
- Better suited for geo-distributed multi-broker setups
- Lower self-hosting complexity (Mosquitto)
- Broker auth with username/password + optional TLS

**Library:** `mqtt` (MQTT.js) - Industry standard, TypeScript support

---

## Implementation Plan

### Step 1: Create Transport-Agnostic Link Architecture

**Location:** [companion/lib/Service/Link/](companion/lib/Service/Link/)

**Core Protocol Messages:**

- `Announcement` - Service discovery broadcast
- `GoingOffline` - Graceful shutdown notification
- `SubscribeRequest` - Request button state updates
- `SubscribeResponse` - Initial state for subscribed buttons
- `UnsubscribeRequest` - Stop receiving updates
- `ButtonStateUpdate` - Button pressed/released/style changed
- `ButtonPressCommand` - Remote button press
- `ButtonReleaseCommand` - Remote button release
- `BitmapRequest` - Request bitmap at specific resolution
- `BitmapResponse` - Rendered bitmap (chunked if >63KB)
- `ChunkMessage` - Generic chunking envelope

**Schema:** AsyncAPI for protocol documentation (message-based async protocol), JSON Schema for message payload validation, versioned (starting v1)

**LinkTransport Interface:**

```typescript
abstract class LinkTransport {
	abstract connect(config: TransportConfig): Promise<void>
	abstract disconnect(): Promise<void>
	abstract publish(topic: string, message: any, options?: PublishOptions): Promise<void>
	abstract subscribe(pattern: string, handler: MessageHandler): Promise<void>
	abstract unsubscribe(pattern: string): Promise<void>
	abstract request(topic: string, message: any, timeout?: number): Promise<any>
}
```

**LinkController:**

- Manages transport lifecycle
- Coordinates peer discovery
- Handles subscription management (deduplicates MQTT subscriptions locally)
- Routes messages between transport and internal systems
- Maintains peer registry

---

### Step 2: Implement Service Discovery with Offline Handling

**Discovery Protocol:**

**Announcement:**

- **Frequency:** Every 30-60 seconds
- **Topic:** `companion-link/discovery/{uuid}`
- **Retained:** Yes (so new peers see existing instances)
- **Message:**

  ```json
  {
  	"id": "uuid-v4",
  	"name": "Studio 1 Companion",
  	"version": "3.x.x",
  	"protocolVersion": 1,
  	"pageCount": 99,
  	"gridSize": { "rows": 8, "cols": 8 },

  	"timestamp": 1234567890
  }
  ```

**Going Offline:**

- **Topic:** `companion-link/discovery/{uuid}`
- **Retained:** Yes (publish empty message to clear retained announcement)
- **Sent on:** Graceful shutdown, user disable

**Peer Registry:**

- Maintains list of discovered peers in memory
- Tracks which transport instances each peer is reachable on
- Tracks online/offline status per transport based on timestamp
- Mark offline on specific transport if no announcement received for 2× interval (60-120s)
- Peer shown as online if reachable on at least one transport
- **Never** delete other installations from transport layer
- Persist offline peers in DB for UI display
- User can manually delete peers from UI

---

### Step 3: Implement MQTT 5.0 Transport Backend

**Library:** `mqtt` (MQTT.js)

**Configuration (per transport instance):**

- Broker URL - single broker endpoint
- Username + Password (broker auth)
- Optional TLS
- Client ID: `companion-link-{uuid}-{transport-id}`
- Clean session: false (persistent)
- QoS: 1 (at-least-once delivery)
- Optional: Internal failover broker URLs (transport-managed)

**Topic Hierarchy:**

```
companion-link/discovery/{uuid}                              # Service discovery (retained)
companion-link/{uuid}/location/{page}/{row}/{col}/bitmap     # Button bitmaps (or chunks)
companion-link/{uuid}/location/{page}/{row}/{col}/state      # Button state updates
companion-link/{uuid}/location/{page}/{row}/{col}/press      # Press commands
companion-link/{uuid}/location/{page}/{row}/{col}/release    # Release commands
companion-link/{uuid}/rpc/{correlationId}/request            # RPC requests
companion-link/{uuid}/rpc/{correlationId}/response           # RPC responses
companion-link/chunks                                        # Chunked messages (all instances)
```

**Design Notes:**

- Per-location topics for bitmaps enable efficient multi-client subscriptions
- Clients MQTT-subscribe to specific location topics
- Clients send application-level `SubscribeRequest` to tell instance to start publishing
- Instance publishes bitmaps/states only for subscribed locations
- Multiple clients can subscribe to same location without duplicate publishing

**Multi-Transport Instance Support:**

- User can add multiple transport instances (e.g., multiple MQTT brokers)
- Each transport instance = single logical connection
- LinkController tracks which peers are reachable via which transports
- Messages sent over all available transports to a peer (initial implementation)
- Future: Configurable redundancy level (e.g., use best 2-3 paths instead of all)
- Each transport instance managed independently
- Peer discovery happens per-transport, aggregated by LinkController

---

### Step 4: Design Subscription-Based State Sync Protocol

**Flow:**

1. **Client subscribes to MQTT topics:**

   ```typescript
   mqtt.subscribe('companion-link/abc-123/location/1/2/3/bitmap')
   mqtt.subscribe('companion-link/abc-123/location/1/2/3/state')
   ```

2. **Client sends application-level SubscribeRequest:**
   - Via RPC to target instance
   - Message: `{buttons: [{page: 1, row: 2, col: 3, resolution: {width: 72, height: 72}}]}`
   - Tells instance what resolution to render for each location
   - Tells instance to start publishing to those location topics

3. **Instance responds with current state:**
   - `SubscribeResponse: {states: [{page: 1, row: 2, col: 3, ...bitmap}]}`
   - Bitmap rendered at requested resolution
   - Immediate delivery of initial state
   - No retained messages needed (initial state in response)

4. **Instance publishes updates to subscribed topics:**
   - Only for locations with active subscriptions
   - Publishes all subscribed resolutions for that location
   - Track subscriptions: `Map<location, Set<resolution>>`
   - Publishes to `companion-link/{uuid}/location/{page}/{row}/{col}/bitmap/{width}x{height}`
   - State topic remains resolution-agnostic: `companion-link/{uuid}/location/{page}/{row}/{col}/state`

5. **Client sends UnsubscribeRequest when done:**
   - When surface switches pages, send UnsubscribeRequest for resolutions no longer visible
   - When client disconnects, send UnsubscribeRequest for all active subscriptions
   - Allows server to immediately clean up unused caches
   - Fallback: server evicts cache after 5-minute timeout if no bitmap requests received

6. **Subscription deduplication:**
   - If multiple local buttons want same remote button at same resolution
   - LinkController deduplicates MQTT subscriptions internally
   - Single MQTT subscription per (location, resolution) pair
   - Fan-out to multiple local consumers

**Button State Update Message:**

- **Contains:** Only the rendered bitmap (PNG base64 or chunked)
- **No:** Text, colors, or other render properties
- Bitmap rendered with `show_topbar: false` always

---

### Step 5: Implement Chunking Protocol for Large Messages

**When:** Bitmap PNG >63KB (to stay under 64KB MQTT broker limit)

**Protocol:** Fire-and-forget chunking

**Message Format:**

```
{
  "id": "uuid-v4",         // Unique message ID
  "idx": 0,                // Chunk index (0-based)
  "total": 3,              // Total chunks
  "size": 45000,           // Total assembled size
  "crc": 123456789         // CRC32 of this chunk's data
}
\n
<binary chunk data>
```

**Topic:** `companion-link/chunks` (global) or per-instance topics

**Chunk Size:** ~63KB (64KB limit - 200 bytes JSON overhead)

**Sender:**

1. Split binary into chunks
2. Generate unique message ID
3. Publish all chunks with metadata
4. Fire-and-forget (no ACK)

**Receiver:**

1. Maintain reassembly buffers (Map<messageId, ChunkBuffer>)
2. Verify per-chunk CRC32
3. When all chunks received, assemble by index
4. Verify total size
5. Emit complete message
6. Cleanup buffer

**Timeouts:**

- 60 seconds from first chunk
- Discard incomplete messages on timeout
- Background cleanup task every 10 seconds

**Topic Strategy:**

- Use per-location AND per-resolution topics: `companion-link/{uuid}/location/{page}/{row}/{col}/bitmap/{width}x{height}`
- Publish chunks to resolution-specific topic
- Subscribers request specific resolution they need
- Multiple surfaces can request different resolutions for same button
- Efficient: Only renders resolutions that are actually requested

---

### Step 6: Build Bitmap Rendering Pipeline for Link

**Per-Resolution Rendering Strategy:**

When button state changes, LinkController needs to render for all subscribed resolutions:

```typescript
// Track active subscriptions per location
subscriptions: Map<LocationKey, Set<Resolution>>

// On button state change for location
const resolutions = subscriptions.get(locationKey)
for (const { width, height } of resolutions) {
	renderAndPublish(page, row, col, width, height)
}
```

**Resolution-Aware Caching:**

- Cache key: `${page}:${row}:${col}:${width}x${height}`
- Only render resolutions that are actively subscribed via SubscribeRequest
- Track subscriptions explicitly: client must send UnsubscribeRequest when no longer needs a resolution
- Timeout-based eviction: if no bitmap requested for a resolution in 5 minutes, evict from cache
- Client responsibility: send UnsubscribeRequest when switching pages/disconnecting to allow immediate cleanup
- Memory-bounded: only caches what's in use + short timeout window

**Rendering Flow:**

1. **Render button at requested resolution:**
   - Use [GraphicsRenderer](companion/lib/Graphics/Renderer.ts)
   - Set `show_topbar: false` before rendering
   - Call `drawButtonImageUnwrapped()` with target resolution directly
   - NO need for transformButtonImage scaling - render native
2. **Encode as PNG:**
   - Via [ImageResult](companion/lib/Graphics/ImageResult.ts)
   - PNG compression keeps most buttons <30KB
3. **Check size and chunk if needed:**
   - If PNG >63KB, use chunking protocol
   - Publish chunks to `companion-link/{uuid}/location/{page}/{row}/{col}/bitmap/{width}x{height}`
4. **Latency Optimization:**
   - First subscription: Render on-demand (unavoidable latency)
   - Subsequent updates: Pre-rendered and cached per resolution
   - Button state change triggers re-render for all active resolutions simultaneously

**Alternative for Simple Buttons (Future Optimization):**

- For text-only buttons without custom images, could send style JSON instead
- Client renders locally (zero latency, minimal bandwidth)
- Falls back to bitmap for complex buttons
- Not part of MVP

**Message Payload:**

- `BitmapResponse: {png: base64, width, height}` - if <63KB
- Or send via chunking protocol - if ≥63KB

---

### Step 7: Port bitfocus-cloud Module to Internal Link Actions

**Source:** [bundled-modules/bitfocus-cloud/](bundled-modules/bitfocus-cloud/)

**Target:** Internal actions (core Companion)

**Remote Control Reference (Preferred):**

- New control type: `remote_link`
- Directly references a remote button by instance UUID + page/row/col
- Automatically mirrors remote button bitmap and state
- Pressing local button triggers press on remote button
- Simplifies 99% use case: just showing/controlling remote buttons
- User selects: target instance (from discovered peers) + location
- No manual action/feedback configuration needed

**Internal Actions (Alternative/Advanced):**

- `companion_link_press_button` - Press button on remote instance
- `companion_link_release_button` - Release button on remote instance
- `companion_link_set_page` - Change page on remote instance

**Internal Feedbacks (Alternative/Advanced):**

- `companion_link_button_state` - Show state of remote button
- Implements subscription to remote button states

**Note:** Both approaches should be available - remote control references for simple mirroring, actions/feedbacks for custom integration

**Visibility:**

- Only show when Link transport is configured and enabled
- Check in action/feedback `isVisible()` methods

**Target Selection:**

- Dropdown of discovered peers from PeerRegistry
- User selects remote instance by name/ID
- Actions use selected peer's UUID for routing

**Implementation:**

1. Extract button trigger logic from module
2. Create internal action/feedback definitions
3. Use LinkController to send commands via transport
4. Subscribe to remote button states for feedback
5. Deduplicate subscriptions in LinkController

**Bundled Module:**

- Mark as deprecated in next release
- Provide migration guide
- Eventually remove from bundled-modules/

---

### Step 8: Build Link Configuration UI

**Location:** [webui/src/Pages/Link/](webui/src/Pages/Link/)

**Separation:** Completely separate from [Pages/Cloud/](webui/src/Pages/Cloud/) (leave untouched)

**UI Components:**

1. **Transport Instance Management**
   - List of configured transport instances
   - Add/Edit/Delete transport instance
   - Transport type selector (MQTT, WebRTC, etc.)
   - Per-transport configuration fields:
     - MQTT: Broker URL, Username, Password, Enable TLS
   - Connection status indicator per instance (green/red/yellow)
   - Test connection button per instance
   - Enable/disable individual transport instances

2. **Multi-Transport Setup**
   - Support adding multiple transport instances of same or different types
   - Each transport instance managed independently
   - Show connection status per instance
   - Future: Redundancy level setting (how many paths to use per peer)

3. **Instance Identity**
   - Display current UUID
   - Button to regenerate UUID (with warning)
   - Display instance name (editable)

4. **Discovered Peers Table**
   - Columns: Name, UUID, Status (Online/Offline), Version, Transports, Last Seen, Actions
   - Status badge (green=online, gray=offline)
   - Transports column: List of transport instances peer is reachable on
   - Last seen timestamp (per transport)
   - Manual delete button (trash icon)
   - Auto-refresh every 10 seconds

5. **Transport Selector**
   - Dropdown: "MQTT" (only option initially)
   - Placeholder for future: WebRTC, WebSocket, etc.
   - Grayed out options with "Coming Soon"

6. **Enable/Disable Toggle**
   - Master switch for Link service
   - Shows warning when disabling (peers will see as offline)

**State Management:**

- Store transport instance configs in DB
- Real-time peer updates via websocket from backend
- Persist offline peers for UI display

**TransportManager:**

- Manages lifecycle of all transport instances
- Routes outgoing messages to appropriate transports
- Aggregates peer discovery from all transports
- Initial implementation: Send messages over all available transports to a peer
- Future optimization: Configurable redundancy (e.g., use best 2-3 paths based on latency/reliability)
- Handles transport-specific failures gracefully

---

## Technical Specifications

### JSON Schema Examples

**Announcement Message:**

```json
{
	"$schema": "https://json-schema.org/draft/2020-12/schema",
	"type": "object",
	"properties": {
		"version": { "type": "number", "const": 1 },
		"type": { "type": "string", "const": "announcement" },
		"payload": {
			"type": "object",
			"properties": {
				"id": { "type": "string", "format": "uuid" },
				"name": { "type": "string" },
				"version": { "type": "string" },
				"protocolVersion": { "type": "number" },
				"pageCount": { "type": "number" },
				"gridSize": {
					"type": "object",
					"properties": {
						"rows": { "type": "number" },
						"cols": { "type": "number" }
					},
					"required": ["rows", "cols"]
				},
				"timestamp": { "type": "number" }
			},
			"required": ["id", "name", "version", "protocolVersion", "pageCount", "gridSize", "timestamp"]
		}
	},
	"required": ["version", "type", "payload"]
}
```

**ButtonPressCommand:**

```json
{
	"version": 1,
	"type": "button.press",
	"payload": {
		"page": 1,
		"row": 2,
		"col": 3,
		"timestamp": 1234567890
	}
}
```

**SubscribeRequest:**

```json
{
	"version": 1,
	"type": "subscribe.request",
	"payload": {
		"buttons": [
			{
				"page": 1,
				"row": 2,
				"col": 3,
				"resolution": {
					"width": 72,
					"height": 72
				}
			},
			{
				"page": 1,
				"row": 2,
				"col": 4,
				"resolution": {
					"width": 128,
					"height": 128
				}
			}
		],
		"timestamp": 1234567890
	}
}
```

**SubscribeResponse:**

```json
{
	"version": 1,
	"type": "subscribe.response",
	"payload": {
		"states": [
			{
				"page": 1,
				"row": 2,
				"col": 3,
				"bitmap": "<base64-encoded PNG>",
				"pressed": false
			}
		],
		"timestamp": 1234567890
	}
}
```

### Transport Abstraction Notes

The MQTT transport will abstract transport-specific features (correlation data, QoS) internally. Future transports (WebRTC, WebSocket, Redis) will need to provide equivalent guarantees:

- **Reliability:** At-least-once delivery (MQTT QoS 1)
- **Ordering:** Best-effort (not strictly required)
- **Request/Response:** RPC pattern with timeout
- **Pub/Sub:** Topic-based with wildcard subscriptions

The core protocol remains transport-agnostic. Each transport implementation maps core protocol concepts to transport-specific mechanisms.

---

## Further Considerations (To Be Resolved)

### 1. Button State Message Granularity

**Decision:** Only send rendered bitmap (PNG base64 or chunked)

### 2. Discovery Announcement Retention

**Open Question:** When publishing `GoingOffline`, should we:

- Option A: Publish empty retained message to clear announcement?
- Option B: Publish GoingOffline as retained so peers know it's intentional?

### 3. Subscription Multiplexing

**Decision:** Deduplicate MQTT subscriptions locally in LinkController

### 4. Chunking Topic Strategy

**Decision:** Use per-location AND per-resolution topics `companion-link/{uuid}/location/{page}/{row}/{col}/bitmap/{width}x{height}` for efficiency. Each subscription specifies desired resolution. Multiple surfaces can request different resolutions for the same button.

### 5. Multi-Resolution Rendering Strategy

**Decision:**

- Clients include desired resolution in SubscribeRequest
- Server renders and caches per (location, resolution) pair
- Track subscriptions: `Map<location, Set<resolution>>`
- Only render resolutions actually in use
- First subscription has initial render latency (unavoidable)
- Subsequent updates are instant from cache
- When button state changes, re-render all subscribed resolutions simultaneously

**Memory Management:**

- Only cache resolutions actively subscribed
- When last subscriber for a resolution unsubscribes, evict that cache entry
- Cache key: `${page}:${row}:${col}:${width}x${height}`

### 6. Transport Abstraction Leak

**Note:** MQTT-specific features (correlation data, QoS) won't map directly to other transports. The MQTT transport class will handle enough abstraction internally to make this work. Implementation details to be determined during development.

### 7. Latency Measurement Per Transport

**Decision:** Measure round-trip latency to each peer over each transport instance.

**Implementation:**

- Send periodic ping/pong messages to discovered peers
- Track RTT (round-trip time) per (peer, transport) tuple
- Store in PeerRegistry alongside connection status
- Display in UI for observability

**Usage:**

- **For now:** Display only - for monitoring and debugging
- **Future:** May be used for intelligent routing decisions (select fastest N transports per peer)
- **Note:** Do NOT use for routing in initial implementation - all available transports used equally

**Frequency:**

- Measure every 30-60 seconds (align with announcement interval)
- Or on-demand when needed for debugging

---

## Migration from Cloud

**No migration support.** Clean break from Bitfocus Cloud.

Users must:

1. Set up their own MQTT broker
2. Configure Link in Companion
3. Manually recreate any cloud-based button integrations using new Link actions

---

## Dependencies

**New Package:**

- `mqtt` - MQTT.js library for MQTT 5.0 client

**Existing Libraries (Reused):**

- `@julusian/image-rs` - Image scaling/letterboxing
- Canvas/graphics system - Button rendering
- JSON Schema - Message validation

---

## Timeline & Phasing

**Phase 1:** Core architecture + MQTT transport (MVP)
**Phase 2:** Chunking protocol + bitmap rendering
**Phase 3:** Remote Link button control type + full wiring
**Phase 4:** Testing + documentation
**Phase 5:** Future transports (WebRTC, etc.)

---

## Phase 3 Implementation: Remote Link Button

### Control Type: `remotelinkbutton`

A new button control type that mirrors a button from a remote Companion instance.

**Files:**

- `shared-lib/lib/Model/ButtonModel.ts` — `RemoteLinkButtonModel`, `RemoteLinkButtonVisualState`, `RemoteLinkButtonRuntimeProps`
- `companion/lib/Controls/ControlTypes/LinkButton.ts` — `ControlButtonRemoteLink` class
- `companion/lib/Controls/ControlsTrpcRouter.ts` — `setLinkConfig` endpoint
- `webui/src/Buttons/EditButton/RemoteLinkButtonEditor.tsx` — Configuration UI
- `webui/src/Buttons/EditButton/EditButton.tsx` — Renders editor for `remotelinkbutton`
- `webui/src/Buttons/EditButton/SelectButtonTypeDropdown.tsx` — "Remote Link button" option

### Data Model

```typescript
interface RemoteLinkButtonModel {
	type: 'remotelinkbutton'
	peerUuid: string // Remote peer UUID (from PeerRegistry)
	page: string // Page number (supports variables/expressions)
	row: string // Row number (supports variables/expressions)
	col: string // Column number (supports variables/expressions)
}
```

### Visual States

| State           | Appearance                             | When                                |
| --------------- | -------------------------------------- | ----------------------------------- |
| `unknown_peer`  | "Unknown peer" text, cloud error icon  | Peer UUID not found in PeerRegistry |
| `unreachable`   | "Unreachable" text, cloud icon         | Peer known but offline              |
| `loading`       | "Loading..." text, cloud icon          | Subscribed, awaiting first bitmap   |
| `bitmap`        | Remote button's rendered bitmap        | Receiving updates from remote       |
| `loop_detected` | "Loop detected" text, cloud error icon | Source chain contains our own UUID  |

### Controller Wiring (LinkController)

**Inbound flow** (other peers subscribing to our buttons):

1. Listen for RPC subscribe requests on `rpcRequestWildcard(ourUuid)`
2. Add to SubscriptionManager → BitmapRenderer watches for changes
3. BitmapRenderer emits `bitmapReady` → publish `ButtonUpdateMessage` on MQTT
4. Listen for press/release commands → forward to `ControlsController.pressControl()`

**Outbound flow** (our link buttons subscribing to remote):

1. `controlCountChanged` event triggers `#syncOutboundSubscriptions()`
2. For each link button: resolve peer + location → send subscribe request
3. Subscribe to `updateWildcard(peerUuid)` on MQTT
4. On receiving `ButtonUpdateMessage`, check sourceChain for loops, feed to link button
5. On link button press, publish press/release command to remote peer

### Loop Detection

When receiving a `ButtonUpdateMessage`:

- If `sourceChain` contains our own UUID → set visual state to `loop_detected`
- Otherwise, display the bitmap normally

When publishing updates:

- Append our UUID to `sourceChain` so downstream instances can detect loops

### Press Forwarding

When a user presses a remote link button:

1. `ControlButtonRemoteLink.pressControl()` → calls `#onPress` callback
2. LinkController resolves the target peer + location
3. Publishes `ButtonPressMessage`/`ButtonReleaseMessage` on `pressTopic(peerUuid, page, row, col)`
4. Remote peer's LinkController receives it → calls `controls.pressControl(controlId, pressed, 'link')`

### TODO Items

- Resolve variables/expressions in page/row/col fields (currently only numeric parsing)
- Get actual pressed state of local buttons for outbound updates
- Track requestor UUID in subscribe requests for per-peer subscription management
- Send proper RPC responses with initial button state

---

## Open Questions

1. ~~Should we implement AsyncAPI instead of JSON Schema for message definitions?~~ **Resolved:** Use AsyncAPI for protocol docs, JSON Schema for payload validation
2. What broker(s) should documentation recommend for self-hosting?
3. Should we provide docker-compose examples for broker setup?
4. ~~How to handle version negotiation if protocol evolves?~~ **Resolved:** Include `protocolVersion` field in announcements, define handling when needed
5. What timeout value for cache eviction? (Currently proposed: 5 minutes)
6. Should remote control references support custom styling override, or strictly mirror remote?
7. How to select which transport instances to use when multiple paths available? (Initial: all, Future: configurable)
8. What criteria for "best N paths" selection? (Latency, reliability, manual priority?)
9. Should transport instances have user-defined names/labels for UI clarity?

---

**End of Design Document**
