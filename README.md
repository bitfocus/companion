### This is a personal fork of [Bitfocus Companion](https://bitfocus.io/companion)
#### Do not use it in production.

### How to Build and test (notes for my own use):
* First of all, merge the changes from the main repo into this fork
* After merge, do:
``` git pull origin master ```
* Run
``` /tools/update.sh ``` and close any windows that open with Visual Studio Code
* Run
``` yarn headless ``` to start the local instance. Develop and test as needed. (Only binds to localhost)
* After done testing, commit to this repo.
``` 
git add .
git commit -m "your commit message"
git push
```
* This will automatically trigger the docker image rebuild. After about 20mins, redeploy the container
* To compile windows exe installer, do 
```yarn windist``` . Close VsCode window when it opens.
* The resulting .exe will be inside the "electron-output" directory.
