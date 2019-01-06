# RPI DIY Builds! Yay! ;) 

in your raspberry pi console (```pi@raspberry:~/ $```)

1. Install node, git, curl, etc.
```
apt-get install nodejs git build-essential libudev-dev libusb-1.0-0-dev
sudo npm install n -g
n 8.11.1
curl -o- -L https://yarnpkg.com/install.sh | bash
```

2. When curl is installed, it will add the following to your .bashrc, but that won't take effect until you open a new terminal, so instead, do it manually for now:
```
export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"
```

3. Clone the companion repository into your RPI
```
git clone https://github.com/bitfocus/companion.git
cd companion
```

4. Update all dependencies and modules
```
./tools/update.sh
```

5. Create a new build
```
npm run rpidist
```

6. Find your freshly baked build of companion for rpi in the ```electron-output``` folder!


And after this, whenever you want to make a new updated one:
```
cd companion
./tools/update.sh
npm run rpidist
cd electron-output
ls
```
voilla!
