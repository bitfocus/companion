const path = require('path')
const asar = require('asar')
const rimraf = require('rimraf')
const util = require('util')
const { exec } = require('child_process');
const exec2 = util.promisify(exec)
const fs = require('fs')
const pall = require('p-all')

async function runForDir(root, modName) {
    console.log('running', modName)
    await exec2('yarn --production --ignore-scripts', {
        cwd: path.join(root, modName)
    })
}

module.exports = async function(context) {
    const APP_NAME = context.packager.appInfo.productFilename;
    const PLATFORM = context.packager.platform.name;
    const resourcesPath = PLATFORM === 'mac' ? path.join(context.appOutDir, APP_NAME + '.app', 'Contents/Resources') : path.join(context.appOutDir, 'resources')

    const appAsar = path.join(resourcesPath, 'app.asar')
    const tmpApp = path.join(resourcesPath, 'app.tmp')

    console.log('unpacking')
    asar.extractAll(appAsar, tmpApp)

    const moduleDir = path.join(tmpApp, 'lib/module')
    const modules = await util.promisify(fs.readdir)(moduleDir)
    
    console.log('installing')
    
    await pall([
        async () => await runForDir(tmpApp, 'bitfocus-skeleton'),
        ...modules.map(m => async () => {
            // TODO - if a dir and has package.json?
            await runForDir(moduleDir, m)
        })
    ], {
        concurrency: 4
    })

    console.log('repacking')
    await asar.createPackage(tmpApp, appAsar)

    console.log('cleanup')
    await util.promisify(rimraf)(tmpApp)

    console.log('done')
}
