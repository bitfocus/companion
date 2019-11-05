# Running on Raspberry Pi (RPi) or other Ubuntu Linux
**Performance on any Raspberry Pi system to date is less than optimal, and can easily break.** 

Running Companion in its current form on a RPi is not recommended. However, since the RPi is a popular device these instructions have been provided for you to use at your own risk. If you insist on running Companion on a RPi, it is recommended:
1. to use at minimum a RPi 4 2GB. Previous versions of the RPi are built with a USB/Ethernet stack that severely impacts the performance of Companion. The design of the RPi 4 includes a USB/Ethernet stack that does not suffer this same issue.
2. to run Companion headless on the "Lite" version of the latest build of the Raspbian OS. This will maximize the potential performance on your RPi.

## Installation Instructions
These instructions are for installing Companion on a RPi. Instructions differ slightly between versions 1.3/1.4 (stable) and 2.0 (alpha). Instructions here cover both. They have been tested with a Raspberry Pi 2B, 3B+, and 4B 2GB/4GB. Again, it is not recommended to run Companion on anything less than a Raspberry Pi 4 2GB. They should function with any version of the RPi board, but your results may vary.

Companion can be run in 2 different modes on the RPi: Headless (no display attached) and Headed (display attached). The installation instructions are the same up to the point of building the code to run. In the instructions below you will note that the instructions diverge near the end to address the specific needs of headless vs headed installation and operation.

## Common Installation Steps
Before starting the installation process, you'll need to get your RPi set up and configured. If you intend to run your RPi headless (no display attached), you'll need to make sure you've got SSH access enabled (`sudo raspi-config` on the RPi terminal to enable) before switching to headless mode. These instructions assume your RPi is fully configured and ready to go.<br>
**These steps assume you're starting from the home directory of the current user. If not, your mileage may vary with these instructions. It is recommended to move to the home directory before starting:** `cd ~`

1. Make sure apt and all installed packages are up-to-date.
```bash
sudo apt-get update && sudo apt-get upgrade -y && sudo apt-get autoclean -y && sudo apt-get autoremove
```

2. Install some required packages.
```bash
sudo apt-get install libgusb-dev npm nodejs git build-essential cmake libudev-dev libusb-1.0-0-dev -y
```

3. Because it is never recommended to run things on Linux as the root user, you will need to add a udev rule.
```bash
sudo nano /etc/udev/rules.d/50-companion.rules
```
Add these lines to that new file
```
SUBSYSTEM=="input", GROUP="input", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f40", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f40", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0063", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0063", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="006c", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="006c", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f41", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f41", MODE:="666", GROUP="plugdev"
```

4. Either reboot your RPi (`sudo reboot now`) or reload the udev rules `sudo udevadm control --reload-rules`

5. Install Node.js tools
```bash
sudo npm install n -g
sudo n 8.12.0
```
*double-check https://github.com/bitfocus/companion/blob/master/DEVELOPER.md to confirm the current required node.js version*

6. Install yarn and update your PATH variable
```bash
sudo npm install yarn -g
export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"
```

7. Now we're ready to clone the repository and build. These commands will clone the respository, move into the `companion` directory, update all dependencies and modules, and create a fresh build.
> It's important to note which version of Companion you are hoping to install: v1.3/v1.4 RC1 (both stable) or v2.0-alpha (not guaranteed to be stable). v2.0-alpha is not ready for production environments at the time of this writing (June 10, 2019), but is available for testing. The other important distinction to note is that the build commands are different between the two versions.

#### Version 1.4 (stable)
```
git clone https://github.com/bitfocus/companion.git --branch=v1.4.0
cd companion
./tools/update.sh
./tools/build_writefile.sh
```

#### Version 1.3 (stable)
```
git clone https://github.com/bitfocus/companion.git --branch=v1.3.0
cd companion
./tools/update.sh
./tools/build_writefile.sh
```

