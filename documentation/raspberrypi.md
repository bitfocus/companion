in your raspberry pi console (```pi@raspberry:~/ $```)

1. Install curl
```curl -o- -L https://yarnpkg.com/install.sh | bash```

2. When curl is installed, it will add the following to your .bashrc, but that won't take effect until you open a new terminal, so instead, do it manually for now:
```export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"```

3. Clone the companion repository into your rpi (if you don't have git installed, type ```sudo apt-get install git```)
```
git clone https://github.com/bitfocus/companion.git
cd companion
```

4. Update all dependencies and modules
```./tools/update.sh```

5. Create a new build
```npm run rpidist```

6. Find your freshly baked build of companion for rpi in the electron-output folder!
