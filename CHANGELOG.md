
# Bitfocus Companion
## Companion v1.4.0 - Release Notes

### Resolved issues
* [Fixes #470: Errors to log file on headless operation (silent raspberry pi services)](https://github.com/bitfocus/companion/issues/470)
* [Fixes #512: Internal actions problem resolved (576026a William Viker)](https://github.com/bitfocus/companion/issues/512)
* [Fixes #465: Add permissive CORS to http API requests. (25a5b87 Håkon Nessjøen)](https://github.com/bitfocus/companion/issues/465)
* [Fixes #495](https://github.com/bitfocus/companion/issues/495) and [#367](https://github.com/bitfocus/companion/issues/367): Change background color and text color with internal actions. (f078ab9 William Viker)
* [Fixes #519: Fix bug that lets you disable internal module from an internal module action. (0c5a32b William Viker)](https://github.com/bitfocus/companion/issues/519)
* [Fixes #514: Web Buttons page unable to scroll in android chrome (c88f98a William Viker)](https://github.com/bitfocus/companion/issues/514)

### Major changes
* Dynamic variables of presets updates when renaming instances
* Lockout PIN-code system
  * Any pin length allowed.
  * Configurable in web interface
  * Timeouts, and manual lock and unlock with actions
  * Can work globally or per surface
* Emulator can now be controlled with the keyboard buttons (as explained in the emulator)
* Support for changing page in surface config for stream deck plugin
* Ability to control button style with OSC
  * /style/color/page/bank (int red, int green, int blue)
  * /style/bgcolor/page/bank (int red, int green, int blue)
  * /style/text/page/bank (string text)
### Minor changes
* Broadcast message support in internal OSC module
* OSC bundle message support in internal OSC module
* Added Dockerfile for running companion from Docker
* Switched telnet module for instances
* Added hostname, date and time to export filenames
* Added internal action to rescan USB devices
* Stability improvements to TCP server
* Stability improvements to bank lists and feedbacks
* Module API: add callback structure for module feedback
### New support added
* Allen & Heath dLive **Need testing**
* Analog Way Picturall
* Barco HDX **Need testing**
* Blackmagic Design Teranex
* BrightSign Player **Need testing**
* Christie Widget Designer
* Depili Clock 8001
* Denon Receivers
* ETC EOS
* Hologfx Holographics
* Interactive Technologies Cueserver
* Kramer Matrixes
* Living As One Decoders
* Matrox Monarch
* MSC Router **Need testing**
* Panasonic PTZ
* Picturall media server
* Planning Center Services Live
* RadioDJ
* Roland V-60HD
* Roland XS-62S
* Tech Ministry ProTally
* Thingm Blink(1)
* VICREO Hotkeys
* Yamaha QL/CL/TF Consoles
* Vizio Smartcast **Need testing**
### Enhanced support
* Barco Eventmaster
  * Making presets work for cues and preset recalling
  * Improved AUX control
  * Userkey support
  * Freeze of Source, Screen, Aux
  * Add basic presets; auto trans, cut, recall next
* Barco PDS
  * Feedback on buttons program/preview/logo, handle invalid signal input, minor improvements
* Blackmagic Design ATEM
  * additional Macro support/feedback
  * USK/DSK source selection
  * model selection
  * Multiviewer routing
* Blackmagic Design HyperDeck
  * additional name record options
  * control of remote function
* Blackmagic Design Videohub
  * support for monitoring outputs
  * RS422 routing
* Cockos Reaper
  * Added custom action
* Depili Clock 8001
  * Add support for pause/resume
  * Decode utf8 tally messages
  * Compatibility with clock version 3.0.0
* Generic HTTP
  * Added ‘base url’ field in instance configuration
* GrandMA2
  * Rewritten telnet part to comply with MIT license.
* OBS Studio
  * Added support for transitions
* Mitti
  * Added support for controlling Fullscreen, Looping, Transition control and Cues
* Neodarque StageTimer2
  * Added increase/decrease time action
* Rosstalk
  * XPression naming fixes (by request from RossVideo)
* Tascam CD
  * Support for transports and power. (complete support of protocol)
* X32
  * Fixed bug where cues and snippets did not work.
  * Fixed bug where DCA mute and fader didn’t work
* GlobalCache ITAC IR
  * Added help text
* ifelseWare AV Playback
  * Make port configurable, Pad Fix option, added nextClip and prevClip
* PVP
  * target set support
  * layer preset support
  * layer opacity control
  * select layer target
  * action reordering
  * preset support
  * Help text
* QLab
  * Flagged/Unflagged clip
  * Passcode support
* RenewedVision ProPresenter
  * Added audio actions
  * video countdown timer variable
  * Help text
  * Countdown timer control
  * Clock time tooltip
  * StageDisplay features
  * Dynamic variables
* Tascam CD
  * Added presets for all actions
* Playback Pro Plus
  * Adjusted GO/GT command to the correct format
* PTZ Optics
  * Help text



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
* BMD Videohub, BMD ATEM

Presets:
* Analogway PLS300, Irisdown Countdown, Mitti, PlaybackProPlus, Sony VISCA, Nevion MRP

Changes:
* Brightness control and button rotation on Stream Deck / Infinitton device
* Stream Deck Mini support
* Minimize launcher to tray
* Export and import pages/full configs
* Remote triggering of buttons via OSC and ArtNet
* Separate "Up actions" / Latch buttons
* Huge improvements in fonts (multiple sizes, auto size, etc.)
* Feedback support ("button tally" as example)
* Preset support (template keys)
* Variables support (dynamic text)
* We now support more thans 3 streamdecks!
* Erase entire page
* Panic feature in internal module to cancel all delayed actions
* Align text and PNG background
* Internal module to control internal stuff in companion
* Headless operation for RPI
* Tablet/Web buttons
* Windows database save problem fixed
* Cosmetic fixes in admin ui
* Fixes: Analogway Midra
* Fixes: Irisdown Countdowntimer
* Fixes: PlaybackProPlus
* Fixes: Mitti
* Fixes: Blackmagic
* Fixes: QLab
* Fixes: Eventmaster
* Fixes: Livecore
* Fixes: PVP
* Fixes: PPT RSC
* Fixes: Millumin
* Fixes: Blackmagic Design ATEM
* Support: X32
* Support: Chamsys
* Support: Watchout
* Support: Analogway VIO
* Support: Christie PJ
* Support: ArtNet
* Support: 7th sense media server
* Support: Imagepro
* Support: Modulo
* Support: Octopus App
* Support: KiPro
* Support: XAir
* Support: SCS
* Support: Cockos Reaper
* Support: Nevion MRP/Multicon
* Support: PTZOptics VISCA
* Support: AJA Helo
* Support: Analogway Pulse (PLS300)
* Support: HTTP GET/POST Requests
* Support: BlackMagic Design SmartView

stuff is probably missing from this list..

## v1.1.1 Summary
* Eventmaster freeze/unfreeze and rebuild
* Added test button from button configurator
* Added "hot buttons" (test/run) while holding shift button in admin gui
* Added float to OSC
* Color picker
* Support for \n for newline in button labels
* Health/Status indicator on buttons!
* Bugfixes: Infinitton driver
* Bugfixes: Spyder
* Support: Mitti jump to cue
* Support: BMD VideoHub
* Support: BMD Hyperdeck
* Support: BMD ATEM
* Support: Disguise Multi Transport control (partial, ..not our fault)
* Support: VLC
* Support: Octopus Listener
* Support: Irisdown Remote Show Control
* Support: AnalogWay Livecore
* Support: ArtNet
* Support: GrandMA 2 (telnet)

## Issues closed from v1.1.0 to v1.1.1
* [#122](https://github.com/bitfocus/companion/issues/122): Fixing instance type list that become too long
* [#112](https://github.com/bitfocus/companion/issues/112): Fixed gracefully handling of EADDRINUSE.


## v1.1.0 Summary
* Added support for the Infinitton controller (very similar to the elgato)
* Regular expressions to validate configuration input
* Added dropdown choices for action settings
* Design tweaks in the action list
* Improvements in the internal UDP and TCP libraries
* Implemented user configuration for flipping up/down buttons on page selection
* Pages can now have their own names
* Added text horizontal and vertical alignment
* Added lowercase letters to the font
* Replace application icon with the companion icon
* Ability to change port number for GUI
* Field validation now stops the forms from saving
* Minor bug fixes
* Crash if the streamdeck application is running is fixed!
* Support: IfElseWare AV-Playback
* Support: Ross Carbonite/Vision
* Support: Spyder
* Support: Digital Projection Highlight Projectors
* Support: Barco PDS
* Support: PJLink

## Issues closed from v1.0.12 to v1.1.0
* [#84](https://github.com/bitfocus/companion/issues/84): Module Request: AV Playback module
* [#73](https://github.com/bitfocus/companion/issues/73): Enhancement: Field validation should stop the form from saving
* [#71](https://github.com/bitfocus/companion/issues/71): Feature: Inform or reload modules on configuration change (for that module) TODO bug enhancement
* [#70](https://github.com/bitfocus/companion/issues/70): setTimeout issue workaround making action delays safe bug solution needed
* [#69](https://github.com/bitfocus/companion/issues/69): TCP framework for modules
* [#65](https://github.com/bitfocus/companion/issues/65): Bug when launching two instances or port currently in use
* [#63](https://github.com/bitfocus/companion/issues/63): Reset Button
* [#58](https://github.com/bitfocus/companion/issues/58): Bug: Wrong application logo/icon bug
* [#56](https://github.com/bitfocus/companion/issues/56): Application Configuration
* [#52](https://github.com/bitfocus/companion/issues/52): Launcher does not scroll log automatically bug win64
* [#58](https://github.com/bitfocus/companion/issues/58): Feature request: input data validation
* [#49](https://github.com/bitfocus/companion/issues/49): Feature request: tooltips on input fields enhancement good first issue
* [#29](https://github.com/bitfocus/companion/issues/29): Wish: reverse order of page numbers
* [#23](https://github.com/bitfocus/companion/issues/23): Wish: Ability to change port that interface runs on
* [#61](https://github.com/bitfocus/companion/issues/61): Bug: Handle streamdeck that is in use