#### Version 2.0 (alpha)
```
git clone https://github.com/bitfocus/companion.git
cd companion
yarn update
./tools/build_writefile.sh
```

This is the point where our instructions will diverge based on whether you intend to run headless, with a display attached or a build to be copied to another device.

### Headless Installation & Operation
_(no attached display)_

8. If this is the first time you've run Companion headless, you need to copy the db file so headless.js can pick it up.
```bash
cp ~/.config/companion/db ~/companion/
```

9. The last step for headless operation is to ensure Companion will start at console boot. We currently do this via `rc.local`. You will first need to know the designation of the network interface you wish to have Companion run on (i.e. `eth0` or `wlan0`)
```bash
sudo nano /etc/rc.local
```
Add this line before the `exit 0` line, making sure to change the interface designation if appropriate for your setup:
```bash
/home/pi/companion/headless.js eth0
```

10. Reboot your RPi (`sudo reboot now`), wait a couple minutes, and you should be able to access the Companion UI on port 8000 of your RPi's IP address (i.e. `http://192.168.1.2:8000`)

### Headed Installation & Operation
_(display attached to RPi)_

8. At this point you are ready to confirm your fresh build of Companion functions.
  * v1.3 stable
    * `npm run start` **or** `npm --prefix /home/pi/companion start`
  * v2.0-alpha
    * `yarn prod` will start Companion silently, with no debugging
      * full explicit command: `/usr/local/bin/yarn --cwd /home/pi/companion prod`
    * `yarn dev` will start Companion with debugging fuctionality
      * full explicit command: `/usr/local/bin/yarn --cwd /home/pi/companion dev`

9. Click the "Companion" icon in the system tray to trigger the application window and set your desired network interface and port number, then click "Change".
> Note the visual difference between the v1.3 and v2.0 splash screens. If you are seeing the wrong splash, you'll need to back up to step 7 in the Common Steps to pull the correct version for building.

| v1.3 Splash Screen | v2.0 Splash Screen |
| --- | --- |
| ![Companion v1.3 Splash Screen](https://github.com/jarodwsams/companion/blob/master/documentation/images/companion-splash-1.3.png?raw=true) | ![Companion v2.0 Splash Screen](https://github.com/jarodwsams/companion/blob/master/documentation/images/companion-splash-2.0.png?raw=true) |

10. Click "Launch GUI" to confirm Companion is running. The default internet browser should open a new tab to the IP:Port set in the configuration splash screen.

#### Headed Autostart
If you would like to have Companion load automatically at startup, follow these steps:
1. Create a directory named `autostart` in your home .config directory: `mkdir ~/.config/autostart`
2. Create a new companion.desktop file (`sudo nano ~/.config/autostart/companion.desktop`) and copy the following lines  

| Version 1.3 (stable) |
| -------------------- |
| <div class="highlight highlight-source-shell"><pre>[Desktop Entry]<br>Type=Application<br>Name=Companion<br>Exec=npm --prefix /home/pi/companion start</pre></div> |

| Version 2.0 (alpha) |
| -------------------- |
| <div class="highlight highlight-source-shell"><pre>[Desktop Entry]<br>Type=Application<br>Name=Companion<br>Exec=/usr/local/bin/yarn --cwd /home/pi/companion prod</pre></div> |

> You will need to replace the "prod" in the v2.0-alpha file with dev if you intend to launch Companion with debugging.

3. Reboot, and confirm Companion starts at system start-up

### Build for another device
_(distributable build)_

Note: This will produce a Headed build, there is not currently a distributable process for headless builds

8. Run a rpi build `yarn rpidist` or `yarn lindist` for desktop linux

9. The build can be found as a tar.gz under electron-output

## Updating Companion
To update to a new release version, run the following substituting in the correct version number:
```bash
git checkout v1.4.0
./tools/update.sh
sudo reboot now
```

To update the local build of Companion v2.0 (alpha), run the following sequence of commands:
```bash
git pull
yarn update
sudo reboot now
```
