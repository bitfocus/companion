# Changelog

## V1.2.0 Summary

We've introduced some important stuff in this release. Feedback and presets is some of it, but it's not supported by many modules yet, but this will be better towards 1.3.0.

Feedback:
* BMD Videohub, BMD ATEM

Presets:
* Analogway PLS300, Irisdown Countdown, Mitti, PlaybackProPlus, Sony VISCA

Changes:
* Brightness control and button rotation on Stream Deck / Infinitton device
* Stream Deck Mini support
* Minimize launcher tray
* Export and import pages/full configs
* Remote triggering of buttons via OSC
* Separate "Up actions" / Latch buttons
* Huge improvements in fonts
* Feedback support ("button tally" as example)
* Preset support (template keys)
* Variables support (dynamic text)
* We now support more thans 3 streamdecks!
* Erase page
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
* Support: AJA Helo
* Support: Analogway Pulse (PLS300)
* Support: HTTP GET/POST Requests

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
