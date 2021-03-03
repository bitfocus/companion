# Bitfocus Companion

## Companion v2.1.1 - Release Notes

# 📣 ADDED CORE FEATURES

- RossTalk Listener: Companion can now listen to incoming RossTalk messages on Port 7788. Easily press Companion buttons from your Ross video switcher!
- Added internal action to change button text

# 🐞 BUG FIXES

- Add function check for module destroy (#1128)
- Admin interface would crash after a few days (#567)
- Fix Quote Glyph Alignments
- Internal Instance: fix exception for null exec path
- Streamdeck Library patch
- Bug fix for multiple up on latching buttons

# 🧩 NEW MODULES

- Audiostrom Live Professor
- Birddog VISCA Camera Control
- DataVideo VISCA Camera Control
- Denon Recorder
- Elgato Keylight/Ringlight
- Kramer VP773A
- Mode Lighting EDIN
- NETIO PowerBOX
- Newtek NDI Studio Monitor
- Open Weather REST
- Panasonic TV TH-Series
- Roland M5000 Audio Console
- Ross Video Caprica
- Tech Ministry Tally Arbiter
- TP-Link Kasa Smart Plug
- Ubiquiti Unifi

# 👍🏻 MODULE IMPROVEMENTS

- AJA Ki Pro: Feedback support for transport states, support to load clips by list of clips, various bug fixes/improvements
- Allen & Heath DLive: added support for iLive models
- ATEN Matrix: documentation updated
- Audivero Unity Intercom: bug fixes
- Behringer X32: Various improvements to fader levels
- Behringer xAir: Support for relative fader actions; adds solo bus actions, feedbacks, and variables; Adds presets
- Blackmagic ATEM: Added support for latest models, new connection protocol, supersource relative changes, in-transition feedback, Mini Pro Record and Stream control, audio input controls
- Blackmagic HyperDeck: cleanup and bug fixes
- Blackmagic SmartView: Bug fixes
- Chamsys MagicQ UDP: bug fixes
- Denon DN500BD MKII: documentation fix
- Digico OSC: Add models and different commands
- Disguise: Added variables, presets, and feedbacks
- Extron SMP351: Bug fixes and cleanup
- Figure 53 QLab Advance: reduce log spam
- For-A HVS: Adds support for variables
- Generic PJLink: change commands to upper case
- Generic TCP/UDP: Fixed to pre-encode send buffer
- Generic Wake On Lan: Destination option added
- GlobalCache ITAC IR: Regex fix for IR codes
- GrassValley AMP: Recording clip support; bug fixes; feedbacks,
- H2R Graphics: Add missing commands, bug fixes
- HaiVision ConnectDVR: Bug fixes
- HomeAssistant Server: bug fixes
- James Holt X32TC: Support for latest X32TC 2.11 release; adds spare backup commands
- Lyntec RPC Breaker: Logging cleanup
- Magewell Ultrastream: Bug fix for authorization errors
- OBS Studio: Trigger Hotkey action, Bug fixes
- Novastar Controller: added support for NovaProUHDJr, VX4S presets
- piXap piXtimer Pro: Added adjust speaker timer time
- Planning Center Services Live: Bug fix to show correct Plan sort order
- PTZ Optics VISCA: Added power option, Focus lock/unlock, bug fixes
- Renewed Vision ProPresenter: Bug fixes and performance improvements
- Roku TV: Bug fixes and better error handling
- Roland V60HD: Bug fix for Split button function
- Ross Video RossTalk: allow for bus selection in KeyTrans command; support for MEM command
- Singular Live Studio: Bug fixes, switch to using API URL/tokens, time controller node support
- Shure Wireless: Bug fixes and improvements
- Sonos Speakers: Bug fixes
- Sony VISCA: Increased preset count support
- StudioCoast vMix: Bug fixes; New presets, feedbacks, and variables
- Tech Ministry MIDI Relay: support for dummy midi port in list selection
- Teradek VidiU: bug fixes
- TheLightingController: documentation update
- VICREO Hotkey: added extra action for keynote
- VideoLan VLC: Playlist shuffle option, variables and feedback
- Vivitek Projector: Added alternate shutter command
- Vizio Smartcast: bug fixes
- Yamaha SCP: Adds Surr/Div commands
- YouTube Live: Documentation updated, bug fixes

## Companion v2.1.0 - Release Notes

# ⭐️ ADDED CORE FEATURES

- Support for Stream Deck XL
- Support for the newer hardware revisions of the Original 15-key Stream Deck
- Elgato Stream Deck plugin is updated to support Stream Deck XL and to let you choose between static and dynamic buttons. Now you can use folders in the Stream Deck application to contain a specific page in companion without actually "changing pages" in companion.
- Auto-completion of dynamic variables in bank button text. Just start typing with $( and Companion will auto-complete as you type!
- Page buttons can now be (re)moved on a per-page basis.
- New improved and responsive tablet/web buttons page.
- Emulator and the web UI updated to Stream Deck XL size.
- Created CompanionPi, an OS image complete with Companion for use on a Raspberry Pi 4 (4GB minimum recommended).
- Added support for dSan, MasterCue, and Logitech wireless presenter remotes for use with the Emulator.
- Ability to set button style via HTTP.
- Jump to page ability in Web Interface.
- Module help button added to the instance config page (#1042).

# 👍🏻 CORE IMPROVEMENTS

- Refactor Stream Deck code to be less duplicated and have better error handling.
- Support subscribe/unsubscribe callbacks on actions, same as feedbacks.
- Support callback on actions, same as feedback.
- New module data types added: select2, checkbox, number range.
- Added time variables for h, m, s in the internal module.
- Guard against misbehaving api clients sending new_device multiple times.
- Ensure db_save is done when resetting bank feedback and when copying a preset.
- Convert old text style bank styles to png (next gen).
- Display status text even if status is UNKNOWN.
- Clone the dragged preset to show it's being copied not moved (#1044).
- Sort instance category/manufacturer lists by name.
- Sort instances now case insensitive. Sort products too.
- Add missing uncaughtexception and unhandledrejection handlers for USB devices.
- Never add Stream Deck devices if the Stream Deck application is running (Windows only).
- Fix broken link for Raspberry Pi instructions.
- Fix broken link for Bitfocus Slack Chat
- Add settings option to enable/disable the MasterCue/dSan/Logitech keys for the Emulator.
- Fix sharp library errors on Linux.
- Show a warning in the UI when a USB scan ignores any Stream Decks.
- Added shell command timeout to internal module.
- Re-added all_ip variable to internal module.
- All network interfaces as variable to internal module.
- Removed 127.0.0.1 from the first ip in the internal module.
- Suppressed MaxListenersExceededWarning warning at startup.
- Handled preset text being undefined.
- Fixed order of combining feedback styles. Update button feedback on reorder.
- Made gettingstarted.md available through the interface.
- All internal links are now prefixed.
- Fix positioning and sizing of number range/spinner controls for smaller screens (#1035).
- Improved the layout of number range/spinner actions for smaller screens.
- Removed horizontal padding on number range control.
- Add feedback hooks (refresh, subscribe, unsubscribe).
- Remove double version number from admin top bar of web GUI interface.
- Fixes issues where the cursor would jump to the end of input when editing text.
- Added sharp scaling queue.
- Added categories for user config page.
- Added support for static button presses from the Stream Deck plugin.
- Windows installer image update.

# 💣 CORE BUG FIXES

- Latching 🙌🏻
- Fixed major bug in telnet module, where sockets would eventually stop and telnet protocol was not actually handled properly.
- Removing a hack as it failed windows builds 🤷🏻‍♂️
- Queued calls to sharp and ensure multiple for the same key are not run in parallel to avoid race conditions.
- Instance feedback definitions not getting deleted.
- Feedback list in UI not updating.
- Typo in Stream Deck image_write_queue.
- Emulator bug making button content disappears if page loads slowly on adding device without a refresh.
- Log messages from Stream Deck devices.
- Bug with Stream Deck mini not working properly.

# 🧩 NEW MODULES

Analog Way Live Premier

- This module allows you to control all models of Analog Way's LivePremier live image processing lineup.
- Recall Memory to Screen
- Recall Memory to Aux-Screen
- Recall Master-Memory
- Recall Multiviewer-Memory
- Set Screen Layer Source
- Set Aux-Screen Layer Source
- Set Native Background
- Set Multiviewer Widget Source
- Take Single Screen
- Take Single Aux-Screen
- Take all Screens and Aux-Screens
- Take multiple Screens and Aux-Screens

Analog Way Vertige

- Basic control functions on an Analog Way Vertige controller
- Load Preset
- Load Preset Template
- Load Source to Layer
- Take Preview to Program

ATEN Matrix

- Load profile
- Set crosspoint
- Feedbacks: crosspoint fg/bg color

Avolites AI

- Control Avolites AI media servers over Art-net
- File
- Play
- Stop
- Pause
- Intensity
- Speed
- Strobe
- Volume
- Color
- Action text change

AV ProConnect ACMX1616-AUHD

- Video Route
- Audio Route
- Enable/Disable Video
- Enable/Disable Audio
- Set Video Input Resolution
- Audio Matrix Mode
- LCD On Time
- Key Lock
- Factory Reset Device

Crystal SCTE

- Sends SCTE104 Insertion Commands to a Crystal Server
- Ad Start / End
- Splice Start / End

Cockos Reaper

- Updated HELP text
- Added feedback and presets

DA Share Multiplay

- Clear telnet client window
- Get Version
- Quit telnet session
- Go at current cue list position
- Stop all cues
- Fade all cues out
- Pause all playing cues
- Resume all paused cues
- Start/Stop/Reset the stopwatch
- Advance the current GO position
- Pause/Resume/Stop the currently selected cue
- Jump the currently selected cue to near the end
- Jump to next/previous track on the currently selected cue (playlist only)

Dahua Security PTZ

- Controls Dahua / Amcrest PTZ cameras
- Directional controls
- Focus/Zoom
- Recall Preset
- Set Default Speed
- Connection status
- Presets

DataVideo DVIP

- Switch PGM/PVW
- Transition controls
- Additional transition controls
- Keyer controls
- Select wipe
- Switch KEY/DSK/PIP AUX
- Switch HDMI/SDI Output
- FTB
- Logo controls
- Audio controls
- Audio source
- Load/Save user
- Streamer options
- Set input name
- Set bus matte color
- Menu controls
- Crosspoint controls
- Timer controls
- Function buttons
- Send hex value
- Feedbacks available for more or less everything

Denon DN 500DB MK II

- Power on / off
- Transport controls
- Change settings

Dexon Dimax

- Login
- Recall Layout
- Switch Video
- Switch Audio
- Set Transition Type

Dexon Divip

- Login
- Recall Layout
- Switch Audio

Dexon Matrix

- Connects to DEXON Matrix 4x4 & 8x4 4K HDBaseT.
- Force Login - Force login to the device with MD5 hashing
- User Preset Actions - Recall, Save & Clear User Presets
- Layout Actions - Recall, Save & Clear Layouts
- Rename Preset - Rename User Presets
- Rename Layouts - Rename Layouts
- Connect Video - Connect video input to an output
- Connect Audio - Connect audio input to an output
- Disconnect Video - Disconnect video input to an output
- Disconnect Audio - Disconnect audio input to an output
- Reboot - Reboots the DEXON Matrix unit
- Wakeup - Wakes up the DEXON Matrix from standby
- Standby - Puts the Dexon Matrix unit in standby

DiGiCo OSC

- Control DiGiCo audio mixers via OSC
- Set fader values
- Mute channels
- Phantom toggle
- Solo toggle
- Fire snapshots
- Run macros

DSan Limitimer

- Start/Stops timer with current duration
- Repeat timer
- Time Up/Down
- Sum-up Time Up/Down
- Set seconds
- Beep on/off
- Blink on/off
- Clear timer
- Select Program

DSan PerfectCue

- Forward
- Reverse
- Black Out on/off

Epiphan Pearl

- Change channel layout
- Start/stop streaming
- Start/stop recording
- Validation and error reporting fixes

Extron IN1604

- Switch input

Extron SMP111

- Start/Stop/Pause/Mark Recording
- Enable/Disable RTMP Push Stream (Start/Stop Streaming)
- Updated password, presets, variables

Faith Chapels Video Playout Server

- Roll/Stop/Pause Clip
- Next/Previous Clip

Figure 53 Go Button

- Start (cue)
- Go To (cue)
- Toggle Master Dim / Mute
- Hit x Go
- Hit x Stop
- Hit x Pause
- Set Selected Cue Color
- Send a currently unsupported command / with argument
- Set Master Volume dB
- GO
- Pause
- Stop
- Panic
- Reset
- Next / Previous Cue
- Resume
- Timer Start/Stop/Reset
- "Oops"
- Toggle Full Screen mode
- Toggle Master Volume visible
- Master Volume Step Up / Step Down

Figure 53 QView

- Controls a PDF viewer remotely
- Go to next/prev page
- Go to specific page

Figure 53 QLab ("Advance")

- Get feedback and variables from active cue
- Time remaining
- Clip name
- Cue colors
- Active workspace
- Button updates & better shutdown
- Prevent error on second disable instance
- Lots of bug fixing and improvements

Folivora BTT (BetterTouchTool)

- Execute assigned actions trigger by specifying an UUID

FOR-A HVS

- Supports HVS 100/110/2000 Models
- Change PVW/PGM sources
- Change AUX sources
- Cut & Auto transitions
- Recall events by id #
- Reboot the switcher
- Send the switcher a custom command through the websocket

Foscam PTZ

- Controls Foscam PTZ cameras
- Directional controls
- Focus/Zoom
- Recall Preset
- Set Default Speed
- Improved error detection

Gallery Virtual VTR Pro

- Transport controls
- Go to Beginning of current clip
- Locate to Timecode - values should be entered in HH:MM:SS:FF
- Load a clip by name from the clip bin - filename should be entered including the file extension.

Gefen DVI Matrix

- Route input to output
- Route input to all outputs
- Set input name
- Set output name
- Preset Recall/Save

Generic sACN

- Set value(s)
- Fade to values
- Set active scene
- Terminate stream
- Feedbacks: stream status, active scene

Generic TCP / UDP

- Allows the use of custom TCP and UDP commands
- Option to choose termination characters
- Correct line endings
- Changing end chars and the default end char.
- Added important message

Generic WOL (Wake On Lan)

- Wake up / turn on a computer remotely
- Sends magic packets to the specified MAC address, UDP port, and interval

Green Hippo Hippotizer

- Cut
- Fade
- Fade through Black
- Fade Up First
- Snap Start
- Snap End
- Send OSC Integer (trigger macros, etc.)

H2R (Here2Record) Graphics

- Clear all graphics
- Lower Thirds - Show
- Lower Thirds - Hide
- Ticker Show/Hide
- Timer Show/Hide
- Timer - Custom UP
- Timer - Custom DOWN
- Logo Show/Hide
- Message Show/Hide
- Break Show/Hide
- Haivision Connect DVR
- Loading/playing channels
- Play/pause
- Live output scrubbing (forward/backwards controls)
- Setting and recalling cue points
- Feedbacks
- Channel is active (changing colors)
- Channel is currently downloading/streaming (text and color changes)
- Output screen is playing/stopped
- Cue Points feedback (if saved), offering a screenshot and/or color changes
- Preview of current output

Haivision Connect DVR

- Play/Pause Toggle
- Load Channel
- Reboot Device
- Play
- Pause
- Set Cue Point
- Recall Cue Point

Home Assistant Server

- Controls the Home Assistant server software
- Set switch state
- Set light state
- Support script and binary sensor
- Entity name variables

James Holt X32 Theatre Control

- Helps you mix sound for theatre shows on a Behringer X32 or Midas M32 digital mixing console using control groups (DCAs).
- Go / Back / Jump to cue
- Jump to cue using numeric keypad
- Move edit selector
- Insert / Clone / Delete selected cue
- Unlock / Lock editing
- Undo / Redo
- Toggle backup channels

Joy Playdeck

- Presets included for all functions
- Available commands:
- Play - PLAY the selected Clip in the Playlist.
- Pause - PAUSE the Playback of the Playlist.
- Stop - STOP the Playback of the Playlist.
- Next Clip - The Playback jumps to the NEXT available Clip in the Playlist and also skips Block Separators (e.g. Pause, Stop).
- Previous Clip - The Playback jumps to the PREVIOUS available Clip BEFORE the current Clip in the Playlist and also skips Block Separators.
- Restart Clip - The Playback RESTARTS the current played Clip.
- Jump - JUMP to the end of the Clip in the Playlist with a certain amount of SECONDS left (set in Playdeck).
- Fade In - FADE IN of the current selected Clip in the Playlist.
- Fade Out - FADE OUT the Playback of the Playlist.
- Mute Audio - MUTE all Audio output of the Playlist.
- Unmute Audio - UNMUTE the Audio output of the Playlist.
- Activate All - ACTIVATE all Clips in the Playlist.
- Stop All Overlays - HIDE a certain Overlay.
- Play Overlay - SHOW one or more Overlays.
- Stop Overlay - HIDE a certain Overlay.
- Play Action - SHOW a certain Action.
- Select Block - SELECT a certain BLOCK (all Clips) in the Playlist.
- Activate Block - ACTIVATE a certain Block (all Clips) in the Playlist.
- Deactivate Block - DEACTIVATE a certain Block (all Clips) in the Playlist.
- Select Clip - SELECT a certain Clip in the Playlist.
- Activate Clip - ACTIVATE a certain Clip in the Playlist.
- Deactivate Clip - DEACTIVATE a certain Clip in the Playlist.
- Cue - CUE a certain Clip in the Playlist.
- Cue And Play - CUE AND PLAY a certain Clip in the Playlist.
- Start Recording - START a new recording.
- Stop Recording - STOP the current recording.

JVC PTZ Controller

- Zoom/Focus
- Set Zoom position: position 0-499
- Set preset zoom position in memory
- Gain control: +1 or -1 steps of 3db
- White balance control
- Iris open and close
- Adjust exposure setting
- Some text clarifications
- Added recording and tally actions
- Added feedback
- Listen to variable for tally

Kramer VP734

- Menu
- Top/Down/Left/Right
- Enter
- Blank/Freeze/Mute
- Set Input Source
- Auto switch Input
- Set Input source type (for input 1 & 2)

Kramer VS 41H

- Switch Outputs
- Lock/Unlock Front Panel

Lyntec RPC Breaker

- Breaker On
- Breaker Off
- Zone On
- Zone Off

Mikrotik Router OS

- Disable or enable an interface/port
- Send custom API command

Magewell Ultrastream

- Start/Stop Recording
- Start/Stop Streaming
- Show recording or streaming status

Magicsoft Recorder

- Provides basic control over MagicSoft Recorder.
- Available commands and presets in V1.0.0:
- Recording Start - Starts a recording on X channel with X name
- Recording Stop - Stops the recording on X channel
- Recording Split - Splits the recording on X channel
- Recording Mark - Pace a mark on the recording on X channel
- Recording Preset - Set a preset for the recording on X channel (Needs testing)
- Recording Time - Add time to the recording on X channel

MA Lighting MSC

- MIDI Show Control over Ethernet for MA lighting
- Goto a specific cue
- Pause/Resume an executor
- Move a fader to a specific position
- Fire a macro
- Switch an executor off
- Feedback: Executor active state feedback
- Feedback: Executor paused state feedback
- Feedback: Cue list/number
- Feedback: Fader position
- Added inc & dec support to fader action

Multicam Systems Multicam Suite

- Video Mixer
- Audio Profile
- Start Application
- Composer
- Recording (Start / Stop)
- Streaming (Start / Stop)
- Media List (Start, Pause, or Stop)
- Custom Commands

MQTT

- Update variable with value from MQTT topic
- Change colors from MQTT topic value
- Publish message
- Add proper feedback
- Use proper API to manage subscriptions

NewBlueFX Titler

- Feedbacks and variables

NovaStar Controller

- Controls MCTRL4K, VX4S, VX6S, or NovaProHD LED Processor.
- Change brightness
- Change test pattern
- Change display mode
- Change input
- Turn Picture In Picture on/off
- Change scaling
- Take command

Octova Pro DSX

- Connect to TX CH: (1-199)
- Scale RX Video Output
- Rotate RX Video Output
- Video ON
- Video OFF
- Reboot
- Reset Default

OpenLP HTTP

- Service - Next/Prev
- Slide - Next/prev
- Display mode
- Presets

Optoma Z28S

- Power On/Off

Panasonic Camera Controller

- Select camera
- Select group
- Select group + port
- Select port

Pangolin Beyond

- Set Brightness
- Select clip
- Start clip
- Set BPM
- BPM Tap
- Enable/Disable Output
- Blackout
- One cue
- Multi cue
- Click select
- Toggle
- Restart
- Flash
- Solo flash

Pixap PixTimerPro

- Recall timer preset
- Timer speaker play/pause/stop
- Timer session play/pause/stop
- Timer all play/pause/stop
- Recall message preset
- Message show/hide
- Black show/hide
- Set Countdown video time and play
- Set Countdown video time
- Countdown video play/stop

Presentation Tools APS

- Next in fullscreen
- Prev in fullscreen
- Next without putting to fullscreen
- Put current in fullscreen
- Close all except current
- Simulate keystroke

QSys Remote Control

- Control.Set
- Component.Set
- ChangeGroup.AddControl
- ChangeGroup.AddComponentControl
- ChangeGroup.Remove
- ChangeGroup.Destroy
- ChangeGroup.Invalidate
- ChangeGroup.Clear
- Mixer.SetCrossPointGain
- Mixer.SetCrossPointDelay
- Mixer.SetCrossPointMute
- Mixer.SetCrossPointSolo
- Mixer.SetInputGain
- Mixer.SetInputMute
- Mixer.SetInputSolo
- Mixer.SetOutputGain
- Mixer.SetOutputMute
- Mixer.SetCueMute
- Mixer.SetCueGain
- Mixer.SetInputCueEnable
- Mixer.SetInputCueAfl
- LoopPlayer.Start
- LoopPlayer.Stop
- LoopPlayer.Cancel
- Fixed termination bug

Roku TV

- This module will allow you to control your Roku TV using Roku's ECP protocol
- Power On/Off
- Change Input
- Launch App
- Volume Up/Down
- Key Down / Key Up / Key Press Controls
- Home
- Rewind / Fast Forward
- Play / Pause
- Select
- Left / Right / Down / Up
- Back
- Instant Replay / Skip Back
- Info
- Backspace
- Search
- Enter/OK
- Channel Up / Channel Down (for TV tuner)
- On Screen Keyboard Search (send literal strings)
- Find Remote (if supported by the device)
- Send Custom Command
- Variables: Active App / Input
- Other variables depending on Roku model/device
- Feedback: Selected App is Active
- Feedback: Selected Input is Active

Roland VR50HD-MKII

- Select video input
- Select transition effect
- Set video transition time
- Set the [PinP] button on/off
- Set the [PinP/KEY] button on/off
- Set the [STILL KEY] button on/off
- Set the [OUTPUT FADE] button on/off
- Set the [FREEZE/USER LOGO] button on/off
- Adjust volume of audio channels
- Adjust volume of main output
- Recall memory
- Select video for AUX bus
- Select source video for video input
- Select still image of the [STILL] button
- Select source image for STILL KEY
- Select source video for PinP
- Select source video for PinP/KEY
- Recall preset memory on remote camera
- Reset USB connection

Roland XS62S

- Action bug fixes

Ross Video NK Router

- Change crosspoint

Ross Xpression

- Clear framebuffers
- Clear layer in framebuffer
- Load all cues items to all framebuffers
- Load take item to air on layer
- Load take item to framebuffer layer
- Move Sequencer focus to next item
- Move Sequencer focus to previous item
- Ready item into a framebuffer layer
- Resume all layers in framebuffer
- Resume layer in framebuffer
- Set Preview to take item
- Set Sequencer focus to take item
- Take layer in framebuffer off air
- Take Sequencer item to air
- Take Sequencer item to air and advance next
- Take item off air
- Trigger simulated GPI
- Fix framebuffer handling

Sain Smart Relay

- Turn relay on/off

Sharp TV

- Quick Power on/off
- Standby Power on/off
- Input Select
- AV Mode Selection
- Set Volume
- View Mode
- Change Channel (Analog or Digital)
- Mute/Unmute Audio
- Surround Audio On/Off
- Toggle Closed Captions
- Set Sleep Timer

Shure PSM 1000

- Set channel name
- Set audio input level of channel
- Set frequency of channel
- Set RF TX level
- Set RF mute
- Set audio TX mode
- Set audio input line level
- Feedback: If the selected channel's RF is set to a level, change the color of the button.
- Feedback: If the selected channel's RF is muted/unmuted, change the color of the button.
- Feedback: If the selected channel's audio TX mode is set, change the color of the button.
- Feedback: If the selected channel's audio input line level is set, change the color of the button.
- Fix RF mute/unmute
- Fix frequency input

Shure Wireless

- This module will connect to these Shure receivers to provide feedback status as well as some control:
- Shure ULX-D (ULXD4, ULXD4D, ULXD4Q)
- Shure QLX-D (QLXD4)
- Shure Axient Digital (AD4D, AD4Q)
- Shure Microflex Wireless (MXWANI4, MXWANI8)
- Set Channel Name
- Mute/Unmute/Toggle Mute of Specific Channel (ULX & AD)
- Set Audio Gain of Specific Channel
- Increase Audio Gain of Specific Channel
- Decrease Audio Gain of Specific Channel
- Flash Lights on Receiver (ULX, AD, & MXW)
- Flash Lights on Receiver Channel (AD & MXW)
- Set slot RF output (AD only)
- Feedback: If the battery bar drops to or below a certain value, change the color of the button.
- Feedback: If the selected channel is muted, change the color of the button.
- Feedback: If the selected channel gets interference, change the color of the button.
- Feedback: If the selected channel's transmitter is powered off, change the color of the button.
- Fixes for AD series

Singular Live Studio

- Update Control Node
- Animate In
- Animate Out

Slack Webhooks

- Send custom messages to your preconfigured Slack workspace and channel.
- Send predefined message
- Send custom message
- Send block kit message

Soundcraft UI

- Set mute
- Set fader level

Sonoran Coyote

- Presets for all commands
- Available command:
- End
- Pause
- Take
- Take Next
- Take Prev
- Select Preset
- Select Next Preset
- Select Prev Preset
- Reboot Coyote
- Shutdown Coyote
- Soft Reboot Coyote
- SeekTo x (in milliseconds)

Sonos Speakers

- Controls Sonos speakers
- Set volume
- Adjust volume
- Next/Previous Track
- Play/Pause device

Sony Bravia Displays

- Power On/Off
- Volume Up/Down/Mute
- Change External Input

Tascam BD-MP1

- Controls TASCAM BD-MP1 Blu-Ray Player
- All transport controls and settings
- Feedbacks: Disc status and device status

The Lighting Controller

- Control all releases of The Lighting Controller, more commonly known as Showtec QuickDMX, Chauvet ShowXpress, or Sweetlight Controller
- Tempo control
- Freeze DMX
- Send cue name
- Toggle/Press/Release buttons
- Set fader to explicit value
- Timeline control
- Sequential list control
- Refresh interface state
- Custom TCP commands

Twitch API

- Display live status, uptime, and viewers, of multiple Twitch streams.
- Connect to Twitch chat and control which chat modes are active, as well as perform moderation commands like Clear Chat.
- Send predefined messages to a channel.
- Execute API requests to run channel advertisements (if available), create stream markers, and run custom API requests.
- OAuth flow to handle generation of tokens with just the permissions you need, and the option to store them entirely locally, or managed by a token server.

Vaddio PTZ Camera

- Connect to any Vaddio PTZ camera such as the RoboSHOT 20 UHD or RoboSHOT 40 UHD
- Pan/Tilt controls
- Lens controls (zoom/focus)
- CCU Controls (gain, white balance, backlight compensation, iris, detail, chroma)
- CCU Presets (recall factory/custom)
- Camera Control (standby, video mude, LED)
- Presets (recall, save)

Vivitek Projector

- Power on
- Power off
- Open shutter
- Close shutter

Xiamen SProLink VD Series

- Load Scene

Behringer X32 / Midas M32

- State fixes and channel send mute support
- Fix mute defaults
- Add basic oscillator controls
- Fix error dialogs
- Improved connection management

YouTube Live

- Start broadcast test
- Go live
- Finish broadcast
- Advance broadcast to next phase
- Refresh broadcast/stream feedbacks
- Reload
- Feedbacks: broadcast status, health of stream bound to broadcast

# 🛠 MODULE IMPROVEMENTS AND FIXES

AJA KiPro

- Changed loadclip command from eParamID_D1Clip to eParamID_GoToClip.
- Added HELP.md and README.md

AJA Kumo

- Fix salvo execution

Analog Way LiveCore

- Fixed warning bug

Allen & Heath dLive

- Add help text
- Remove console statements
- Added color of buttons, scene recall, main assignment, channel name
- Upgraded input channels, add dca assignment
- Added actions

Audivero Unity Intercom

- Bug fixes

AVStumpFL Pixera

- Bug fixes and improvements

Behringer XAir

- Added channel sends
- Updated documentation
- Added mute feedback
- Reconnect on apply config
- Fix feedback
- Mute control for DCAs, feedback for snapshots

Blackmagic Design ATEM

- Add ATEM Mini Pro (w/Multiview)
- Transition selection toggle preset and DSK TIE
- Fix of reconnection problems, crashing and status updates

Blackmagic Design Hyperdeck

- Feedback for slot and transport status
- Filename recording fix
- Other fixes and improvements

Blackmagic Design SmartView

- Added feedback, variables, presets

Blackmagic Design Teranex

- New actions, feedback, and variables
- Add AV model SDI input support

CasparCG

- Add option to send template data as JSON

Chamsys MagicQ UDP

- URL fix

Christie Widget Designer

- Added UDP Support. Now you can choose between UDP and TCP Connection
- Minor fixes

Christie Projector

- Added Readme.md
- Added Help.md
- Added +40 new commands for better control
- Added Key Codes
- Added feedback support for ERROR commands
- Displays error messages as warnings in log
- Added general feedback (FYI) + (LPH)
- Added Presets for all commands
- Minor fixes and improvements

Disguise

- Added hold function
- Making the module actually work again
- Updated default port number to 7401

Disguise MTC

- Fixing timecode and goto cue actions

ETC EOS

- Support for dynamic variables, presets, and feedbacks
- Connection now uses TCP OSC
- Added blackout and press key actions

Eventmaster

- Update with search functions in dropdown for sources, cues, and presets

Extron SMP351

- Added command for pausing an ongoing recording
- Added command for extending a recording
- Added variables, feedbacks, documentation, error handling
- Other bug fixes and improvements

Figure 53 QLab (Regular module)

- Change seconds args to float (bugfix)
- Added "Preview" action
- Documentation updates
- Bug fixes

Fora HVS

- Added additional user-facing logging, fix disconnect, use websocket instead of ws

Generic HTTP

- Added PUT request type
- Added POST body field to send JSON with request

Generic OSC

- Added support for multiple arguments with different data types

GlobalCache ITAC SL

- Added Line Termination Options
- Added support for sending hex-based data
- Updated documentation and HELP.md

Irisdown Countdowntimer

- Add +/- 1 minute preset
- Other fixes and improvements

Kramer Matrix

- Added support for Protocol 3000 devices
- Improved compatibility with Protocol 2000 devices
- Other fixes and improvements

Living As One Decoders

- Added support for new commands: Play and Fade From Black, Fade to Black and Pause, Fade From Black, Fade To Black
- Added presets for controls
- Added support for future commands when they become available

MA Lighting GrandMA2

- Fix for encoder options
- Hardkey fix

Millumin

- Added Change Board command

Mitti

- Updated Presets to include icons
- Added feedback
- Other improvements

Neodarque Stagetimer 2

- Processes data using Promises
- Add HELP

Nevion MRP

- Added dynamic XY routing, presets, and feedback
- Bug fixes and improvements
- Support for less talkative Nevion routers
- Exception fixes

OBS Studio

- Updated obs-websocket-js version, added preview action/feedback
- Added commands to control preview scene/execute transition in Studio mode
- Added reconnect action when websocket is closed
- Updated documentation and HELP.md
- New "Set source text" action
- Scene option to toggle visibility action

Obsidian Control Onyx

- Changed internal telnet library
- Bug fixes and improvements

Octopus

- Updated listener to support new API for paid version of Octopus

Octopus App

- Support for paid version of Octopus

Panasonic Projector

- Connects to Panasonic projectors using the NTCONTROL protocol.
- Power (on/off/toggle)
- Shutter (on/off/toggle)
- Freeze (on/off/toggle)
- Input Select
- Test Pattern
- Display Grid Lines
- Color Matching (3 and 7 Colors mode)
- Brightness Control

Panasonic PTZ

- Added Power On/Off actions
- Added Tally On/Off actions
- Added default to preset speed
- Icon changes/improvements
- Updated documentation
- Various bug fixes
- Show connection status

PDS

- Added input 7 & 8 to 902 variant
- Various bug fixes

PJLink

- Auto Reconnect on network fail
- Bug fixes
- Password fix

Planning Center Services Live

- Added Variable: Next Item in Plan
- Bug fixes

PPT Remote Show Control

- Added action "Start from Selected Slide"
- Added action "Go to numbered slide or section name"

RenewedVision ProPresenter

- Documentation Updates
- Support for ProPresenter 7
- Quick fix to workaround crash in Pro7
- Add clear announcements support
- Other improvements

Resolume Arena

- Bug fixes

Roland V60HD

- Updated documentation

Sony VISCA

- Improvements

StudioCoast VMix

- Added overlay and output functions
- Added Presets
- Updated documentation
- Added start/stop for specific stream
- Fixed recording status feedback
- Added MultiViewOverlay, VirtualSet, VirtualCall, Audio and Title actions
- Call audio bus fixes
- Other new features

TechMinistry MIDI Relay

- Support for MIDI Relay 2.0
- Supports sending all MIDI voice types, MSC, and SysEx messages
- Added 0 value for MIDI notes

Teradek VidiU

- Bug fix for when device is unreachable

TSLProducts UMD

- Fixes for TSL 4.0
- Other bug fixes

VICREO Hotkey

- Added action "Send Keycode to MacOS Process" (MacOS Only)
- Updated Presets and documentation
- Lots of bug fixes
- Support for latest version

Vizio Smartcast

- Added action to change TV input
- Allow for input selection from dropdown list fetched from TV
- Added volume control and mute actions
- Updated documentation and HELP.md
- Bugfix on pairing

VLC

- Added action to Play by ID / Clip Number
- Added password field for VLC 3
- Updated documentation

VYV Photon

- Bug fixes

Watchout Production

- Add set layer condition command and fadetime for standby

Yamaha SCP

- Fix crashes and general improvements

## Companion v1.4.0 - Release Notes

### Resolved issues

- [Fixes #470: Errors to log file on headless operation (silent raspberry pi services)](https://github.com/bitfocus/companion/issues/470)
- [Fixes #512: Internal actions problem resolved (576026a William Viker)](https://github.com/bitfocus/companion/issues/512)
- [Fixes #465: Add permissive CORS to http API requests. (25a5b87 Håkon Nessjøen)](https://github.com/bitfocus/companion/issues/465)
- [Fixes #495](https://github.com/bitfocus/companion/issues/495) and [#367](https://github.com/bitfocus/companion/issues/367): Change background color and text color with internal actions. (f078ab9 William Viker)
- [Fixes #519: Fix bug that lets you disable internal module from an internal module action. (0c5a32b William Viker)](https://github.com/bitfocus/companion/issues/519)
- [Fixes #514: Web Buttons page unable to scroll in android chrome (c88f98a William Viker)](https://github.com/bitfocus/companion/issues/514)

### Major changes

- Dynamic variables of presets updates when renaming instances
- Lockout PIN-code system
  - Any pin length allowed.
  - Configurable in web interface
  - Timeouts, and manual lock and unlock with actions
  - Can work globally or per surface
- Emulator can now be controlled with the keyboard buttons (as explained in the emulator)
- Support for changing page in surface config for stream deck plugin
- Ability to control button style with OSC
  - /style/color/page/bank (int red, int green, int blue)
  - /style/bgcolor/page/bank (int red, int green, int blue)
  - /style/text/page/bank (string text)

### Minor changes

- Broadcast message support in internal OSC module
- OSC bundle message support in internal OSC module
- Added Dockerfile for running companion from Docker
- Switched telnet module for instances
- Added hostname, date and time to export filenames
- Added internal action to rescan USB devices
- Stability improvements to TCP server
- Stability improvements to bank lists and feedbacks
- Module API: add callback structure for module feedback

### New support added

- Allen & Heath dLive **Need testing**
- Analog Way Picturall
- Barco HDX **Need testing**
- Blackmagic Design Teranex
- BrightSign Player **Need testing**
- Christie Widget Designer
- Depili Clock 8001
- Denon Receivers
- ETC EOS
- Hologfx Holographics
- Interactive Technologies Cueserver
- Kramer Matrixes
- Living As One Decoders
- Matrox Monarch
- MSC Router **Need testing**
- Panasonic PTZ
- Picturall media server
- Planning Center Services Live
- RadioDJ
- Roland V-60HD
- Roland XS-62S
- Tech Ministry ProTally
- Thingm Blink(1)
- VICREO Hotkeys
- Yamaha QL/CL/TF Consoles
- Vizio Smartcast **Need testing**

### Enhanced support

- Barco Eventmaster
  - Making presets work for cues and preset recalling
  - Improved AUX control
  - Userkey support
  - Freeze of Source, Screen, Aux
  - Add basic presets; auto trans, cut, recall next
- Barco PDS
  - Feedback on buttons program/preview/logo, handle invalid signal input, minor improvements
- Blackmagic Design ATEM
  - additional Macro support/feedback
  - USK/DSK source selection
  - model selection
  - Multiviewer routing
- Blackmagic Design HyperDeck
  - additional name record options
  - control of remote function
- Blackmagic Design Videohub
  - support for monitoring outputs
  - RS422 routing
- Cockos Reaper
  - Added custom action
- Depili Clock 8001
  - Add support for pause/resume
  - Decode utf8 tally messages
  - Compatibility with clock version 3.0.0
- Generic HTTP
  - Added ‘base url’ field in instance configuration
- GrandMA2
  - Rewritten telnet part to comply with MIT license.
- OBS Studio
  - Added support for transitions
- Mitti
  - Added support for controlling Fullscreen, Looping, Transition control and Cues
- Neodarque StageTimer2
  - Added increase/decrease time action
- Rosstalk
  - XPression naming fixes (by request from RossVideo)
- Tascam CD
  - Support for transports and power. (complete support of protocol)
- X32
  - Fixed bug where cues and snippets did not work.
  - Fixed bug where DCA mute and fader didn’t work
- GlobalCache ITAC IR
  - Added help text
- ifelseWare AV Playback
  - Make port configurable, Pad Fix option, added nextClip and prevClip
- PVP
  - target set support
  - layer preset support
  - layer opacity control
  - select layer target
  - action reordering
  - preset support
  - Help text
- QLab
  - Flagged/Unflagged clip
  - Passcode support
- RenewedVision ProPresenter
  - Added audio actions
  - video countdown timer variable
  - Help text
  - Countdown timer control
  - Clock time tooltip
  - StageDisplay features
  - Dynamic variables
- Tascam CD
  - Added presets for all actions
- Playback Pro Plus
  - Adjusted GO/GT command to the correct format
- PTZ Optics
  - Help text

## Companion v1.3.0 - Release Notes

### Major changes

Added support for virtual devices (stream deck plugin) to connect via websockets.
Help button on instances show help markup from modules
Implemented UDP and TCP server to remote press companion buttons
Support REST GET/POST Polling in the module API
Action delays can be absolute or relative. Can also be reordered.

### Minor changes

Prevent 'internal' module from being searchable
Use Interface instead of IP and Port for more consistent behavior (headless.js)
home button functionality
Added support for Neodarque StageTimer2
Add "help-button" to search result as well
Feedback reordering
Added forgotten module for Blackmagic Multiview 4
Improved the action reordering experience.
CVE-2018-14041 - Upgrade bootstrap version.
Support for choosing which pages to show in web-buttons with /tablet.html?pages=3,4,5 fixes #369. And added page names in web
Ability to press another button with an action. Closing #397.
Add TCP/UDP documentation to settings tab, and some internal restructuring/cleanup.
Changed the visible order of shortname/manufacturer in instance list
Making checkboxes larger and more visible. Closes #366
Rearranged the PNG button configuration fields. (the new standard)
Show build number in the WebUI. Closes #335
Fix build_writefile.sh to provide buildnumbers for master and branch name for other branches
Implemented multiselect form type for modules

## Module related

Added module barco-eventmaster-xml
Feedback and variables for neodarque-stagetimer2
Implemented an helping preset for neodarque-stagetimer2
Upgraded AMP
Upgraded atem module. Fixes #371
Upgraded Blacmagick Hyperdeck module, added support for setting filename to record to. Fixes #360. I think.
Upgraded analogway-pls300
Upgraded barco-eventmaster-xml
Upgraded eventmaster
Upgraded generic-http
Upgraded highend-hog4
Upgraded neodarque-stagetimer2
Upgraded renewedvision-propresenter, Dynamic variables, Pro6 Windows support, and improved websockets
Upgraded rosstalk
Upgraded eventmaster module to 6.2.0 upstream module
Upgraded aja-helo
Upgraded pjlink
Upgraded renewedvision-propresenter
Upgraded studiocoast-vmix
Upgraded octopus listener module

## Companion v1.2.0 - Release Notes

We've introduced some important stuff in this release. Honestly, almost too much in one single release. Feedback and presets is some of it, but it's not supported by many modules yet, but this will be better towards 1.3.0.

Feedback:

- BMD Videohub, BMD ATEM

Presets:

- Analogway PLS300, Irisdown Countdown, Mitti, PlaybackProPlus, Sony VISCA, Nevion MRP

Changes:

- Brightness control and button rotation on Stream Deck / Infinitton device
- Stream Deck Mini support
- Minimize launcher to tray
- Export and import pages/full configs
- Remote triggering of buttons via OSC and ArtNet
- Separate "Up actions" / Latch buttons
- Huge improvements in fonts (multiple sizes, auto size, etc.)
- Feedback support ("button tally" as example)
- Preset support (template keys)
- Variables support (dynamic text)
- We now support more thans 3 streamdecks!
- Erase entire page
- Panic feature in internal module to cancel all delayed actions
- Align text and PNG background
- Internal module to control internal stuff in companion
- Headless operation for RPI
- Tablet/Web buttons
- Windows database save problem fixed
- Cosmetic fixes in admin ui
- Fixes: Analogway Midra
- Fixes: Irisdown Countdowntimer
- Fixes: PlaybackProPlus
- Fixes: Mitti
- Fixes: Blackmagic
- Fixes: QLab
- Fixes: Eventmaster
- Fixes: Livecore
- Fixes: PVP
- Fixes: PPT RSC
- Fixes: Millumin
- Fixes: Blackmagic Design ATEM
- Support: X32
- Support: Chamsys
- Support: Watchout
- Support: Analogway VIO
- Support: Christie PJ
- Support: ArtNet
- Support: 7th sense media server
- Support: Imagepro
- Support: Modulo
- Support: Octopus App
- Support: KiPro
- Support: XAir
- Support: SCS
- Support: Cockos Reaper
- Support: Nevion MRP/Multicon
- Support: PTZOptics VISCA
- Support: AJA Helo
- Support: Analogway Pulse (PLS300)
- Support: HTTP GET/POST Requests
- Support: BlackMagic Design SmartView

stuff is probably missing from this list..

## v1.1.1 Summary

- Eventmaster freeze/unfreeze and rebuild
- Added test button from button configurator
- Added "hot buttons" (test/run) while holding shift button in admin gui
- Added float to OSC
- Color picker
- Support for \n for newline in button labels
- Health/Status indicator on buttons!
- Bugfixes: Infinitton driver
- Bugfixes: Spyder
- Support: Mitti jump to cue
- Support: BMD VideoHub
- Support: BMD Hyperdeck
- Support: BMD ATEM
- Support: Disguise Multi Transport control (partial, ..not our fault)
- Support: VLC
- Support: Octopus Listener
- Support: Irisdown Remote Show Control
- Support: AnalogWay Livecore
- Support: ArtNet
- Support: GrandMA 2 (telnet)

## Issues closed from v1.1.0 to v1.1.1

- [#122](https://github.com/bitfocus/companion/issues/122): Fixing instance type list that become too long
- [#112](https://github.com/bitfocus/companion/issues/112): Fixed gracefully handling of EADDRINUSE.

## v1.1.0 Summary

- Added support for the Infinitton controller (very similar to the elgato)
- Regular expressions to validate configuration input
- Added dropdown choices for action settings
- Design tweaks in the action list
- Improvements in the internal UDP and TCP libraries
- Implemented user configuration for flipping up/down buttons on page selection
- Pages can now have their own names
- Added text horizontal and vertical alignment
- Added lowercase letters to the font
- Replace application icon with the companion icon
- Ability to change port number for GUI
- Field validation now stops the forms from saving
- Minor bug fixes
- Crash if the streamdeck application is running is fixed!
- Support: IfElseWare AV-Playback
- Support: Ross Carbonite/Vision
- Support: Spyder
- Support: Digital Projection Highlight Projectors
- Support: Barco PDS
- Support: PJLink

## Issues closed from v1.0.12 to v1.1.0

- [#84](https://github.com/bitfocus/companion/issues/84): Module Request: AV Playback module
- [#73](https://github.com/bitfocus/companion/issues/73): Enhancement: Field validation should stop the form from saving
- [#71](https://github.com/bitfocus/companion/issues/71): Feature: Inform or reload modules on configuration change (for that module) TODO bug enhancement
- [#70](https://github.com/bitfocus/companion/issues/70): setTimeout issue workaround making action delays safe bug solution needed
- [#69](https://github.com/bitfocus/companion/issues/69): TCP framework for modules
- [#65](https://github.com/bitfocus/companion/issues/65): Bug when launching two instances or port currently in use
- [#63](https://github.com/bitfocus/companion/issues/63): Reset Button
- [#58](https://github.com/bitfocus/companion/issues/58): Bug: Wrong application logo/icon bug
- [#56](https://github.com/bitfocus/companion/issues/56): Application Configuration
- [#52](https://github.com/bitfocus/companion/issues/52): Launcher does not scroll log automatically bug win64
- [#58](https://github.com/bitfocus/companion/issues/58): Feature request: input data validation
- [#49](https://github.com/bitfocus/companion/issues/49): Feature request: tooltips on input fields enhancement good first issue
- [#29](https://github.com/bitfocus/companion/issues/29): Wish: reverse order of page numbers
- [#23](https://github.com/bitfocus/companion/issues/23): Wish: Ability to change port that interface runs on
- [#61](https://github.com/bitfocus/companion/issues/61): Bug: Handle streamdeck that is in use
