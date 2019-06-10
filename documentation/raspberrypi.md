# Raspberry Pi Installation Instructions
These instructions are for installing Companion 1.3 on a Raspberry Pi. They have been tested with a Raspberry Pi 2B and 3B+. They should function with any version of the Raspberry Pi board, but your results may vary.

> Please note: performance on any Raspberry Pi system to date is less than optimal, and can easily break. Running Companion in its current form on a Raspberry Pi is not recommended. However, since the RPi is a popular device these instructions have been provided for you to use at your own risk.
> If you insist on running Companion on a Raspberry Pi, it is recommended to run Companion headless on the "Lite" version of the Raspbian OS. This will maximize the potential performance on your Raspberry Pi.

Companion can be run in 2 different modes on the Raspberry Pi: Headless (no display attached) and Headed (display attached). The installation instructions are the same up to the point of building the code to run. In the instructions below you will note that the instructions diverge near the end to address the specific needs of headless vs headed installation and operation.

## Common Installation Steps
Before starting the installation process, you'll need to get your RPi set up and configured. If you intend to run your Raspberry Pi headless (no display attached), you'll need to make sure you've got SSH access enabled (`sudo raspi-config` on the RPi terminal to enable) before switching to headless mode. These instructions assume your RPi is fully configured and ready to go.

1. Make sure apt and all installed packages are up-to-date.
```
sudo apt-get update && sudo apt-get upgrade -y && sudo apt-get autoremove && sudo apt-get autoclean
```

2. Install some required packages.
```
sudo apt-get install libgusb-dev npm nodejs git build-essential libudev-dev libusb-1.0-0-dev -y
```

3. Because it is never recommended to run things on Linux as the root user, you will need to add a udev rule.
```
sudo touch /etc/udev/rules.d/50-companion.rules
```
Add these lines to that new file
```
sudo nano /etc/udev/rules.d/50-companion.rules
```
```
SUBSYSTEM=="input", GROUP="input", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw", ATTRS{idVendor}=="0fd9", ATTRS{idProduct}=="0060", MODE:="666", GROUP="plugdev"
SUBSYSTEM=="usb", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f40", MODE:="666", GROUP="plugdev"
KERNEL=="hidraw", ATTRS{idVendor}=="ffff", ATTRS{idProduct}=="1f40", MODE:="666", GROUP="plugdev"
```

4. Either reboot your RPi (`sudo reboot now`) or reload the udev rules `sudo udevadm control --reload-rules`

5. Install Node.js tools
```
sudo npm install n -g
sudo n 8.12.0
```
*double-check https://github.com/bitfocus/companion/blob/master/DEVELOPER.md to confirm the current required node.js version*

6. Install yarn and update your PATH variable
```
npm install yarn -g
export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"
```

7. Now we're ready to clone the repository and build. These commands will clone the respository, move into the `companion` directory, update all dependencies and modules, and create a fresh build.
```
git clone https://github.com/bitfocus/companion.git
cd companion
yarn update
yarn rpidist
```

This is the point where our instructions will diverge based on whether you intend to run your RPi headless or with a display attached.

### Headless Installation & Operation
_(no attached display)_

8. This will prep what's needed for `headless.js` to function properly.
```
./tools/build_writefile.sh
cp ~/.config/companion/db ~/companion/
```

9. The last step for headless operation is to ensure Companion will start at console boot. We currently do this via `rc.local`. You will first need to know the designation of the network interface you wish to have Companion run on (i.e. `eth0` or `wlan0`)
```
sudo nano /etc/rc.local
```
Add this line before the `exit 0` line, making sure to change the interface designation if appropriate for your setup:
```
/home/pi/companion/headless eth0
```

10. Reboot your Raspberry Pi (`sudo reboot now`), wait a couple minutes, and you should be able to access the Companion UI on port 8000 of your RPi's IP address (i.e. `http://192.168.1.2:8000`)

### Headed Installation & Operation
_(display attached to Raspberry Pi)_

8. At this point you are ready to confirm your fresh build of Companion functions.
* `yarn dev` will give you debugging fuctionality
* `yarn prod` will run silently with no debugging

9. Click the "Companion" icon in the system tray, set your desired network interface and port number, then click "Change".

10. Click ""


## Updating Companion
When you want to update the local build of Companion, you'll run the following sequence of commands:
```
yarn update
yarn rpidist
sudo reboot now
```




