# Bitfocus Companion

## Companion v4.2.3 - Release Notes

### 🐞 BUG FIXES

- local variables not invalidating module entities #3896
- expression arrayLastIndexOf not working if no offset provided #3873
- drag and drop previews showing more than the dragged element #3883
- avoid invalid values being sent to a surface when referencing old jog/tbar variables (#3872)
- improve scrolling behaviour of surfaces page
- variables dropdown showing behind heading in settings
- make connected network docks stick below the active surfaces in the list
- respect DISABLE_IPV6 env var to disable admin interface binding to ipv6
- respect collections when sorting connections for add entity dropdowns and variables page #3899
- only report usage stats for published modules

## Companion v4.2.2 - Release Notes

### 🐞 BUG FIXES

- add keepalive interval for client websocket
- improve emulator behaviour when websocket closes
- revert: limit environment variables exposed to internal actions
- only search labels in dropdown fields
- unable to edit color inputs as hex
- bluetooth support for blackmagic controllers
- open help links in a new windows
- isVisibleExpression clone error
- loupedeck ct bad key map
- sidebar dom issues
- better suppress some common/excessive errors

## Companion v4.2.1 - Release Notes

### 🐞 BUG FIXES

- crash at launch on linux arm64 #3826
- docs search urls incorrect #3824
- expression variables not updating in ui #3825
- emulator not showing pincode entry #3827
- toggling never lock for surface not applying
- support ajaz akp153 #3840
- preserve additional environment variables for modules
- limit environment variables exposed to internal actions
- preserve sqlite wal when upgrading config #3835

## Companion v4.2.0 - Release Notes

### IMPORTANT CHANGES

- This version of Companion requires macOS 12 or later
- The old xkeys $(internal:tbar) and similar variables have been removed, and they should now be bound to custom variables in the config of each surface (#3716)

### 📣 CORE FEATURES AND IMPROVEMENTS

- Require macos 12
- Convert docs to docusaurus (#3741)
- Rebuild emulator pincode locking
- Add options to to restrict page access (#3736)
- Enhanced expressions:
  - Improved expression editor (#3713)
  - More formatting for timestamp (#3668)
  - Handle negative value in msToTimestamp (#3651)
  - Support local variables in step expressions #3762
  - Expressions better handle undefined. add `getVariable` method #3451 (#3715)
- Refined connection management:
  - Reworked connection config layout #3559 (#3569)
  - Rework changing connection versions, to remove need to disable module first
  - Add delete button to connection edit panel
  - Allow changing connection enabled state from config panel
  - Indicate connections missing modules in sidebar
- Surface improvements:
  - Merge surface remote and discover pages (#3677)
  - Support resolve speed editor #3525
  - Support more variants of Mirabox 293S
  - Support for Mirabox Streamdock N3 (#3686)
  - Add repeating button-presses to contour-shuttle shuttle ring (#3492)
  - Improve vec-footpedal surface implementation
  - Support complex surface layouts over satellite api (#3611)
  - Support swipe to change page on Stream Deck + (#3721)
  - Support touch strip variables for Loupedeck Live (#3790)
- Draw button 'error' state as a red warning triangle (#3675)
- Remove deprecated bank field from tcp bank_bg_change message #2779
- Include timestamps and source in module debug logs
- Add version number variables #3714
- Rework update check api, improving reliability

### 🐞 BUG FIXES

- ember+ api issues with some clients
- limit env vars passed to modules
- improve error handling for module executeAction
- "Sentry DSN not located" error in launcher (#3758)
- Align the display name of `surface_set_position` with the UI terminology (#3761)
- Avoid flooding modules with large objects, batch entity updates to resolve issues with large configs
- preserve original types of custom variable values from osc and ember+ apis
- improve version number handling for release vs beta builds
- Page up button/Page down button don't set page-history (#3683)
- Reduce frequency of pincode lock state logging (#3792)
- Loupedeck Live pincode lock layout

## Companion v4.1.6 - Release Notes

### 🐞 BUG FIXES

- Setting local variables for another control failing #3813
- Unable to select module beta version for connection #3815
- Suppress some logged errors about local variable names
- Avoid spamming log with surface lock state messages #3792

## Companion v4.1.5 - Release Notes

### 🐞 BUG FIXES

- reordering pages not persisting #3727
- Local variable actions not working on triggers #3788
- support stream deck mini (discord edition) #3778
- elgato plugin not handling multiple clients correctly #3775
- elgato plugin not cleaning up on connection close #3767
- suppress module SecurityWarnings in a better way

## Companion v4.1.4 - Release Notes

### 🐞 BUG FIXES

- Expression variables not getting value immediately following import
- Import page not scrolling correctly
- Import single page unable to create new page
- Unable to select any file to import on iOs #3676
- Surfaces not remembering state when using lockout all
- Failures when installing modules not being displayed
- Missing tooltips in module versions table
- Surfaces table upgrade icon position
- Allow larger module archives
- Fix some links within the getting started docs #3720
- Performance improvements for module entity events

## Companion v4.1.3 - Release Notes

### 🐞 BUG FIXES

- Crash at startup when checking instance statuses

## Companion v4.1.2 - Release Notes

### 🐞 BUG FIXES

- surface import/export errors with `last_page_id` or `name` #3650
- stream deck mini not working with network dock #3682
- don't assign elgato network dock an index in the surfaces table
- very old contour shuttle pro v1 has an XKey vendor ID (#3658)
- Template literal parsing in some expressions has unbound recursion #3655
- disabled module count incorrect at startup #3679
- connection status variables showing empty instead of disabled at startup #3652
- Surface Groups should always show "Current Page" (#3685)
- hide deprecated modules from add panel if no versions are installed #3684
- Preset previewStyle is overridden by feedback (#3673)
- ensure invalid version doesnt crash connections page
- ios safari downloading exports with bad extension #3676
- ensure modules being installed look like connections
- ember+ api not including custom variables (#3681)

## Companion v4.1.1 - Release Notes

### 🐞 BUG FIXES

- Version warning showing in the header
- Pages not being deleted properly during reset
- Partial import resetting unexpected portions of the system #3625 #3639
- Unable to drag some collections around
- Unexpected error logged when aborting an `internal: Wait` action #3645
- UI not loading in older Chromium (~121)
- Ember+ api reporting hidden variables #3646
- DEBUG-INSPECT not working for all modules

## Companion v4.1.0 - Release Notes

### IMPORTANT CHANGES

- This is the last version of Companion to support macOS 11. Starting with Companion 4.2 you will need to be running macOS 12 or later.

### 📣 CORE FEATURES AND IMPROVEMENTS

- Various UX improvements
  - Connections, triggers and custom variables can be added to 'collections' for grouping
  - Connections and triggers can be enabled/disabled by their collections
  - Connections, triggers and surfaces tables have had their contents rearranged to flow more naturally
  - Surfaces has been reworked to utilise a right panel for the selected surface.
  - Any right hand panels of pages have been refined
  - Version number has moved into the sidebar instead of header
  - Improve clarity of beta module versions
  - Layout improvements of some pages on mobile
  - Indicate whether custom-variable value is valid while typing
  - Improved layout of the launcher window, including a new settings window
  - Add filter/search to triggers page
  - Improved import page
  - Improve emulator list page
- Added Expression Variables. Similar to Custom Variables, but their value is the result of an expression that executes when needed.
- Add new 'while loop' action
- Ability to define 'local variables' on buttons and triggers.
  - Not all actions or feedbacks support these, this will improve over time
- Additional expression functions
  - arrayIndexOf & arrayLastIndexOf
- Button step can be driven from an expression
- Multiple connections from the Elgato Stream Deck software are now supported.
- Support for Logitech MX Creative Console (buttons, not wheel)
- Support for MiraBox HSV293S
- Importing configs can be performed more granularly, without needing to reset everything
- Variables for installation name
- Expansion of the Ember+ api
  - Expose variables
  - Allow setting custom-variable values
  - Expose action recorder
- Support for 'secret' field types in connection config
- Attempt to keep screen awake in emulator/tablet views
- Support for defining custom backup rules
- Syslog support for logging
- Improve docker image command syntax
- UI can be hosted under a subpath when behind a reverse proxy
- Replace the library used for communication with the UI
  - This improves the type safety and code quality of this api and makes it easier for us to work with.
  - There should be no notable impact to users

### 🐞 BUG FIXES

- Surface page settings not being persisted correctly in exports
- Load PNG button not always accepting files
- Help tooltips not always showing
- Some internal actions incorrectly claiming to support expressions
- Some dropdown fields not updating their options when expected
- Duplicating triggers first execution incorrect
- Improve drag and drop behaviour in action/feedback lists
- Sanitise page ids at startup, to ensure the config is sane
- Better handling when no compatible versions of a module are available to be installed

## Companion v4.0.3 - Release Notes

### 🐞 BUG FIXES

- Button step feedbacks not reactive to variables #3531
- Validate module version number before installing or loading
- Checkboes jumping in safari (#3548)
- Variables page not scrolling #3544
- Stream Deck Network Dock not allowing backlight brightness control
- Add slider to surface brightness field
- Some module static-text values being interpreted as code blocks #3540
- Fix connections being called with feedbacks of other connections
- Unable to run with companion config on windows network shares #3510

## Companion v4.0.2 - Release Notes

### 🐞 BUG FIXES

- Improve performance of bank_style, bank_pushed and bank_current_step feedbacks #3453
- Fix Emulator Names Disappearing #3474
- Fix connection upgradeIndex being lost during imports #3481
- Fix button image preview sometimes showing stale image #3476
- Fix ensure connection looks valid before importing #3472
- Fix linked surface lockout incorrectly calculating last press time #3471
- Fix wizard grid size not always being respected #3489
- Fix contour shuttle event order #3485
- Fix emberplus api close/init (#3469)
- Fix xkeys not handling green backlight #3473
- Fix action execute failed logging
- Fisable fullscreen buttons if fullscreen api is not available

## Companion v4.0.1 - Release Notes

### 🐞 BUG FIXES

- Fix button grid keyboard hotkeys broken #3466
- Fix persist connection updatepolicy when editing connection config #3464
- Fix panel default collapsed state not being persisted #3460
- Fix launch db checks not looking for sqlite files #3462
- Fix streaming upload of offline bundle #3463
- Fix import offline bundle failing for remote companion

## Companion v4.0.0 - Release Notes

### BREAKING CHANGES

- Modules are now installable plugins
  They no longer ship with companion, you can either import an offline module bundle, or install them within companion from the store.
  This allows them to be updated independently
- Support for the legacy xkeys layouts has been removed.
  The new layouts have been the default behaviour since 3.2, and accurately reflect the real layout instead of trying to squeeze the layout into multiple 32 button pages.

### 📣 CORE FEATURES AND IMPROVEMENTS

- Modules are now installable plugins, allowing them to be updated independently
- Add `Logic: if statement` action
- Improved `internal: abort` actions, to give more granular control of what to abort
- Restructure app navigation
- Refinement of getting-started guide, to better handle scrolling
- Remove support for legacy xkeys layouts
- Allow custom variables descriptions to be edited
- Allow editing custom variable value as object
- Indicate type of each variable
- Handle body data in HTTP api setting custom variable
- Support for Mirabox Stream Dock 293V3 and N4
- Reimplement support for Contour Shuttle
- Support Resolve Replay Editor
- Support latest streamdeck models & network dock
- Allow remote surfaces to be disabled
- Allow specifying id of new emulators and surface groups
- Support granular permissions for modules (internal functionality, not exposed in the ui)
- Extend satellite api, to allow clients to handle display of locked state

### 🐞 BUG FIXES

- Limit ui session lockout duration, to avoid browser crash
- Support HTTP_PROXY environment variables for module store api calls
- Emulator button presses on ios double triggering
- Adjust text vertical alignment on buttons

### 🧩 NEW & UPDATED MODULES

Modules are now distributed independently, and are no longer reported here

## Companion v3.5.5 - Release Notes

### 🐞 BUG FIXES

- Support additional stream deck usb ids
- UI crashing if admin lockout timeout set to over 24 hours
- Log connection pid when starting
- Button grid not handling all page changes correctly
- HTTP api methods failing without body

## Companion v3.5.4 - Release Notes

### 🐞 BUG FIXES

- dragging action group can disappear #3367
- full import disappearning delays #3365
- clear variables about surfaces when disconnected #3362
- external links not always opening in new tabs
- surface discovery not handling ipv6 correctly
- emulator keymap for presenter controller incorrect #3359
- feedbacks breaking when expressions fail to parse#3386
- handle pasted variable names better in some input fields #3390
- improve resilience of elgato software check on windows #3261

### 🐞 MODULE FIXES

- generic-swp08
- haivision-connectdvr
- roland-vr120hd
- neutrik-dpro
- ntp-technology-dot
- smodetech-smodelive
- vitec-avediaplayer9300-series

## Companion v3.5.3 - Release Notes

### 🐞 BUG FIXES

- fix emulator keymap for clickers #3328
- add pincode layout for SDS #3330
- fix web buttons irregular column count causing some buttons to not work #3303
- fix \r\n drawing with extra space #3315

### 🐞 MODULE FIXES

- cedar-dns8d
- colorlight-processor
- focusrite-mp8r
- generic-osc
- generic-swp02
- imimot-mitti
- interspace-mastercuev7
- renewedvision-propresenter-api
- stagetec-rcp
- studiocoast-vmix
- twitch-api

## Companion v3.5.2 - Release Notes

### 🐞 BUG FIXES

- Crash reading property on undefined at startup
- Improve sqlite performance
- Handle module unexpected exits
- Backport fix for potential crash when updating many buttons at once

### 🐞 MODULE FIXES

- aimedia-icap
- allenheath-ahm
- avocet-landscape
- broadlink-remote
- colorlight-grandshow
- combitech-vidblasterx
- dashare-multiplay3
- emotimo-st4
- etc-paradigm
- greengo-intercom
- intelix-matrix
- kenku-fm
- limagiran-holyrics
- monospace-lightkey
- mrmoco-mhc
- novastar-coex
- osee-gostream
- vicreo-display
- voicemod-api
- wled-websocket

## Companion v3.5.1 - Release Notes

### 🐞 BUG FIXES

- Ensure pages are saved after filling in ids #3246
- Strings with null characters break drawing #3247
- Import not fixing up nested actions and feedbacks #3248
- Surface page variables showing id instead of number #3244
- Specify the config export download filename in the modern way that's interpreted identically in all modern browsers. #3242
- DB backup being written too often

### 🐞 MODULE FIXES

- figure53-qlab-advance
- josephadams-scriptlauncher
- sennheiser-digital6000
- studiocoast-vmix

## Companion v3.5.0 - Release Notes

### BREAKING CHANGES

- macOS must be at least 11 to run Companion. This is due to nodejs dropping support for older versions.

### 📣 CORE FEATURES AND IMPROVEMENTS

- Support more than 99 pages.
  - New configs will default to a single page.
  - Pages can be reordered
- Modernise action advancement
  - Per delay action has been removed and replaced with a new 'Wait' action.
  - A new 'action group' action exists, which can contain other actions. This allows finer control over action execution and order
- DB file is now written with SQLite. This will make it more resilient to crashes, improves performance when saving and avoids issues with the db being too big
- Custom variables are renamed from $(internal:custom_test) to $(custom:test). The old names still work, but will be removed in a future version
- Support VEC footpedal as a surface
- Check connection Stream Deck Studio devices for available firmware updates
- Expanded keymap for emulators
- Connection labels can be edited while connections are disabled
- Add $(internal:uptime) variable
- Performance improvements for variables
- Performance improvements for button drawing
- Option to dismiss 'resize grid to surfaces' prompt
- Allow import and export to be done in YAML
- Filename of exports can be customised
- Command line option to disable admin ui password
- Add one time event trigger
- Support satellite over websockets
- Connection of actions and feedbacks can be changed
- Improve module status clarity
- Improve custom variables collapsed view
- Support HTTP GET for module variables
- Backend code refactoring to make Companion more robust
- Modules can now be built with node22
- Polish getting started docs
- Add Whats new modal and sidebar link

### 🐞 BUG FIXES

- TCP protocols not disconnecting clients when disabling server
- Allow some missing expression operators
- TCP/UDP api not accepting button text or custom variables containing slashes
- Surface rotation not being considered when checking if a surface overflows the grid bounds
- Indicate when internal variable input fields have an invalid value
- internal:bind_ip always undefined

### 🧩 NEW & UPDATED MODULES

- aimedia-icap
- aimedia-lexilive
- aja-kumo
- allenheath-ahm
- allenheath-cq
- analogway-awj
- analogway-picturall
- android-tv
- anomes-millumin
- audiotechnica-esw
- aver-ptz
- aws-elementallive
- axeltechnology-cgplus
- axeltechnology-vjpro
- axeltechnology-xplayout
- axeltechnology-xradio
- axeltechnology-youplay
- axis-ptz
- behringer-xair
- binwiederhier-ntfy
- birddog-ptz
- bmd-atem
- bmd-gpi-and-tally-interface
- bmd-ultimatte
- bmd-videohub
- boxcast-api
- brompton-tessera
- canon-ptz
- cedar-dns8d
- christie-projector
- chyronhego-lyric
- cockos-reaper
- colorlight-processor
- dan-dugan-automixer
- dataton-watchout-json
- dbaudiotechnik-amps
- dbaudiotechnik-dsp
- dcc-ex-commandstation
- denon-recorder
- digitalprojection-projectors
- discord-api
- equipson-lightshark
- evertz-quartz
- evertz-symphony
- figure53-qlab-advance
- fivem-console
- focusrite-mp8r
- fora-mfr
- generic-emberplus
- generic-http
- generic-midi
- generic-mysql
- generic-osc
- generic-pingandwake
- generic-pjlink
- generic-snmp
- generic-swp02
- generic-swp08
- generic-webtable
- getontime-ontime
- google-sheets
- h2r-graphics
- hive-beebox
- ictag-easyvideo
- imimot-mitti
- interspace-cueether
- ioversal-vertex
- josephadams-scriptlauncher
- joy-playdeck
- leolabs-ableset
- libreoffice-impress
- logos-proclaim
- malighting-grandma3
- microsoft-teams
- middleman-adit
- middleman-scte104proxy
- mixtech-theatremix
- monteiro-cronosdown
- monteiro-pptvideo
- moxa-e2200series
- nanoleaf-shapes
- neutrik-dpro
- newblue-captivate
- nexo-nxamp
- nohassleav-videowallprocessor
- novastar-controller
- novastar-splicer
- novastar-switcher
- obs-studio
- osee-gostream
- peavy-ratc
- philips-hue
- philips-sicp
- pixelhue-switcher
- presentationtools-aps
- ptzoptics-visca
- renewedvision-propresenter-api
- resolume-arena
- riedel-rrcs
- rode-rcv
- roland-p20hd
- roland-vr120hd
- roland-xs84h
- samsung-smarttv
- sennheiser-digital6000
- shure-mxn5
- sikn-kerkomroep
- simedia-yesapi
- singularlive-studio
- slack-webhooks
- smodetech-smodelive
- smokotnin-opensoundmeter
- snapav-wattbox
- socialstream-ninja
- sony-serialtally
- soundcraft-ui
- spotify-remote
- stagetec-rcp
- stagetec-xci
- studiocoast-vmix
- tascam-cd
- tascam-cd400u
- tascam-da-6400
- tasmota-http
- techministry-tallyarbiter
- telestream-prism
- toggl-track
- toolsonair-justincapture
- tplink-kasasmartplug
- tslproducts-umd
- uts-remotevolume
- vbaudio-voicemeeter
- vdo-ninja
- vicreo-hotkey
- vitec-avediaplayer9300-series
- webcomms-panel
- zenvideo-ndirouter
- zinc-oscpoint
- zoom-osc-iso

## Companion v3.4.4 - Release Notes

### 🐞 BUG FIXES

- Update macos to available version
- Show config directory tray option using wrong path
- Fix not cleaning up internal feedbacks fully when removing
- Update streamdeck lib
- Fix restarts from toggling developer tools aren't a crash #3151
- Fix don't show some local variables in triggers #3161
- Sort custom-variables dropdown in the same order as the editor #3159
- Update IDs of duplicated steps before committing, #3125

### 🐞 MODULE FIXES

- axeltechnology-cgplus
- binwiederhier-ntfy
- smodetech-smodelive
- zenvideo-ndirouter

## Companion v3.4.3 - Release Notes

### 🐞 BUG FIXES

- Surface overflow fixup ignoring surface offsets
- Fix logic feedbacks not importing in triggers (#3087)
- Enable connected Streamdecks field inverted in ui
- Fix some expression parsing bugs
- Arrow up/down keys not moving cursor in multiline expressions
- Dragging actions between groups misbehaving
- Only update hostname variables only at startup
- Update canvas lib to resolve memory leaks
- Add linux udev rules for blackmagic atem micro panel

### 🐞 MODULE FIXES

- analogway-awj
- analogway-picturall
- google-sheets
- monteiro-pptvideo
- studiocoast-vmix

## Companion v3.4.2 - Release Notes

### 🐞 BUG FIXES

- Use macos 10.15 compatible canvas library
- Improve dropdown performance
- Adding page buttons broken
- Fix ui modals closing immediately
- Fix logic feedbacks not importing correctly
- Docker image not fully supporting dev modules
- Add additional font character sets #3031

### 🐞 MODULE FIXES

- bmd-atem
- analogway-awj
- generic-webtable
- spotify-remote

## Companion v3.4.1 - Release Notes

### 🐞 BUG FIXES

- Forget streamdeck studios when resetting config #3034
- Remove emulators when resetting config #3034
- Add additional font character sets #3031
- Debounce updating variables from button drawing
- Variables for connections not being removed when removing connection
- Bugs when dragging feedbacks #3037
- Default DB to current version
- Use macos 10.15 compatible canvas library
- Reject trying to drag feedback into a child of itself #3037
- Update dependencies

### 🐞 MODULE FIXES

- analogway-awj
- axeltechnology-cgplus
- axeltechnology-vjpro
- axeltechnology-xplayout
- axeltechnology-xradio
- axeltechnology-youplay
- bmd-ultimatte
- figure53-qlab-advance
- generic-swp08
- obs-studio
- riedel-rrcs
- samsung-smarttv
- sennheiser-digital6000

## Companion v3.4.0 - Release Notes

### 📣 CORE FEATURES AND IMPROVEMENTS

- Add zoom control to button grid view
- Add internal feedbacks which allow for composition of logic
- Extend expression syntax:
  - Expressions can now be multi-line and multi-statement
  - Add time expression functions
  - Allow comments
  - Intermediate value variables
  - Objects and arrays can be mutated
- Add install name user config and show in header
- Support per-user install on windows
- Support for Stream Deck Studio
- Support for VEC footpedal as a surface
- Support for Blackmagic Atem Micro Panel
- Support for 203 Systems Mystrix panel
- Allow surfaces larger than 32 buttons in satellite api
- Add text color, css colors and row/columns in satellite api
- Support variables in satellite api
- Fuzzy match results when searching for actions/feedbacks
- Update UI to updated framework. This includes small visual changes
- Various UI tweaks and improvements
- UI to discover, list and setup Satellite installations
- Move variables tab to the top level
- Long values in variables table are collapsed for readability
- Use url parameters in some more pages, to allow for better bookmarks/links
- Add row and column to bank_bg_change TCP messages
- Improve render quality of blank buttons
- Add variables for machine hostname
- Allow changing page by surface index from variable
- Add new local variables
- Option to duplicate steps on a button
- Various module api enhancements

### 🐞 BUG FIXES

- Updated canvas library, resolving some issues drawing some unicode characters
- Very large text failing to draw with infinite loop
- Variables input field not allowing certain character combinations
- Clarify 'deprecated api' options in user config
- Navigate back buttons not working when surface is in a group
- Safari drawing buttons over scrollbar
- Avoid flickering when dragging actions or feedbacks around the editor
- Avoid ui crash when action/feedback is missing name
- Importing triggers fails to append due to duplicate ids
- Improved error handling
- Font sizes sometimes show as invalid

### 🧩 NEW & UPDATED MODULES

- aimedia-icap
- aimedia-lexilive
- allenheath-ahm
- analogway-awj
- aten-matrix
- audiotechnica-digitalmixer
- avmediatools-protimer
- avstumpfl-pixera
- aws-elementallive
- aws-medialive
- axeltechnology-xplayout
- axeltechnology-xradio
- barco-eventmaster
- baserow-baserow
- behringer-x32
- behringer-xair
- birddog-central
- birddog-cloud
- birddog-converters
- birddog-ptz
- blackbox-boxilla
- bmd-atem
- bmd-hyperdeck
- bmd-teranex
- bmd-ultimatte
- bss-soundweb
- canon-ptz
- casparcg-server
- chamsys-magicq-osc
- chamsys-magicq-udp
- chamsys-quickq
- chyronhego-lyric
- dan-dugan-automixer
- dataton-watchout-json
- evertz-symphony
- extron-smp351
- figure53-qlab-advance
- figure53-qview
- generic-blink
- generic-dataentry
- generic-filereader
- generic-http
- generic-osc
- generic-pjlink
- generic-snmp
- generic-speedtest
- generic-ssh
- generic-stopwatch
- generic-swp02
- generic-swp08
- generic-tcp-serial
- generic-tcp-udp
- generic-webtable
- getontime-ontime
- google-sheets
- h2r-graphics
- hdtv-wolfpackgreen
- highend-hog4
- homeassistant-server
- ibm-watson
- imagine-lrc
- imimot-mitti
- ioversal-vertex
- ipl-ocp
- justmacros-lua
- kiloview-ndi
- klang-app
- klang-immersive
- kramer-matrix
- leonreucher-vstopowerpoint
- lost-cause-photographic-controlroom
- ltn-schedule
- middleman-breaktime
- monteiro-pptvideo
- moxa-e2200series
- netgear-avline
- newblue-captivate
- newtek-tricaster
- nexo-nxamp
- noismada-octopusshowcontrol
- novastar-mediaserver
- novastar-mxreal3
- nrk-sofie-chef
- ntp-technology-dot
- obs-studio
- optimalaudio-zone
- panasonic-cameras
- peavy-ratc
- pixelhue-mediaserver
- presentationtools-aps
- presentationtools-cuetimer
- ptzoptics-visca
- radiodj-rest
- raspberry-gpio
- resi-decoders
- rgblink-mini
- riedel-rrcs
- rogueamoeba-farrago
- roku-tv
- roland-v160hd
- roland-v600uhd
- rossvideo-xpression
- samsung-smarttv
- sennheiser-digital6000
- shure-mxa910
- shure-mxcw
- shure-mxn5
- shure-mxw
- shure-psm1000
- shure-scm820
- shure-wireless
- simonhyde-piclock
- singularlive-studio
- slack-webhooks
- smodetech-smodelive
- socialstream-ninja
- softron-movierecorder
- songbeamer-osc
- sony-bravia
- sony-serialtally
- soundcraft-ui
- sounddevices-pixnet
- spacecommz-intercom
- spotify-remote
- stagetec-xci
- stagetimerio-api
- studiocoast-vmix
- symetrix-dsp
- tascam-cd
- tascam-cd400u
- tascam-da-6400
- tasmota-http
- techministry-tallyarbiter
- telestream-prism
- tellyo-streamstudio
- teradek-prism
- tieline-gateway
- timemachines-clock
- tinkerlist-cuez-automator
- toolsonair-justincapture
- tplink-kasasmartplug
- vaddio-ptz
- vbaudio-voicemeeter
- vdo-ninja
- vicreo-display
- videolan-vlc
- vitec-avediaplayer9300-series
- yamaha-rcp
- zenvideo-ndirouter
- zerodensity-realityhub
- zinc-oscpoint
- zoom-osc-iso

## Companion v3.3.1 - Release Notes

### 🐞 BUG FIXES

- Less aggressive log rotating #2895
- Add error handler for logStream writer #2895
- Handle 'node-machine-id' failures #2885
- Ensure variables in presets button text get replaced correctly #2837
- 'Abort all delayed actions on a page' not respecting 'use variables' checkbox #2877
- Apply wizard style

### 🐞 MODULE FIXES

- aimedia-lexilive
- aten-matrix
- avstumpfl-pixera
- barco-eventmaster
- behringer-xair
- figure53-qlab-advance
- generic-dataentry
- generic-tcp-serial
- middleman-breaktime
- ptzoptics-visca
- roku-tv
- roland-v160hd
- sony-serialtally
- studiocoast-vmix
- tascam-cd
- tascam-cd400u
- tascam-da-6400
- telestream-prism
- videolan-vlc
- vitec-avediaplayer9300-series
- zenvideo-ndirouter

## Companion v3.3.0 - Release Notes

### 📣 CORE FEATURES AND IMPROVEMENTS

- Improvements to code flow and performance of webui
- Add swap button to UI #2740

- Support 'local' variables in all internal actions, feedbacks and button text
- Support 'local' variables from modules (Note: modules need to opt into this)
- Shared udp listener #2399 (#2754)
- Extend expression syntax:
  - support for creating and decomposing objects and arrays
  - jsonpath function
  - split to array expressions function #2559
  - array join function (#2782)
  - encode and decode functions (#2842)
- add 'startup' page option in surface actions and feedbacks
- replace variable picker dropdown #2344 (#2787)
- Support custom names for Step Tabs (#2783)
- Preset text sub-headings (#2846)
- Support for Streamdeck Neo
- Support for older Loupedeck CT models
- Support for coordinates in Elgato software plugin (requires 3.0.0 of the plugin)

### 🐞 BUG FIXES

- support the new location system in companion cloud
- preset text not allowing expressions
- http api routes precedence #2820
- improve custom variable naming consistency in the ui #2812
- fix importing a config with an unknown module fails
- ensure variables in presets button text get replaced correctly #2837
- typo causing a crash in loupedeck-ct integration #2744
- correct order of presets

### 🧩 NEW & UPDATED MODULES

- adder-infinity100xseries
- adder-xdip
- aimedia-lexilive
- aja-helo
- aja-kipro
- aja-kumo
- allenheath-ahm
- arkaos-mediamaster
- aten-matrix
- audiotechnica-discussionsystem
- aver-ptz
- avstumpfl-pixera
- aws-elementallive
- axeltechnology-cgplus
- axeltechnology-vjpro
- barco-clickshare
- barco-pulse
- behringer-xair
- binwiederhier-ntfy
- birddog-cloud
- birddog-ptz
- bitfocus-cloud
- bmd-atem
- bmd-hyperdeck
- bmd-smartview
- bmd-teranex
- bmd-webpresenter
- broadlink-remote
- bss-soundweb
- canon-ptz
- canon-xf
- chamsys-quickq
- christie-spyder
- churchapps-freeshow
- colorlight-grandshow
- combitech-vidblasterx
- dan-dugan-automixer
- dashare-multiplay3
- dataton-watchout-json
- denon-recorder
- digitalprojection-projectors
- discord-api
- dolby-cinemaprocessor
- elgato-keylight
- emotimo-st4
- etc-eos
- figure53-go-button
- figure53-qlab-advance
- fora-mfr
- generic-blink
- generic-emberplus
- generic-midi
- generic-onvif
- generic-pjlink
- generic-ssh
- generic-stopwatch
- generic-swp02
- generic-tcp-serial
- generic-tcp-udp
- getontime-ontime
- glensound-minferno
- google-sheets
- h2r-graphics
- hdtv-wolfpackgreen
- hologfx-holographics
- homeassistant-server
- imimot-mitti
- interspace-mastercuev7
- justmacros-lua
- jvc-ptz
- lightware-lw3
- limagiran-holyrics
- malighting-grandma2
- malighting-grandma3
- malighting-msc
- microsoft-teams
- microsoft-vscode
- middleman-adit
- middleman-breaktime
- middlethings-middlecontrol
- mrmoco-mhc
- mvr-helios
- nec-display
- netgear-avline
- netio-powerbox
- neumannmueller-stageflow
- newblue-captivate
- notion-timestamp
- novastar-controller
- ntp-technology-dot
- obs-studio
- openweather-rest
- panasonic-avhs
- panasonic-kairos
- peavy-ratc
- pixelhue-switcher
- planningcenter-serviceslive
- polecam-autopod
- presentationtools-aps
- ptzoptics-superjoy
- ptzoptics-visca
- qsys-remote-control
- raspberry-gpio
- resolume-arena
- restream-api
- riedel-mediornet
- rogueamoeba-farrago
- roku-tv
- roland-v160hd
- roland-v60hd
- rundown-studio
- sgl-dct
- showcuesystems-scs
- shure-mxa910
- shure-p300
- shure-wireless
- simedia-yesapi
- singularlive-studio
- slack-webhooks
- smartavi-ipmatrix
- smodetech-smodelive
- softron-ontheairvideo
- sony-serialtally
- soundcraft-ui
- stagetec-xci
- studiocoast-vmix
- tascam-cd
- tascam-cd400u
- tascam-da-6400
- techministry-midirelay
- techministry-spotifycontroller
- telestream-prism
- tellyo-streamstudio
- tow-mixeffect
- tplink-kasasmartbulb
- tplink-kasasmartplug
- tplink-taposmartplug
- tslproducts-usp3
- vdo-ninja
- vicreo-hotkey
- videolan-vlc
- vitec-avediaplayer9300-series
- vivitek-projector
- voicemod-api
- yamaha-rcp
- zenvideo-ndirouter
- zerodensity-realityhub
- zinc-oscpoint
- zoom-osc-iso

## Companion v3.2.2 - Release Notes

### 🐞 BUG FIXES

- Launcher window growing horizontally infinitely
- Ensure application exits properly with the launcher
- Fix logging of rosstalk connections #2758 #2747
- Show button previews in actions/feedbacks while editing triggers
- Grid header layout issues in firefox
- Incomplete documentation for expression syntax #2743
- Restarting modules during development being too aggressive #2741

### 🧩 UPDATED MODULES

- allenheath-ahm
- bmd-hyperdeck
- bmd-webpresenter
- colorlight-grandshow
- figure53-qlab-advance
- generic-ssh
- justmacros-lua
- studiocoast-vmix

## Companion v3.2.1 - Release Notes

### 🐞 BUG FIXES

- Disable emoji font, as it causes consume to consume all available memory on some windows machines #2714
- Ensure font paths are loaded relative to the application, not working directory #2716
- Buttons incorrectly scale up small images #2718
- Ignore disabled actions when checking connection status on a button
- Changing connection label fails if actions/feedbacks/events reference invalid variables #2719
- Connection list crashing #2735
- Ensure long page names don't cause page picker to split into multiple lines
- Occasional crash when disconnecting usb device #2735
- Increase launcher stable check timeout
- Imported emulators not being setup until restart
- Typo in tcp/udp documentation #2717

### 🧩 UPDATED MODULES

- birddog-ptz
- bmd-atem
- figure53-qlab-advance
- malighting-grandma3
- middlethings-middlecontrol
- netgear-avline
- pixelhue-switcher
- restream-api
- roku-tv
- roland-v60hd
- smodetech-smodelive
- softron-ontheairvideo
- studiocoast-vmix
- techministry-midirelay

## Companion v3.2.0 - Release Notes

### 📣 CORE FEATURES AND IMPROVEMENTS

- Button grid can be resized to be smaller or larger than the default 8x4
- Rework button image drawing, to be higher resolution. This changes some font sizes slightly.

- Improved surface rotation, which rotates the whole surface not just the drawing of each button
- Change surface image scaling library to reduce install size and improve performance
- Use async HID library, removing spawning of child processes to handle HID devices
- Add fontsize and image scaling to satellite api
- Surfaces can be grouped, so that they follow page changes with each other
- Elgato Plugin performance improvements
- Export and import compressed configs
- Add support for Loupedeck CT
- Add support for Videohub Panel as a surface
- Send compressed button renders to webui
- Emulators can have their grid size changed
- Tablet page performance improvements
- Bonjour discovery broker to assist modules in discovering possible devices to control
- Indicate variables support on text input fields
- Internal action to set or create custom variable
- Slow down connection initialisation at startup, to avoid crashes on lower power machines
- Change webui build tooling to be more modern
- Rework backend code to be loosely typed
- Rework various api implementations, to support customisable grid size and avoid 'bank' terminology
- Learn timeout can be configured by modules
- Add variables about surfaces and surface groups
- Add variables for connection statuses
- Add separate press/release if condition actions

### 🐞 BUG FIXES

- Streamdeck Plus LCD strip image positioning
- Preserve sort order when importing connections
- Restore `app_exit` action
- Connections sometimes getting stuck and unable to start

### 🧩 NEW & UPDATED MODULES

- agf-characterworks
- audiostrom-liveprofessor
- avmediatools-protimer
- avocet-landscape
- avstumpfl-pixera
- aximmetry-composer
- barco-clickshare
- barco-eventmaster
- behringer-x32
- birddog-central
- birddog-cloud
- birddog-ptz
- bmd-atem
- bmd-hyperdeck
- bmd-ultimatte
- bmd-videohub
- bmd-webpresenter
- canon-ptz
- christie-spyder
- colorlight-grandshow
- colorlight-processor
- dan-dugan-automixer
- dataton-watchout
- denon-recorder
- depili-clock-8001
- emotimo-st4
- etc-eos
- etc-paradigm
- etcaudiovisuel-onlyview
- extron-smp351
- figure53-go-button
- figure53-qlab-advance
- gdsys-muxkvmswitch
- generic-bridge
- generic-dataentry
- generic-mqtt
- generic-pjlink
- generic-speedtest
- generic-stopwatch
- generic-swp02
- generic-tcp-serial
- getontime-ontime
- glensound-minferno
- globalcache-itac-cc
- google-sheets
- grassvalley-amp
- h2r-graphics
- iccms-sib
- iiyama-prolite
- imimot-mitti
- ipl-ocp
- kenku-fm
- leolabs-ableset
- lofas-ndistudioclock
- logos-proclaim
- luminex-gigacore
- luminex-luminode
- magewell-director
- malighting-grandma2
- malighting-grandma3
- malighting-msc
- massimo-callegari-qlcplus
- microsoft-vscode
- middlethings-middlecontrol
- mixtech-theatremix
- modulopi-moduloplayer
- mt-viki-matrix
- mvr-helios
- newtek-tricaster
- novastar-controller
- novastar-mediaserver
- novastar-switcher
- ntp-technology-dot
- obs-studio
- openweather-rest
- panasonic-kairos
- panasonic-projector
- panasonic-ptz
- pixelhue-mediaserver
- pixelhue-switcher
- planningcenter-serviceslive
- presentationtools-aps
- ptzoptics-visca
- qsys-remote-control
- riedel-mediornet
- rogueamoeba-farrago
- roku-tv
- roland-v60hd
- shelly-ws
- shure-mxcw
- shure-scm820
- shure-wireless
- simedia-yesapi
- singularlive-studio
- smodetech-smodelive
- snapav-wattbox
- softron-movierecorder
- softron-multicamlogger
- sonos-speakers
- soundcraft-ui
- spx-graphics-controller
- stagetimerio-api
- studiocoast-vmix
- tascam-cd
- tascam-cd400u
- tascam-da-6400
- techministry-midirelay
- tellyo-streamstudio
- teradek-prism
- theatrixx-xpresscue
- timemachines-clock
- tow-mixeffect
- ubiquiti-unifi
- vbaudio-voicemeeter
- vdo-ninja
- videolan-vlc
- vistream-online
- voicemod-api
- wled-websocket
- yamaha-rcp
- youtube-live
- zenvideo-ndirouter
- zinc-oscpoint

## Companion v3.1.2 - Release Notes

### 🐞 BUG FIXES

- Fixed xkeys unable to show colours
- Fixed https binding to wrong port at startup (#2610)
- Fixed switching between version branches failing on windows
- Fixed crash with fresh config (#2557, #2615)
- Added default for lastUpgradeIndex (#2627)
- Updated some vulnerable dependencies
- Ensured timed triggers dont trigger when enabled unexpectedly (#2626)
- Fixed handle missing property in import (#2627)

### 🐞 MODULE FIXES

- dataton-watchout
- etc-eos
- generic-mqtt
- globalcache-itac-cc
- grassvalley-amp
- presentationtools-aps
- ptzoptics-visca
- qsys-remote-control
- shelly-ws
- softron-movierecorder
- videolan-vlc
- vistream-online

## Companion v3.1.1 - Release Notes

### 🐞 BUG FIXES

- Fix Companion importing confirm from 2.4 instead of 3.0 at first start of 3.1
- Companion cloud buttons missing some status fields
- Update pngjs to improve draw performance

## Companion v3.1.0 - Release Notes

### 📣 CORE FEATURES AND IMPROVEMENTS

- Highlight trigger/connection being edited #2385 #2541
- More expression functions #2515 #2528
- Expose additional fields over ember+ #2435
- Export connection debug logs as csv #2529
- Ensure csv log export is encoded safely
- Add more connection status count variables #2507
- Use variable for step in internal: Button: Set current step #2294
- Set button step over tcp/udp #1520
- Add 12 hour internal time variables #2209
- Support for Contour Shuttle (#2436)
- Better time picker for trigger event #2544
- Reimplement infinitton surface support (untested)
- Allow inverting all boolean feedbacks #2547 (#2549)
- Support the razer stream controller
- Support Companion cloud
- Add Actions: Abort delayed actions on a trigger internal action
- Add events for computer becoming locked/unlocked #907

### 🐞 BUG FIXES

- Fix artnet listener
- Handle presets where feedbacks options are undefined
- Validate config path to import before importing
- Fix sunrise/sunset triggers causing crash
- Parsing variables containing `$` would result in incorrect output

### 🧩 NEW & UPDATED MODULES

- agf-characterworks
- aja-helo
- allenheath-ahm
- analogway-midra
- aws-elementallive
- barco-eventmaster
- birddog-ptz
- bmd-atem
- bmd-teranex
- bmd-videohub
- bmd-webpresenter
- bytehive-playoutbee
- canon-ptz
- christie-spyder
- dashare-multiplay
- figure53-qlab-advance
- generic-http
- generic-pjlink
- generic-sacn
- generic-tcp-serial
- generic-timezone
- getontime-ontime
- glensound-divine
- globalcache-itac-ir
- globalcache-itac-sl
- iccms-sib
- jozeemedia-jcounter
- lea-amplifier
- leolabs-ableset
- leonreucher-vstopowerpoint
- magnimage-mig-ec
- microsoft-teams
- monospace-lightkey
- netgear-avline
- netio-powerbox
- newtek-tricaster
- novastar-coex
- novastar-controller
- novastar-d12
- openweather-rest
- panasonic-kairos
- panasonic-panapod
- panasonic-ptz
- pixelhue-fseries
- pnh-opencountdown
- presentationtools-aps
- presentationtools-cuetimer
- shelly-http
- shelly-ws
- shure-mxw
- skaarhoj-rawpanel
- sonos-speakers
- squared-powerlink
- telegram-bot
- tellyo-streamstudio
- tesla-smart
- tesmart-hdmimatrix
- tslproducts-umd
- utahscientific-bpspanel
- videolan-vlc
- visualproductions-timecore
- wled-websocket
- youtube-live
- zenvideo-ndirouter
- zoom-osc-iso

## Companion v3.0.1 - Release Notes

### 🐞 BUG FIXES

- Local building of docker image #2542
- Missing node/yarn binaries in docker image
- Allow modules to expose `.companionconfig` files in help pages
- Time of day trigger value validation #2544
- Trigger editor references conditions instead of feedbacks
- Allow `multiselect` fields in legacy modules
- Page buttons not showing in new installations
- Warn about invalid port number being selected in the launcher
- Trigger incorrectly firing when all the conditions are invalid #2397
- Don't crash on presets missing feedback options

### 🧩 MODULES WITH BUG FIXES

- barco-eventmaster
- barco-pds
- behringer-xair
- bmd-atem
- bmd-smartview
- figure53-qlab-advance
- generic-filereader
- generic-pjlink
- google-sheets
- hdtv-wolfpackgreen
- imimot-mitti
- newtek-tricaster
- panasonic-projector
- planningcenter-serviceslive
- presentationtools-aps
- presentationtools-cuetimer
- renewedvision-propresenter
- resolume-arena
- teradek-prism
- tplink-kasasmartdimmer
- tslproducts-umdlistener
- videolan-vlc
- vistream-online
- vizio-smartcast

## Companion v3.0.0 - Release Notes

Changes are relative to v3.0.0-RC2

If you are coming from an older version, make sure to check the changes in v3.0.0-RC1 and v3.0.0-RC2, in particular the BREAKING CHANGES.

### 📣 CORE FEATURES AND IMPROVEMENTS

- Additional string functions in expressions

### 🐞 BUG FIXES

- Unable to start headless in new installations
- Emberplus server failing to handle incoming updates
- Crash when prompting about a version conflict
- Missing line ending in log files
- Make version number in header more durable
- Headless `--admin-interface` parameter
- Improve performance when a large number of variables are changed

### 🧩 NEW & UPDATED MODULES

- agf-characterworks
- aja-kumo
- analogway-awj
- analogway-livecore
- analogway-livepremier
- anomes-millumin
- arri-tally
- audiotechnica-ceilingarray
- aver-ptz
- barco-eventmaster
- bbc-raven
- behringer-xair
- betr-support
- bmd-hyperdeck
- bmd-smartview
- bytehive-playoutbee
- canon-ptz
- canon-xf
- chamsys-quickq
- dataton-watchout
- discord-api
- elgato-keylight
- epson-businesspj
- extron-smp351
- figure53-go-button
- generic-http
- generic-pjlink
- generic-smtp
- generic-ssh
- google-sheets
- govee-lights
- irisdown-remoteshowcontrol
- kiloview-encoder
- lightware-lw3
- middlethings-middlecontrol
- netio-powerbox
- notion-timestamp
- panasonic-projector
- panasonic-ptz
- pharos-designer
- ptzoptics-visca
- qsys-remote-control
- renewedvision-pvp
- resolume-arena
- roland-v600uhd
- roland-v60hd
- sony-bravia
- stagetimerio-api
- studiocoast-vmix
- techministry-spotifycontroller
- toggl-track
- tow-mixeffect
- tplink-kasasmartbulb
- tplink-kasasmartplug
- tslproducts-umdlistener
- twitch-api
- videolan-vlc
- vistream-online
- zoom-osc-iso

## Companion v3.0.0 RC2 - Release Notes

### BREAKING CHANGES

- macOS must be at least 10.15 to run Companion. This is due to nodejs dropping support for older versions.

### 📣 CORE FEATURES AND IMPROVEMENTS

- Documentation is updated for 3.0
- Port numbers are shown for all protocols in the Settings page, even those which cannot be changed
- Config directories have been rearranged to be more logical and futureproof
- New trigger event, 'on condition becoming false'

### 🐞 BUG FIXES

- Pagenumber buttons not drawing correctly #2468
- Update `sharp` to fix macOS 10.15 support
- Include logs in support bundle #2287
- Tablet page not supporting delayed press groups #2475
- Multiple decrement/increment page for a surface on a button dont combine as expected #2328
- Crash on windows if powershell.exe is unavailable #2474
- Set serialNumber to page "Back" can stop working #2484
- show_topbar button style not importing from 2.4 correctly
- Streamdeck Mini with latest firmware not working on Windows

### 🧩 NEW & UPDATED MODULES

- anomes-millumin
- atlasied-atmosphere
- audiovero-unityintercom-client
- barco-pulse
- betr-support
- bitfocus-cloud
- bmd-atem
- bmd-smartview
- bmd-videohub
- canon-ptz
- christie-projector
- cisco-roomos
- cvmeventi-countdown
- discord-api
- emotimo-st4
- etc-eos
- etc-paradigm
- generic-osc
- generic-pjlink
- generic-tcp-serial
- getontime-ontime
- govee-lights
- greengo-intercom
- h2r-graphics
- imimot-mitti
- interactivetechnololgies-cueserver
- interspace-mastercuev7
- kiloview-encoder
- leolabs-ableset
- lightware-lw3
- malighting-msc
- marshall-ipcamera
- middleman-adit
- netron-en
- newtek-tricaster
- pharos-designer
- pixap-pixtimerpro
- renewedvision-propresenter
- shure-psm1000
- shure-scm820
- softron-movierecorder
- softron-ontheairvideo
- studiocoast-vmix
- tascam-bdmp1
- techministry-timekeeper
- teradek-prism
- tow-mixeffect
- tplink-kasasmartplug
- vbaudio-voicemeeter
- yamaha-rcp
- zoom-osc-iso

## Companion v3.0.0 RC1 - Release Notes

### BREAKING CHANGES

- Windows 7, 8 and 8.1 are no longer supported. This is due to Chromium ending support for these versions.
- Modules are required to be written in a new format. Some modules may be broken or missing if they have not been updated before the release.
- Companion now runs on node 18. This should have no impact to users, only module developers.
- Large parts of the internals of Companion have been overhauled or rewritten.
- Format of streamdeck and other surfaces ids have changed. They may become unlinked in some places
- Some modules have made some breaking changes due to new requirements from Companion. Make sure to check everything over before your first show.

### 📣 CORE FEATURES AND IMPROVEMENTS

- Updated logo
- Modernisation and large restructuring of codebase
- Modules run in child processes. This ensures that module crashes cannot crash the whole of Companion
- buttons can have multiple steps (replaces latching) (https://github.com/bitfocus/companion/pull/1630) (https://github.com/bitfocus/companion/pull/2187)
- buttons can execute different actions for long presses (https://github.com/bitfocus/companion/pull/2171)
- Use hidraw usb backend on linux, this will improve usb performance on linux or companion-pi
- Split launcher and Companion main process, allow for better recovery if companion crashes
- Support module development against release builds of Companion
- Rework ui data flow, to reduce amount of data sent to the ui
- Support multiple emulators with new styling
- Overhaul tablet/web views and remove old tablet/web-buttons pages
- Watch for usb devices being connected
- Show inactive surfaces in the ui
- Various usability improvements to editing buttons (https://github.com/bitfocus/companion/pull/2127)
- Action recorder (https://github.com/bitfocus/companion/pull/2125)
- Show button preview on internal actions & feedbacks (https://github.com/bitfocus/companion/issues/2102)
- Enable/disable any action or feedback on a button or trigger
- Connections list is now manually sortable
- Triggers list is now manually sortable
- Custom variables list is now manually sortable
- Overhaul triggers editor to be like the button editor
- Support multiple event sources per trigger, and a separate condition
- Trigger on sunrise/sunset
- Image buffers returned from feedbacks will now be properly composited
- Launcher option to run at login
- Improved search function in add connections list
- Support rotary events from elgato streamdeck plugin
- Support the new Razer Stream Controller X
- Improved expression syntax with support for functions and strings
- UI style improvements
- New import/export system, allowing for more fine-grained control
- New variables of page names
- Rework internal actions to have less duplication
- Improve handling of pin locking
- Log file gets rotated with a limited size
- Surfaces can be set to never follow pin lock

### 🐞 BUG FIXES

- Ensure variable ids are valid
- Ensure custom variable ids are valid
- Ensure connection labels are valid
- Color picker indicates the currently selected swatch

### 🧩 NEW MODULES

- marshall-ipcamera
- riedel-mediornet
- panasonic-p2
- obsidiancontrol-onyx-osc
- apc-ups
- hdtv-wolfpackgreen
- camstreamer-camstreamer
- roland-p20hd
- restream-api
- gnuralnet-livetoair
- shure-mxcw
- microsoft-vscode
- android-tv
- cablematters-hdmimatrix
- simedia-yesapi
- rgblink-vsp628pro
- soundtrack-remote
- colorlight-processor
- eaton-epdu
- roland-vr120hd
- netgeat-avline
- atlasied-atmosphere
- ezcoo-matrix
- openrgb-sdk
- cyberpower-pdu

## Companion v2.4.2 - Release Notes

### 🐞 BUG FIXES

- UI crash after saving a trigger
- UI crash if module status is not a string
- Missing libasound2 in docker image

### 🐞 MODULE FIXES

- bitfocus-companion
- equipson-lightshark
- generic-artnet
- generic-sacn
- haivision-connectdvr
- zoom-osc-iso

## Companion v2.4.1 - Release Notes

### 🐞 BUG FIXES

- X-keys LEDs always show colors from page 1
- Fixes for Loupedeck support
- Dropdowns using `allowCustom` reject values if not using regex
- Export page broken (#2210)
- Colorpicker in modals broken (#2203)

### 🐞 MODULE FIXES

- analogway-awj
- bmd-atem
- esphome-api
- figure53-qlab-advance
- middleman-adit
- roland-v60hd
- zoom-osc-iso

## Companion v2.4.0 - Release Notes

### 📣 CORE FEATURES AND IMPROVEMENTS

- Option to enable react-dnd-touch-backend 'experiment'
- Filter in variables table (#1899)
- Additional custom variable internal actions
- Option to persist custom variable
- Support for new Stream Deck XL revision
- Loupedeck Live support (#2110)
- Loupedeck Live S support
- Stream Deck + support

### 🐞 BUG FIXES

- Increase yarn timeout to avoid failed builds
- Fix multi-dropdown `maxSelection` property
- Dropdown not enforcing regex when adding custom values
- Satellite bitmap rotation
- Add action/feedback modal fails to display error
- Missing method on X-keys
- Colors for bottom row of X-keys buttons not showing
- Docker: use correct directory when local modules are added (#2163)
- Select input dropdowns being clipped inside scroll regions
- Color picker posititioning
- Restore custom variable values when importing config (#2191)
- Dropdowns in modals broken (#2196)

### 🧩 NEW MODULES

- analogway-awj
- arri-tally
- audac-mtx
- birddog-central
- blustream-hdmimatrix
- cleartouch-ippctrl
- discord-api
- djsoft-radioboss
- ecamm-live
- eiki-wspprojector
- generic-filereader
- generic-ping
- google-sheets
- middleman-adit
- neumannmueller-stageflow
- nortek-bluebolt
- pnh-soundr
- rationalacoustics-smaart4
- rgblink-mini
- rgblink-x3
- roland-v160hd
- televic-dcerno
- tplink-kasasmartstrip
- tslproducts-umdlistener
- utahscientific-bpspanel
- vdwall-lvp615
- vislink-ulrx-ld
- vizrt-tcp-engine-trio

### 👍🏻 MODULE IMPROVEMENTS

- aja-helo
- arkaos-mediamaster
- barco-eventmaster
- behringer-x32
- behringer-xair
- birddog-ptz
- bitfocus-companion
- bmd-atem
- bmd-hyperdeck
- bmd-webpresenterhd
- denon-receiver
- figure53-qlab-advance
- generic-pjlink
- generic-tcp-serial
- generic-tcp-udp
- getontime-ontime
- h2r-graphics
- imimot-mitti
- ipl-ocp
- kramer-matrix
- liminalet-zoomosc
- ltn-schedule
- magewell-proconvert-decoder
- magewell-ultrastream
- malighting-grandma2
- motu-avb
- newtek-tricaster
- obs-studio
- panasonic-kairos
- panasonic-ptz
- pixap-pixtimerpro
- pnh-opencountdown
- presentationtools-aps
- presentationtools-cuetimer
- rationalacoustics-smaart3
- renewedvision-propresenter
- roland-v60hd
- rossvideo-videoserver
- seervision-suite
- softron-movierecorder
- sony-visca
- studiocoast-vmix
- techministry-spotifycontroller
- tesmart-hdmimatrix
- timemachines-clock
- tslproducts-umd
- vdo-ninja
- videolan-vlc
- vizio-smartcast
- yamaha-rcp
- zoom-osc-iso

## Companion v2.3.1 - Release Notes

### 🐞 BUG FIXES

- Presets panel sometimes erroring after adding an instance
- Dockerfile install `iputils-ping` (#2084)
- Detect satellite sockets going stale and close them
- Calls to child.send for disconnected usb devices fail
- Clone cached actions/feedbacks/presets so that UI can reliably get changes
- "Failed to build list of modules" due to module keyword issues (#2111)
- Unable to enable/disable triggers via action (#2082)

### 🐞 MODULE FIXES

- bitfocus-companion
- bmd-atem
- bytehive-playoutbee
- evertz-quartz
- generic-tcp-serial
- haivision-connectdvr
- homeassistant-server
- planningcenter-serviceslive
- pnh-opencountdown
- sony-cled
- techministry-spotifycontroller
- tslproducts-umd
- vicreo-hotkey
- vystem-api
- zoom-osc-iso

## Companion v2.3.0 - Release Notes

### 📣 CORE FEATURES AND IMPROVEMENTS

- Set custom variables with the remote protocols (HTTP, UDP, TCP & OSC)
- Support the new revision of the Streamdeck Mini
- Optimise data sending to the browser, to make usage smoother over a VPN
- Add 'learn' button for actions and feedbacks to populate with the current values (not implemented in many modules)
- Modules can handle some http requests, allowing for simpler workflows

### 🐞 BUG FIXES

- Better error handling in the UI
- Improve UI performance
- Sanitise filename of exports for unusual characters
- Add connection filter box crash with certain strings
- Time interval triggers could get into an infinite loop

### 🧩 NEW MODULES

- biamp-tesira
- devantech-ds
- discord-api
- epson-businesspj
- equipson-lightshark
- evertz-quartz
- getontime-ontime
- google-sheets
- notion-timestamp
- pnh-opencountdown
- roland-v160hd
- sony-cled
- techministry-spotifycontroller
- televic-dcerno
- teradek-prismflex
- tplink-kasasmartstrip
- videocom-zoom-bridge
- zoom-osc-iso

### 👍🏻 MODULE IMPROVEMENTS

- audiostrom-liveprofessor
- birddog-ptz
- bitfocus-companion
- bitfocus-snapshot
- bmd-atem
- bmd-hyperdeck
- bmd-videohub
- bmd-webpresenterhd
- dataton-watchout
- draco-tera
- figure53-qlab-advance
- generic-pjlink
- haivision-kbencoder
- ipl-ocp
- kramer-vp727
- lgtv-display
- newbluefx-titler
- newtek-ndistudiomonitor
- panasonic-kairos
- phillips-hue
- sennheiser-evolutionwireless
- studiocoast-vmix
- teradek-vidiu
- theatrixx-xpresscue
- timemachines-clock
- toggl-track
- vicreo-hotkey
- videolan-vlc

## Companion v2.2.3 - Release Notes

### 🐞 BUG FIXES

- Fixed surface picker id property
- Mitigated corrupt db fatal crashes
- Minor UI fixes for action/feedback options

### 🐞 MODULE FIXES

- birddog-ptz
- bitfocus-companion
- figure53-qlab-advance
- generic-pjlink
- ubiquiti-unifi
- visualproductions-bstation2

## Companion v2.2.2 - Release Notes

### 🐞 MODULE FIXES

- etc-eos
- generic-pjlink
- groupme-webhooks
- lgtv-display
- panasonic-projector
- roland-v600uhd
- studiocoast-vmix

## Companion v2.2.1 - Release Notes

### 📣 CORE FEATURES AND IMPROVEMENTS

- Support for the new Elgato Pedal
- Better support for custom modules when using Docker
- Action & Feedback browser
- Option to remove the top-bar per button
- Performance improvements of the admin UI
- Improvements to the Satellite API

### 🐞 BUG FIXES

- Fix support for Windows 7
- Some fixes when importing pages/exports
- Better XKeys support
- Some crash fixes

### 🧩 NEW MODULES

- adder-xdip
- allenheath-avantis
- birddog-ptz
- cvmeventi-countdown
- disguise-smc
- esphome-api
- groupme-webhooks
- kiloview-encoder
- lea-amplifier
- lgtv-display
- mvr-helios
- orei-matrix
- panasonic-kairos
- reddotlogics-hdmimatrix
- samsung-display
- sennheiser-evolutionwireless
- theatrixx-xpresscue
- tplink-taposmartplug
- ventuz-director
- workflownetwork-livetime

### 👍🏻 MODULE IMPROVEMENTS

- aja-helo
- aja-kumo
- barco-eventmaster
- birddog-ptz
- bitfocus-companion
- bmd-atem
- bmd-hyperdeck
- bmd-teranex
- bmd-videohub
- bmd-webpresenterhd
- canon-ptz
- christie-projector
- danielnoethen-butt
- digitalloggers-powercontroller
- draco-tera
- generic-artnet
- generic-http
- generic-osc
- generic-pjlink
- generic-swp08
- generic-websocket
- globalcache-itac-sl
- grassvalley-amp
- haivision-connectdvr
- homeassistant-server
- iiyama-prolite
- imagine-lrc
- imimot-mitti
- ltn-schedule
- magewell-proconvert-decoder
- makeprox-glue
- middlethings-middlecontrol
- newtek-tricaster
- noismada-octopuslistener
- novastar-controller
- obs-studio
- pixap-pixtimerpro
- roland-v600uhd
- roland-xs84h
- showcuesystems-scs
- skaarhoj-rawpanel
- snapav-wattbox
- softron-ontheairvideo
- spotify-remote
- studiocoast-vmix
- techministry-midirelay
- tow-mixeffect
- vicreo-hotkey
- vystem-api
- yamaha-rcp

## Companion v2.2.0 - Release Notes

### 📣 CORE FEATURES AND IMPROVEMENTS

- New UI: Written in React, designed to be much faster and more responsive
- New Configuration Wizard for new installs and upgrades
- MacOS builds are now signed and notarized, and Windows builds are signed
- Native builds for MacOS M1 processors (arm64)
- "Getting Started" Documentation Updated and Revised
- Scheduler/Trigger Management: Now you can schedule button presses based on variable values or time of day. Automate anything with Companion!
- Custom variables: Create your own variables independent of modules/connections. You can then pass these into actions or triggers.
- Re-added Ember+ server
- Additional draw functions in Image
- Option to remove the top bar on all buttons
- Context menu added to tray icon for quick access to core functions, like rescanning for USB devices
- Instances are now called Connections
- Support for X-Keys surfaces/devices (disabled by default on upgrades)
- Ability to clear the png image used on a button
- Modules no longer loaded at launch to reduce startup time
- Streamdecks can be positioned inside the 8x4 grid, not always the top left corner
- Streamdecks can now be named in the UI for easier identification
- Serve the webui over https. Note: This does not mean it should be exposed to the internet, and is intended to allow - for embedding in iframes within other applications
- USB rescan can now be triggered over the remote API protocols
- New Satellite API implementation. Simpler to implement on clients, and won't have breaking changes in future releases.
- TCP/HTTP/OSC/UDP APIs are now all opt-in (automatically enabled for existing installations), and can be run on custom ports
- Path of Companion config directory can now be specified with the COMPANION_CONFIG_BASEDIR environment variable

### BREAKING CHANGES

- The Elgato plugin (to allow you to use both Companion and the Elgato Stream Deck software at the same time) is now opt-in within Companion and disabled by default, in order to avoid conflicts between both sets of software. It must be enabled in Companion before it can be used.

### 🐞 BUG FIXES

- MacOS: UI breaking after companion has been running for many days
- Added try-catch blocking for some instance calls
- Allow PWA (Progressive Web App) for all pages
- Add some additional characters to the 7px text font
- Variable parsing can no longer get stuck in infinite loops
- MacOS: Allow binding the webui to vlan/vpn interfaces
- Various other fixes and improvements

### 🧩 NEW MODULES

- Arkaos Mediamaster
- Allen & Heath AHM
- Allen & Heath Avantis
- Axis PTZ
- Barco Clickshare
- Biamp Audia
- Bitfocus Snapshot
- Blackmagic Audio Monitor
- Blackmagic WebPresenter HD
- Blackbird HDMI Matrix
- Blackbox Boxilla
- Boinx Mimolive
- Boreal Systems Director
- Brompton Tessera
- ByteHive PlayoutBee
- Canon PTZ
- Canon XF
- Cisco WebEx (Websocket)
- ClassX Liveboard
- Connect Webcaster
- Ctpsystems dio8008r
- Cyp HDMI Matrix
- Daniel Nöthen butt - broadcast using this tool
- Dataprobe iBoot PDU
- Dcc Ex Command Station
- Digital Loggers Power Controller
- Extron XTP 3200
- Generic Websocket
- Generic SWP08
- Haivision KBencoder
- Hermann StageTimerIO
- Ifelseware avkey
- Iiyama Prolite
- Intelix INT-HDX
- ioversal Vertex
- IPL OCP
- Imagine LRC
- Jozee Media J-Counter
- Kiloview NDI
- LeadLED Clockotron
- Leafcoders Titler
- Linkbox Remote
- Livemind Recorder
- Ltn Schedule
- Lumens Media processor
- Magic Home Blub
- Makepro-x Glue
- Middlethings Middlecontrol
- Muxlab KVM
- Nexo NXAMP
- Nobe Omniscope
- Novastar H-Series
- Olzzon NDI Controller
- Panasonic Lumix
- Phillips Hue
- Rocosoft PtzJoy
- RossVideo Video Server
- Seervision Suite
- Shure MXA910
- Shure MXN5
- Shure P300
- Shure SCM820
- Skaarhoj Raw Panel
- SnapAV WattBox
- Softouch EasyWorship
- Softron MovieRecorder
- Sony Broadcast Monitor
- Spotify Remote
- SPX GC
- Symetrix DSP
- Tally-MA Wireless Tally
- Teradek VidiU X
- Tesmart HDMI Matrix
- Time Machines Corp Clock
- Toggl Track
- TPLink Kasa Smart Blub
- TPLink Kasa Smart Dimmer
- TPLink Kasa Smart Plug
- TVOne Corio
- Tow MixEffect
- Visual Productions Cuety
- VDO Ninja
- Vimeo Livestream Studio 6
- Vistream Online
- vystem Platform

### 👍🏻 MODULE IMPROVEMENTS

Many of our modules have had various new features and bugfixes since our last public release of Companion.

- Allean & Heath QU
- Allean & Heath SQ
- AJA Ki Pro
- AJA Kumo
- Analog Way Aquilon Line
- Audivero Unity Intercom Client
- Avolites Titan
- Barco Eventmaster
- Barco Pulse
- Behringer X32/M32
- Behringer XAir
- Behringer Wing
- Birddog Studio
- Birddog VISCA
- Bitfocus Companion
- Blackmagic ATEM
- Blackmagic Hyperdeck
- Blackmagic Multivew 4
- CasparCG Server
- Chamsys MagicQ OSC
- Christie Projector
- Cisco CMS
- Dataton Watchout
- Depili Clock-8001
- Dolby Cinema Processor
- Elgato Keylight
- Epiphan Pearl
- ETC EOS
- Extron SMP351
- Figure53 Go Button
- Figure53 QLab Advanced
- Generic Artnet
- Generic EmberPlus
- Generic HTTP
- Generic TCP/UDP
- Generic MQTT
- Generic OSC
- Haivision Connect DVR
- Haivision KB Encoder
- H2R Graphics
- Homeassistant
- Ifelseware avplayback
- Imimot Mitti
- JVC PTZ
- Liminalet ZoomOSC
- Lumens VISCA
- Magewell Proconvert Decoder
- Matrox Monarch
- Motu AVB
- Neodarque StageTimer2
- Newbluefx titler
- Newtek Tricaster
- OBS Studio
- OpenLP HTTP
- Panasonic AVHS
- Panasonic Camera Controller
- Panasonic Projector
- Panasonic PTZ
- Presentation tools APS
- Presentation tools Cuetimer
- Prsi iPower
- Resolume Arena
- Renewed Vision ProPresenter
- Renewed Vision PVP
- Roku TV
- Roland M5000
- Roland V60HD
- Roland V1200HD
- Rossvideo Xpression
- Shure PSM1000
- Shure Wireless
- Singular Live Studio
- Soundcraft UI
- Studiocoast vMix
- Tech Ministry Tally Arbiter
- Teradek Vidiu
- ThingM Blink(1)
- TSL Products UMD
- Twitch API
- Ubiquiti Unifi
- Vicreo Hotkey
- Vicreo Variable Listener
- Videolan VLC
- Vizio smartcast
- Yamaha RCP
- Youtube Live

## Companion v2.1.4 - Release Notes

# ⭐️ ADDED CORE FEATURES

- Support for Stream Deck MK.2

# 🐞 BUG FIXES

- Blackmagic Hyperdeck: fix for timecode variable regex

## Companion v2.1.3 - Release Notes

# 🧩 NEW MODULES

- Allen & Heath QU Series
- Allen & Heath SQ Series
- Audivero Unity Intercom Client
- AVIShop HDBaseT Matrix
- Behringer Wing
- BirdDog Studio
- Cisco CMS
- Datapath FX4
- Dolby Cinema Processor
- Gamma Control Gmaestro
- Generic TCP to Serial
- Generic Ember+
- Lectrosonics Aspen
- Liminal ZoomOSC
- Lumens VISCA
- Magewell ProConvert Decoder
- MiddleAtlantic RackLink PDU
- NewTek Tricaster
- Orfast NDI Viewer
- OpenSong
- PresentationTools CueTimer
- ProtoPie Bridge
- PRSI iPower
- Rational Acoustics Smaart 3
- Roland V-1200HD
- Shure DIS-CCU
- Sienna NDI Monitor
- Softron On The Air Video
- Teracom TCW181B
- VICREO Variable Listener
- Visual Productions BStation2

# 👍🏻 MODULE IMPROVEMENTS

- Avolites Titan: refactor to ES6, added legend feedback
- Barco DCS: option to change port
- Barco Eventmaster: bug fixes, add arming destinations
- Behringer X32: bug fixes
- Behringer XAir: bug fixes and optimizations
- BMD ATEM: support for Mini Extreme, audio gain fade control
- BMD Hyperdeck: timecode feedback, bug fixes, optimizations
- BMD VideoHub: save routing table to file, optimizations
- Datavideo VISCA: bug fixes
- Depili clock-8001: added v4 support
- DiGiCo OSC: additional support
- Digital Projection Highlight: added TCP support
- Elgato Key Light: additional support
- Epiphan Pearl: bug fixes
- Extron SMP351: record time remaining update
- Figure 53 Qlab Advance: additional support and bug fixes
- Generic HTTP: bug fixes
- Generic OSC: bug fixes
- Generic PJLink: bug fix
- Global Cache iTach IP2IR: bug fix
- H2R Graphics: bug fixes
- Imimot Mitti: additional actions and variables
- Magewell Ultra Stream: additional actions and feedback
- NewTek NDI Studio Monitor: bug fixes
- OpenLP: logging fix
- Panasonic Camera Controller: additional support and features
- Panasonic Projector: added support for PT-VZ580
- Panasonic PTZ: additional support and bug fixes
- piXap piXtimer Pro: additional actions
- Planning Center Services Live: added default choice to plan list
- Q-Sys Remote Control: bug fixes
- Renewed Vision ProPresenter: updates for v7.4.2, additional features
- Resolume Arena: bug fix
- Roku TV: better error handling
- Roland M5000: bug fixes, support for serial devices
- Ross Video RossTalk: bug fixes
- Ross Video Xpression: added uncue actions and bug fix
- Sharp TV: bug fix
- Singular.live Studio: bug fix
- Sony VISCA: additional actions
- Soundcraft UI Consoles: rewritten in TypeScript, many new features
- TechMinistry Midi Relay: improved error handling
- TechMinistry TallyArbiter: adds “reassign client” action
- Teradek VidiU: added current bitrate variable
- Tesla Smart: expanded support, added feedback
- TheLightingController: bug fixes
- ThingM blink(1): various new features
- Vaddio PTZ Cameras: presets fix
- VICREO Hotkey: documentation update

## Companion v2.1.2 - Release Notes

# 🐞 BUG FIXES

- VideoLan VLC: apply default hostname

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

- Analog Way Live Premier
- Analog Way Vertige
- ATEN Matrix
- Avolites AI
- AV ProConnect ACMX1616-AUHD
- Crystal SCTE
- Cockos Reaper
- DA Share Multiplay
- Dahua Security PTZ
- DataVideo DVIP
- Denon DN 500DB MK II
- Dexon Dimax
- Dexon Divip
- Dexon Matrix
- DiGiCo OSC
- DSan Limitimer
- DSan PerfectCue
- Epiphan Pearl
- Extron IN1604
- Extron SMP111
- Faith Chapels Video Playout Server
- Figure 53 Go Button
- Figure 53 QView
- Figure 53 QLab ("Advance")
- Folivora BTT (BetterTouchTool)
- FOR-A HVS
- Foscam PTZ
- Gallery Virtual VTR Pro
- Gefen DVI Matrix
- Generic sACN
- Generic TCP / UDP
- Generic WOL (Wake On Lan)
- Green Hippo Hippotizer
- H2R (Here2Record) Graphics
- Haivision Connect DVR
- Home Assistant Server
- James Holt X32 Theatre Control
- Joy Playdeck
- JVC PTZ Controller
- Kramer VP734
- Kramer VS 41H
- Lyntec RPC Breaker
- Mikrotik Router OS
- Magewell Ultrastream
- Magicsoft Recorder
- MA Lighting MSC
- Multicam Systems Multicam Suite
- MQTT
- NewBlueFX Titler
- NovaStar Controller
- Octova Pro DSX
- OpenLP HTTP
- Optoma Z28S
- Panasonic Camera Controller
- Pangolin Beyond
- Pixap PixTimerPro
- Presentation Tools APS
- QSys Remote Control
- Roku TV
- Roland VR50HD-MKII
- Roland XS62S
- Ross Video NK Router
- Ross Xpression
- Sain Smart Relay
- Sharp TV
- Shure PSM 1000
- Shure Wireless
- Singular Live Studio
- Slack Webhooks
- Soundcraft UI
- Sonoran Coyote
- Sonos Speakers
- Sony Bravia Displays
- Tascam BD-MP1
- The Lighting Controller
- Twitch API
- Vaddio PTZ Camera
- Vivitek Projector
- Xiamen SProLink VD Series
- Behringer X32 / Midas M32
- YouTube Live

# 🛠 MODULE IMPROVEMENTS AND FIXES

- AJA KiPro
- AJA Kumo
- Analog Way LiveCore
- Allen & Heath dLive
- Audivero Unity Intercom
- AVStumpFL Pixera
- Behringer XAir
- Blackmagic Design ATEM
- Blackmagic Design Hyperdeck
- Blackmagic Design SmartView
- Blackmagic Design Teranex
- CasparCG
- Chamsys MagicQ UDP
- Christie Widget Designer
- Christie Projector
- Disguise
- Disguise MTC
- ETC EOS
- Eventmaster
- Extron SMP351
- Figure 53 QLab (Regular module)
- Fora HVS
- Generic HTTP
- Generic OSC
- GlobalCache ITAC SL
- Irisdown Countdowntimer
- Kramer Matrix
- Living As One Decoders
- MA Lighting GrandMA2
- Millumin
- Mitti
- Neodarque Stagetimer 2
- Nevion MRP
- OBS Studio
- Obsidian Control Onyx
- Octopus
- Octopus App
- Panasonic Projector
- Panasonic PTZ
- PDS
- PJLink
- Planning Center Services Live
- PPT Remote Show Control
- RenewedVision ProPresenter
- Resolume Arena
- Roland V60HD
- Sony VISCA
- StudioCoast VMix
- TechMinistry MIDI Relay
- Teradek VidiU
- TSLProducts UMD
- VICREO Hotkey
- Vizio Smartcast
- VLC
- VYV Photon
- Watchout Production
- Yamaha SCP

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
- Barco PDS
- Blackmagic Design ATEM
- Blackmagic Design HyperDeck
- Blackmagic Design Videohub
- Cockos Reaper
- Depili Clock 8001
- Generic HTTP
- GrandMA2
- OBS Studio
- Mitti
- Neodarque StageTimer2
- Rosstalk
- Tascam CD
- X32
- GlobalCache ITAC IR
- ifelseWare AV Playback
- PVP
- QLab
- RenewedVision ProPresenter
- Tascam CD
- Playback Pro Plus
- PTZ Optics

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
