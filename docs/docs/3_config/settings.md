---
title: Settings
sidebar_position: 5
description: Configure overall settings, protocols, and security.
---

In the Settings tab, you can configure Companion settings.

## General

The **Installation Name** is used to define the name this installation of Companion will display in the browser titles. This can be useful in networks containing multiple Companion control devices to differentiate between them in different browser tabs.

![Installation Name](images/install-name.png?raw=true 'Installation Name')

## Buttons

- **Flip counting direction up/down**  
  When unchecked, pressing the **Page Up** button will increase to the next page (from page 2 to page 3). When checked, it will decrease to the previous page (from page 2 to page 1).

- **Show + and - instead of arrows on page buttons**  
  Changes the page buttons from the standard arrows symbols to + and - symbols instead.

- **Show the topbar on each button**  
  Disable this to hid the Yellow bar and the button number at the top of each button.

## Surfaces

More details on supported surfaces are available in the chapter on [Surfaces](#7_surfaces.md).

- **Watch for new USB Devices**
  Companion can watch for newly connected USB Surfaces if this is enabled.
  If disabled, you will have to trigger a refresh yourself for Companion to use newly connected Stream Decks.

- **Watch for Discoverable Remote Surfaces**
  Companion can scan the network for network-connected Stream Decks and Companion Satellite installations.

- **Enable direct connection to Stream Decks**
  Whether to enable support for connecting to Stream Deck devices directly (not using the Elgato software)
  When this is disabled, the Elgato software can be used

- **Enable connected X-keys**
  Whether to enable support for connecting to XKeys devices.

- **Use old layout for X-keys**
  Whether to use the old layout for XKeys devices. This uses a compact layout that allows the surfaces to fit on multiple 8x4 pages.  
  We recommend disabling this, it will be removed in a future version of Companion.

- **Enable connected Loupedeck and Razer Stream Controller devices**
  Whether to enable support for connecting Loupedeck and Razer Stream Controller devices.

- **Enable connected Contour Shuttle**
  Whether to enable support for connecting to Contour Shuttle devices.

- **Enable connected Blackmagic Atem Micro Panel and Resolve Replay Editor**
  Whether to enable support for connecting to Blackmagic Atem Micro Panel and Resolve Replay Editor devices.
  When this is enabled you must not have the Atem software open, as it will conflict.

- **Enable connected VEC Footpedal**
  Whether to enable support for connecting to VEC Footpedal devices.

- **Enable connected 203 Systems Mystrix**
  Whether to enable support for connecting to 203 Systems Mystrix

### PIN lockout

- **Enable Pin Codes**  
  Allows surfaces to be locked out after a timeout and require a PIN to unlock.

- **Link Lockouts**  
  Locks out all surfaces when one is locked out.

- **Pin Code**  
  The PIN that needs to be entered to unlock the surface.

- **Pin Timeout (seconds, 0 to turn off)**  
  The number of seconds of inactivity before a surface locks. Enter `0` if you don't want it to lock out due to inactivity (instead, add an action to a button to trigger a lockout on demand).

## Protocols

### Satellite

- **Satellite Listen Port**  
  The port to listens for satellite clients on.

### TCP

_If enabled, Companion will listen for TCP messages, allowing for external devices to control Companion._

- **TCP Listener**  
  Check to allow Companion to be controlled over TCP.

- **TCP Listen Port**  
  The port to listens to commands on.

### UDP

_If enabled, Companion will listen for UDP messages, allowing for external devices to control Companion._

- **UDP Listener**  
  Check to allow Companion to be controlled over UDP.

- **UDP Listen Port**  
  The port to listens to commands on.

### OSC

_If enabled, Companion will listen for OSC messages, allowing for external devices to control Companion._

- **OSC Listener**  
  Check to allow Companion to be controlled over OSC.

- **OSC Listen Port**  
  The port to listens to commands on.

### RossTalk

_If enabled, Companion will listen for RossTalk messages, allowing for external devices to control Companion._

- **RossTalk Listener**  
  Check to allow Companion to be controlled over RossTalk.

- **RossTalk Listen Port**  
  The port to listens for RossTalk clients on.

### Ember+

_If enabled, Companion will listen for Ember+ messages, allowing for external devices to control Companion._

- **Ember+ Listener**  
  Check to allow Companion to be controlled over Ember+.

- **Ember+ Listen Port**  
  The port to listens for Ember+ connections on.

### Artnet Listener

_If enabled, Companion will listen for Artnet messages, allowing for external devices to control Companion. An example GrandMA2 fixture file for controlling Companion can be found on the bottom of that tab._

- **Artnet Listener**  
  Check to allow Companion to be controlled over Artnet.

- **Artnet Universe (first is 0)**  
  The Artnet universe Companion will listen on.

- **Artnet Channel**  
  The starting channel on the universe Companion listens to.

## Backups

TODO

## Advanced

### Admin UI Password

_If enabled, Companion will require a password to view any of the configuration pages. This does not make an installation secure, it is only designed to stop casual browsers_

- **Enable Locking**
  Whether to enable the admin password and lockout feature

- **Session Timeout (minutes, 0 for no timeout)**
  How long after being idle should the ui lock itself. If set to 0 then it does not automatically lock

- **Password**
  The password that must be entered to unlock the ui

### HTTPS Web Server

_An HTTPS server can be enabled for the Companion web interfaces should your deployment require it. It is never recommended to expose the Companion interface to the Internet and HTTPS does not provide any additional security for that configuration._

- **HTTPS Web Server**  
  Check to enable the HTTPS web server.

- **HTTPS Port**  
  The port number HTTPS is served on.

- **Certificate Type**  
  Select from "Self Signed" to use the native certificate generator or "External" to link to certificate files on the file system.

  **Common Name (Domain Name)**
  Enter the "Common Name" (typically a domain name or hostname) that the self signed certificate should be issued for.

  **Certificate Expiry Day**
  Select the number of days the self signed certificate should be issued for (365 days is the default)

  **Private Key File (full path)**
  The full file path for an external private key file.

  **Certificate File (full path)**
  The full file path for an external certificate file.

  **Chain File (full path)**
  Option field to provide the full file path for an external chain file.
