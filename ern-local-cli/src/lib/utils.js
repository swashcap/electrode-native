// @flow

import {
  createTmpDir,
  utils as coreUtils,
  MiniApp,
  Platform,
  reactnative,
  yarn,
  ModuleTypes,
  android,
  ios,
  PackagePath,
  NativeApplicationDescriptor,
  spin,
  shell,
  MavenUtils
} from 'ern-core'
import {
  generateRunnerProject,
  regenerateRunnerConfig
} from 'ern-runner-gen'
import {
  MavenPublisher,
  GitHubPublisher,
  JcenterPublisher
} from 'ern-container-gen'
import {
  runLocalContainerGen,
  runCauldronContainerGen
} from './publication'
import {
  spawn,
  spawnSync
} from 'child_process'
import utils from './utils'
import _ from 'lodash'
import inquirer from 'inquirer'
import semver from 'semver'
import Ensure from './Ensure'
import ora from 'ora'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import * as constants from './constants'
const {
  runAndroidProject
} = android

//
// Retrieves all native applications versions from the Cauldron, optionaly
// filtered by platform/and or release status and returns them as an array
// of native application descriptor strings
async function getNapDescriptorStringsFromCauldron ({
  platform,
  onlyReleasedVersions,
  onlyNonReleasedVersions
} : {
  platform?: 'ios' | 'android',
  onlyReleasedVersions?: boolean,
  onlyNonReleasedVersions?: boolean
} = {}) {
  const cauldron = await coreUtils.getCauldronInstance()
  const nativeApps = await cauldron.getAllNativeApps()
  return _.filter(
            _.flattenDeep(
              _.map(nativeApps, nativeApp =>
                _.map(nativeApp.platforms, p =>
                _.map(p.versions, version => {
                  if (!platform || platform === p.name) {
                    if ((version.isReleased && !onlyNonReleasedVersions) ||
                       (!version.isReleased && !onlyReleasedVersions)) {
                      return `${nativeApp.name}:${p.name}:${version.name}`
                    }
                  }
                })))), elt => elt !== undefined)
}

//
// Ensure that some conditions are satisifed
// If not, log exception error message and exit process
async function logErrorAndExitIfNotSatisfied ({
  noGitOrFilesystemPath,
  noFileSystemPath,
  isValidContainerVersion,
  isNewerContainerVersion,
  isCompleteNapDescriptorString,
  napDescriptorExistInCauldron,
  sameNativeApplicationAndPlatform,
  napDescritorDoesNotExistsInCauldron,
  publishedToNpm,
  miniAppNotInNativeApplicationVersionContainer,
  miniAppIsInNativeApplicationVersionContainer,
  miniAppIsInNativeApplicationVersionContainerWithDifferentVersion,
  dependencyNotInNativeApplicationVersionContainer,
  dependencyIsInNativeApplicationVersionContainer,
  dependencyIsInNativeApplicationVersionContainerWithDifferentVersion,
  dependencyNotInUseByAMiniApp,
  cauldronIsActive,
  isValidNpmPackageName,
  isValidElectrodeNativeModuleName
} : {
  noGitOrFilesystemPath?: {
    obj: string | Array<string>,
    extraErrorMessage?: string
  },
  noFileSystemPath?: {
    obj: string | Array<string>,
    extraErrorMessage?: string
  },
  isValidContainerVersion?: {
    containerVersion: string,
    extraErrorMessage?: string
  },
  isNewerContainerVersion?: {
    descriptor: string,
    containerVersion: string,
    extraErrorMessage?: string
  },
  isCompleteNapDescriptorString?: {
    descriptor: string,
    extraErrorMessage?: string
  },
  napDescriptorExistInCauldron?: {
    descriptor: string | Array<string>,
    extraErrorMessage?: string
  },
  sameNativeApplicationAndPlatform?: {
    descriptors: Array<string>,
    extraErrorMessage?: string
  },
  napDescritorDoesNotExistsInCauldron?: {
    descriptor: string,
    extraErrorMessage?: string
  },
  publishedToNpm?: {
    obj: string | Array<string>,
    extraErrorMessage?: string
  },
  miniAppNotInNativeApplicationVersionContainer?: {
    miniApp: string | Array<string> | void,
    napDescriptor: NativeApplicationDescriptor,
    extraErrorMessage?: string
  },
  miniAppIsInNativeApplicationVersionContainer?: {
    miniApp: string | Array<string> | void,
    napDescriptor: NativeApplicationDescriptor,
    extraErrorMessage?: string
  },
  miniAppIsInNativeApplicationVersionContainerWithDifferentVersion?: {
    miniApp: string | Array<string> | void,
    napDescriptor: NativeApplicationDescriptor,
    extraErrorMessage?: string
  },
  dependencyNotInNativeApplicationVersionContainer?: {
    dependency: string | Array<string> | void,
    napDescriptor: NativeApplicationDescriptor,
    extraErrorMessage?: string
  },
  dependencyIsInNativeApplicationVersionContainer?: {
    dependency: string | Array<string> | void,
    napDescriptor: NativeApplicationDescriptor,
    extraErrorMessage?: string
  },
  dependencyIsInNativeApplicationVersionContainerWithDifferentVersion?: {
    dependency: string | Array<string> | void,
    napDescriptor: NativeApplicationDescriptor,
    extraErrorMessage?: string
  },
  dependencyNotInUseByAMiniApp? : {
    dependency: string | Array<string> | void,
    napDescriptor: NativeApplicationDescriptor,
    extraErrorMessage?: string
  },
  cauldronIsActive?: {
    extraErrorMessage?: string
  },
  isValidNpmPackageName?: {
    name: string,
    extraErrorMessage?: string
  },
  isValidElectrodeNativeModuleName?: {
    name: string,
    extraErrorMessage?: string
  }
} = {}) {
  const spinner = ora('Performing validity checks').start()
  try {
    if (cauldronIsActive) {
      spinner.text = 'Ensuring that a Cauldron is active'
      await Ensure.cauldronIsActive(
        cauldronIsActive.extraErrorMessage
      )
    }
    if (isValidContainerVersion) {
      spinner.text = 'Ensuring that container version is valid'
      Ensure.isValidContainerVersion(
        isValidContainerVersion.containerVersion,
        isValidContainerVersion.extraErrorMessage)
    }
    if (isNewerContainerVersion) {
      spinner.text = 'Ensuring that container version is newer compared to the current one'
      await Ensure.isNewerContainerVersion(
        isNewerContainerVersion.descriptor,
        isNewerContainerVersion.containerVersion,
        isNewerContainerVersion.extraErrorMessage)
    }
    if (isCompleteNapDescriptorString) {
      spinner.text = 'Ensuring that native application descriptor is complete'
      Ensure.isCompleteNapDescriptorString(
        isCompleteNapDescriptorString.descriptor,
        isCompleteNapDescriptorString.extraErrorMessage)
    }
    if (noGitOrFilesystemPath) {
      spinner.text = 'Ensuring that not git or file system path(s) is/are used'
      Ensure.noGitOrFilesystemPath(
        noGitOrFilesystemPath.obj,
        noGitOrFilesystemPath.extraErrorMessage)
    }
    if (noFileSystemPath) {
      spinner.text = 'Ensuring that no file system path(s) is/are used'
      Ensure.noFileSystemPath(
        noFileSystemPath.obj,
        noFileSystemPath.extraErrorMessage)
    }
    if (napDescriptorExistInCauldron) {
      spinner.text = 'Ensuring that native application descriptor exists in Cauldron'
      await Ensure.napDescritorExistsInCauldron(
        napDescriptorExistInCauldron.descriptor,
        napDescriptorExistInCauldron.extraErrorMessage)
    }
    if (sameNativeApplicationAndPlatform) {
      spinner.text = 'Ensuring that all descriptors are for the same native application and platform'
      Ensure.sameNativeApplicationAndPlatform(
        sameNativeApplicationAndPlatform.descriptors,
        sameNativeApplicationAndPlatform.extraErrorMessage)
    }
    if (napDescritorDoesNotExistsInCauldron) {
      spinner.text = 'Ensuring that native application descriptor does not already exist in Cauldron'
      await Ensure.napDescritorDoesNotExistsInCauldron(
        napDescritorDoesNotExistsInCauldron.descriptor,
        napDescritorDoesNotExistsInCauldron.extraErrorMessage)
    }
    if (publishedToNpm) {
      spinner.text = 'Ensuring that package(s) version(s) have been published to NPM'
      await Ensure.publishedToNpm(
        publishedToNpm.obj,
        publishedToNpm.extraErrorMessage)
    }
    if (miniAppNotInNativeApplicationVersionContainer) {
      spinner.text = 'Ensuring that MiniApp(s) is/are not present in native application version container'
      await Ensure.miniAppNotInNativeApplicationVersionContainer(
        miniAppNotInNativeApplicationVersionContainer.miniApp,
        miniAppNotInNativeApplicationVersionContainer.napDescriptor,
        miniAppNotInNativeApplicationVersionContainer.extraErrorMessage)
    }
    if (miniAppIsInNativeApplicationVersionContainer) {
      spinner.text = 'Ensuring that MiniApp(s) is/are present in native application version container'
      await Ensure.miniAppIsInNativeApplicationVersionContainer(
        miniAppIsInNativeApplicationVersionContainer.miniApp,
        miniAppIsInNativeApplicationVersionContainer.napDescriptor,
        miniAppIsInNativeApplicationVersionContainer.extraErrorMessage)
    }
    if (miniAppIsInNativeApplicationVersionContainerWithDifferentVersion) {
      spinner.text = 'Ensuring that MiniApp(s) is/are present in native application version container with different version(s)'
      await Ensure.miniAppIsInNativeApplicationVersionContainerWithDifferentVersion(
        miniAppIsInNativeApplicationVersionContainerWithDifferentVersion.miniApp,
        miniAppIsInNativeApplicationVersionContainerWithDifferentVersion.napDescriptor,
        miniAppIsInNativeApplicationVersionContainerWithDifferentVersion.extraErrorMessage)
    }
    if (dependencyNotInNativeApplicationVersionContainer) {
      spinner.text = 'Ensuring that dependency(ies) is/are not present in native application version container'
      await Ensure.dependencyNotInNativeApplicationVersionContainer(
        dependencyNotInNativeApplicationVersionContainer.dependency,
        dependencyNotInNativeApplicationVersionContainer.napDescriptor,
        dependencyNotInNativeApplicationVersionContainer.extraErrorMessage)
    }
    if (dependencyIsInNativeApplicationVersionContainer) {
      spinner.text = 'Ensuring that dependency(ies) is/are present in native application version container'
      await Ensure.dependencyIsInNativeApplicationVersionContainer(
        dependencyIsInNativeApplicationVersionContainer.dependency,
        dependencyIsInNativeApplicationVersionContainer.napDescriptor,
        dependencyIsInNativeApplicationVersionContainer.extraErrorMessage)
    }
    if (dependencyIsInNativeApplicationVersionContainerWithDifferentVersion) {
      spinner.text = 'Ensuring that dependency(ies) is/are present in native application version container with different version(s)'
      await Ensure.dependencyIsInNativeApplicationVersionContainerWithDifferentVersion(
        dependencyIsInNativeApplicationVersionContainerWithDifferentVersion.dependency,
        dependencyIsInNativeApplicationVersionContainerWithDifferentVersion.napDescriptor,
        dependencyIsInNativeApplicationVersionContainerWithDifferentVersion.extraErrorMessage)
    }
    if (dependencyNotInUseByAMiniApp) {
      spinner.text = 'Ensuring that no MiniApp(s) is/are using a dependency'
      await Ensure.dependencyNotInUseByAMiniApp(
        dependencyNotInUseByAMiniApp.dependency,
        dependencyNotInUseByAMiniApp.napDescriptor,
        dependencyNotInUseByAMiniApp.extraErrorMessage)
    }
    if (isValidNpmPackageName) {
      spinner.text = 'Ensuring that NPM package name is valid'
      await Ensure.isValidNpmPackageName(
        isValidNpmPackageName.name,
        isValidNpmPackageName.extraErrorMessage)
    }
    if (isValidElectrodeNativeModuleName) {
      spinner.text = 'Ensuring that Electrode Native module name is valid'
      await Ensure.isValidElectrodeNativeModuleName(
        isValidElectrodeNativeModuleName.name,
        isValidElectrodeNativeModuleName.extraErrorMessage
      )
    }
    spinner.succeed('Validity checks have passed')
  } catch (e) {
    spinner.fail(e.message)
    process.exit(1)
  }
}

//
// Inquire user to choose a native application version from the Cauldron, optionally
// filtered by platform/and or release status and returns the selected one as a string
async function askUserToChooseANapDescriptorFromCauldron ({
  platform,
  onlyReleasedVersions,
  onlyNonReleasedVersions,
  message
} : {
  platform?: 'ios' | 'android',
  onlyReleasedVersions?: boolean,
  onlyNonReleasedVersions?: boolean,
  message?: string
} = {}) : Promise<string> {
  const napDescriptorStrings = await getNapDescriptorStringsFromCauldron({
    platform,
    onlyReleasedVersions,
    onlyNonReleasedVersions
  })

  if (_.isEmpty(napDescriptorStrings)) {
    throw new Error('Could not find any qualifying native application version in the Cauldron')
  }

  const { userSelectedCompleteNapDescriptor } = await inquirer.prompt([{
    type: 'list',
    name: 'userSelectedCompleteNapDescriptor',
    message: message || 'Choose a native application version',
    choices: napDescriptorStrings
  }])

  return userSelectedCompleteNapDescriptor
}

//
// Inquire user to choose one or more native application version(s) from the Cauldron, optionally
// filtered by platform/and or release status and returns the selected choices as an array of strings
async function askUserToChooseOneOrMoreNapDescriptorFromCauldron ({
  platform,
  onlyReleasedVersions,
  onlyNonReleasedVersions,
  message
} : {
  platform?: 'ios' | 'android',
  onlyReleasedVersions?: boolean,
  onlyNonReleasedVersions?: boolean,
  message?: string
} = {}) : Promise<Array<string>> {
  const napDescriptorStrings = await getNapDescriptorStringsFromCauldron({
    platform,
    onlyReleasedVersions,
    onlyNonReleasedVersions
  })

  if (_.isEmpty(napDescriptorStrings)) {
    throw new Error('Could not find any qualifying native application version in the Cauldron')
  }

  const { userSelectedCompleteNapDescriptors } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'userSelectedCompleteNapDescriptors',
    message: message || 'Choose a native application version',
    choices: napDescriptorStrings
  }])

  return userSelectedCompleteNapDescriptors
}

//
// Perform some custom work on a container in Cauldron, provided as a
// function, that is going to change the state of the container,
// and regenerate a new container and publish it.
// If any part of this function fails, the Cauldron will not get updated
async function performContainerStateUpdateInCauldron (
  stateUpdateFunc: () => Promise<*>,
  napDescriptor: NativeApplicationDescriptor,
  commitMessage: string | Array<string>, {
  containerVersion
} : {
  containerVersion?: string
} = {}) {
  if (!napDescriptor.platform) {
    throw new Error(`napDescriptor (${napDescriptor.toString()}) does not contain a platform`)
  }

  try {
    const platform = napDescriptor.platform
    var cauldron = await coreUtils.getCauldronInstance()

    let cauldronContainerVersion
    if (containerVersion) {
      cauldronContainerVersion = containerVersion
    } else {
      cauldronContainerVersion = await cauldron.getTopLevelContainerVersion(napDescriptor)
      if (cauldronContainerVersion) {
        cauldronContainerVersion = semver.inc(cauldronContainerVersion, 'patch')
      } else {
        // Default to 1.0.0 for Container version
        cauldronContainerVersion = '1.0.0'
      }
    }

    // Begin a Cauldron transaction
    await cauldron.beginTransaction()

    // Perform the custom container state update
    await stateUpdateFunc()

    const compositeMiniAppDir = createTmpDir()

    // Run container generator
    const outDir = path.join(Platform.rootDirectory, 'containergen', 'out', platform)
    await spin(`Generating new container version ${cauldronContainerVersion} for ${napDescriptor.toString()}`,
      runCauldronContainerGen(
        napDescriptor, {
          outDir,
          compositeMiniAppDir
        }))

    // Publish container
    const containerGenConfig = await cauldron.getContainerGeneratorConfig(napDescriptor)
    const publishersFromCauldron = containerGenConfig && containerGenConfig.publishers
    if (publishersFromCauldron) {
      for (const publisherFromCauldron of publishersFromCauldron) {
        switch (publisherFromCauldron.name) {
          case 'github':
            await new GitHubPublisher().publish({
              containerPath: outDir,
              containerVersion: cauldronContainerVersion,
              url: publisherFromCauldron.url
            })
            break
          case 'maven':
            await new MavenPublisher().publish({
              containerPath: outDir,
              containerVersion: cauldronContainerVersion,
              url: publisherFromCauldron.url,
              extra: {
                artifactId: `${napDescriptor.name}-ern-container`,
                groupId: 'com.walmartlabs.ern',
                mavenUser: publisherFromCauldron.mavenUser,
                mavenPassword: publisherFromCauldron.mavenPassword
              }
            })
            break
          case 'jcenter':
            await new JcenterPublisher().publish({
              containerPath: outDir,
              containerVersion: cauldronContainerVersion,
              url: '',
              extra: {
                artifactId: `${napDescriptor.name}-ern-container`,
                groupId: 'com.walmartlabs.ern'
              }
            })
            break
        }
      }
      const pathToNewYarnLock = path.join(compositeMiniAppDir, 'yarn.lock')
      await cauldron.addOrUpdateYarnLock(napDescriptor, constants.CONTAINER_YARN_KEY, pathToNewYarnLock)
    }

    // Update container version in Cauldron
    await cauldron.updateContainerVersion(napDescriptor, cauldronContainerVersion)

    // Commit Cauldron transaction
    await spin(`Updating Cauldron`, cauldron.commitTransaction(commitMessage))

    log.info(`Published new container version ${cauldronContainerVersion} for ${napDescriptor.toString()}`)
  } catch (e) {
    log.error(`[performContainerStateUpdateInCauldron] An error occurred: ${e}`)
    if (cauldron) {
      cauldron.discardTransaction()
    }
    throw e
  }
}

function epilog ({command} : {command: string}) {
  const rootUrl = 'https://electrode.gitbooks.io/electrode-native/content/cli'
  const commandWithoutOptions = command.split(' ')[0]
  const idx = _.indexOf(process.argv, commandWithoutOptions)
  let commandPath = _.slice(process.argv, 2, idx).join('/')
  commandPath = commandPath ? `/${commandPath}` : ''
  return `More info about this command @ ${chalk.bold(`${rootUrl}${commandPath}/${commandWithoutOptions}.html`)}`
}

async function runMiniApp (platform: 'android' | 'ios', {
  mainMiniAppName,
  miniapps,
  jsApiImpls,
  dependencies,
  descriptor,
  dev
} : {
  mainMiniAppName?: string,
  miniapps?: Array<string>,
  jsApiImpls?: Array<string>,
  dependencies?: Array<string>,
  descriptor?: string,
  dev?: boolean
} = {}) {
  const cwd = process.cwd()

  let napDescriptor: ?NativeApplicationDescriptor

  if (miniapps && miniapps.length > 1 && !mainMiniAppName) {
    throw new Error('If you provide multiple MiniApps you need to provide the name of the MiniApp to launch')
  }

  if (miniapps && miniapps.length > 1 && dev) {
    throw new Error('You cannot enable development mode yet when running multiple MiniApps')
  }

  if (dependencies && (dependencies.length > 0) && descriptor) {
    throw new Error('You cannot pass extra native dependencies when using a Native Application Descriptor')
  }

  if (jsApiImpls && (jsApiImpls.length > 0) && descriptor) {
    throw new Error('You cannot pass Javascript API implementations when using a Native Application Descriptor')
  }

  if (miniapps && descriptor) {
    throw new Error('You cannot use miniapps and descriptor at the same time')
  }

  let cauldron
  if (descriptor) {
    cauldron = await coreUtils.getCauldronInstance()
    if (cauldron == null) {
      throw new Error('Boum')
    }
    await utils.logErrorAndExitIfNotSatisfied({
      isCompleteNapDescriptorString: { descriptor },
      napDescriptorExistInCauldron: {
        descriptor,
        extraErrorMessage: 'You cannot create a Runner for a non existing native application version.'
      }
    })

    napDescriptor = NativeApplicationDescriptor.fromString(descriptor)
  }

  let entryMiniAppName = mainMiniAppName || ''
  let dependenciesObjs = []
  let miniAppsPaths = []
  if (miniapps) {
    if (MiniApp.existInPath(cwd)) {
      const miniapp = MiniApp.fromPath(cwd)
      miniAppsPaths = [ PackagePath.fromString(`file:${cwd}`) ]
      log.debug(`This command is being run from the ${miniapp.name} MiniApp directory.`)
      log.info(`All extra MiniApps will be included in the Runner container along with ${miniapp.name}`)
      if (!mainMiniAppName) {
        log.info(`${miniapp.name} will be set as the main MiniApp`)
        log.info(`You can select another one instead through '--mainMiniAppName' option`)
        entryMiniAppName = miniapp.name
      }
    }
    dependenciesObjs = _.map(dependencies, d => PackagePath.fromString(d))
    miniAppsPaths = miniAppsPaths.concat(_.map(miniapps, m => PackagePath.fromString(m)))
  } else if (!miniapps && !descriptor) {
    entryMiniAppName = MiniApp.fromCurrentPath().name
    log.debug(`This command is being run from the ${entryMiniAppName} MiniApp directory.`)
    log.debug(`Initializing Runner`)
    dependenciesObjs = _.map(dependencies, d => PackagePath.fromString(d))
    miniAppsPaths = [ PackagePath.fromString(`file:${cwd}`) ]
    if (dev === undefined) { // If dev is not defined it will default to true in the case of standalone MiniApp runner
      dev = true
      await reactnative.startPackagerInNewWindow(cwd)
    }
  } else {
    miniAppsPaths = (cauldron && napDescriptor && await cauldron.getContainerMiniApps(napDescriptor)) || []
  }

  let jsApiImplsPaths: Array<PackagePath> = []

  if (jsApiImpls) {
    jsApiImplsPaths = _.map(jsApiImpls, j => PackagePath.fromString(j))
  }
  if (descriptor) {
    jsApiImplsPaths = (cauldron && napDescriptor && await cauldron.getContainerJsApiImpls(napDescriptor)) || []
  }

  const outDir = path.join(Platform.rootDirectory, 'containergen', 'out', platform)
  await generateContainerForRunner(platform, {
    napDescriptor: napDescriptor || undefined,
    dependenciesObjs,
    miniAppsPaths,
    jsApiImplsPaths,
    outDir
  })

  if (platform === 'android') {
    const mavenPublisher = new MavenPublisher()
    await mavenPublisher.publish({
      containerPath: outDir,
      containerVersion: '1.0.0',
      url: MavenUtils.getDefaultMavenLocalDirectory(),
      extra: {
        artifactId: 'runner-ern-container',
        groupId: 'com.walmartlabs.ern'
      }
    })
  }

  const pathToRunner = path.join(cwd, platform)

  if (!fs.existsSync(pathToRunner)) {
    shell.mkdir('-p', pathToRunner)
    await spin(`Generating ${platform} Runner project`,
      generateRunnerProject(
        platform,
        pathToRunner,
        path.join(Platform.rootDirectory, 'containergen'),
        entryMiniAppName,
        { reactNativeDevSupportEnabled: dev }))
  } else {
    await spin(`Regenerating ${platform} Runner Configuration`,
      regenerateRunnerConfig(
        platform,
        pathToRunner,
        path.join(Platform.rootDirectory, 'containergen'),
        entryMiniAppName,
        { reactNativeDevSupportEnabled: dev }))
  }

  await launchRunner(platform, pathToRunner)
}

async function generateContainerForRunner (
  platform: 'android' | 'ios', {
    napDescriptor,
    dependenciesObjs = [],
    miniAppsPaths = [],
    jsApiImplsPaths = [],
    outDir
  } : {
    napDescriptor?: NativeApplicationDescriptor,
    dependenciesObjs: Array<PackagePath>,
    miniAppsPaths: Array<PackagePath>,
    jsApiImplsPaths: Array<PackagePath>,
    outDir: string
  } = {}) {
  if (napDescriptor) {
    await runCauldronContainerGen(napDescriptor, {
      outDir
    })
  } else {
    await runLocalContainerGen(
    miniAppsPaths,
    jsApiImplsPaths,
    platform, {
      outDir,
      extraNativeDependencies: dependenciesObjs
    })
  }
}

async function launchRunner (platform: string, pathToRunner: string) {
  if (platform === 'android') {
    return launchAndroidRunner(pathToRunner)
  } else if (platform === 'ios') {
    return launchIosRunner(pathToRunner)
  }
}

async function launchAndroidRunner (pathToAndroidRunner: string) {
  return runAndroidProject({
    projectPath: pathToAndroidRunner,
    packageName: 'com.walmartlabs.ern'
  })
}

async function launchIosRunner (pathToIosRunner: string) {
  const iosDevices = ios.getiPhoneRealDevices()
  if (iosDevices && iosDevices.length > 0) {
    launchOnDevice(pathToIosRunner, iosDevices)
  } else {
    launchOnSimulator(pathToIosRunner)
  }
}

async function launchOnDevice (pathToIosRunner: string, devices) {
  const iPhoneDevice = await ios.askUserToSelectAniPhoneDevice(devices)
  shell.cd(pathToIosRunner)
  const spinner = ora('Waiting for device to boot').start()
  try {
    spinner.text = 'Building iOS Runner project'
    await buildIosRunner(pathToIosRunner, iPhoneDevice.udid)
      .then(() => {
        const iosDeployInstallArgs = [
          '--bundle', `${pathToIosRunner}/build/Debug-iphoneos/ErnRunner.app`,
          '--id', iPhoneDevice.udid,
          '--justlaunch'
        ]
        log.info(`Start installing ErnRunner on ${iPhoneDevice.name}...`)
        const iosDeployOutput = spawnSync('ios-deploy', iosDeployInstallArgs, {encoding: 'utf8'})
        if (iosDeployOutput.error) {
          log.error('INSTALLATION FAILED')
          log.warn('Make sure you have done "npm install -g ios-deploy".')
        } else {
          spinner.succeed('Installed and Launched ErnRunner on device ')
        }
      })
  } catch (e) {
    spinner.fail(e.message)
    throw e
  }
}

async function launchOnSimulator (pathToIosRunner: string) {
  const iPhoneSim = await ios.askUserToSelectAniPhoneSimulator()
  await ios.killAllRunningSimulators()
  const spinner = ora(`Waiting for device to boot`).start()
  await ios.launchSimulator(iPhoneSim.udid)

  shell.cd(pathToIosRunner)

  try {
    spinner.text = 'Building iOS Runner project'
    await buildIosRunner(pathToIosRunner, iPhoneSim.udid)
    spinner.text = 'Installing runner project on simulator'
    await ios.installApplicationOnSimulator(iPhoneSim.udid, `${pathToIosRunner}/build/Debug-iphonesimulator/ErnRunner.app`)
    spinner.text = 'Launching runner project'
    await ios.launchApplication(iPhoneSim.udid, 'com.yourcompany.ernrunner')
    spinner.succeed('Done')
  } catch (e) {
    spinner.fail(e.message)
    throw e
  }
}

async function buildIosRunner (pathToIosRunner: string, udid: string) {
  return new Promise((resolve, reject) => {
    const xcodebuildProc = spawn('xcodebuild', [
      `-scheme`, 'ErnRunner', 'build',
      `-destination`, `id=${udid}`,
      `SYMROOT=${pathToIosRunner}/build` ],
       { cwd: pathToIosRunner })

    xcodebuildProc.stdout.on('data', data => {
      log.debug(data)
    })
    xcodebuildProc.stderr.on('data', data => {
      log.debug(data)
    })
    xcodebuildProc.on('close', code => {
      code === 0
        ? resolve()
        : reject(new Error(`XCode xcbuild command failed with exit code ${code}`))
    })
  })
}

async function doesPackageExistInNpm (packageName: string) : Promise<boolean> {
  try {
    const result = await yarn.info(PackagePath.fromString(packageName), {field: 'versions 2> /dev/null', json: true})
    if (result && result.type === `inspect`) {
      return true
    }
  } catch (e) {
    // If the package name doesn't exist in the NPM registry, Do nothing
    // {"type":"error","data":"Received invalid response from npm."}
  }
  return false
}

async function performPkgNameConflictCheck (name: string) : Promise<boolean> {
  // check if the packageName exists
  let isPackageNameInNpm = await doesPackageExistInNpm(name)
  if (isPackageNameInNpm) {
    const {continueIfPkgNameExists} = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueIfPkgNameExists',
      message: `The package with name ${name} is already published in NPM registry. Do you wish to continue?`,
      default: false
    }])
    return continueIfPkgNameExists
  }
  return true // If package name doesn't exist continue with command execution
}

function checkIfModuleNameContainsSuffix (moduleName: string, moduleType: string): boolean {
  if (moduleName) {
    switch (moduleType) {
      case ModuleTypes.MINIAPP:
        return moduleName.toUpperCase().indexOf('MINIAPP') > -1
      case ModuleTypes.API:
        return moduleName.toUpperCase().indexOf('API') > -1
      case ModuleTypes.JS_API_IMPL:
        return moduleName.toUpperCase().indexOf('APIIMPLJS') > -1
      case ModuleTypes.NATIVE_API_IMPL:
        return moduleName.toUpperCase().indexOf('APIIMPLNATIVE') > -1
      default:
        return false
    }
  }
  return false
}

async function promptUserToUseSuffixModuleName (moduleName: string, moduleType: string): Promise<string> {
  let message = ''
  let suffixedModuleName = moduleName
  if (moduleName) {
    switch (moduleType) {
      case ModuleTypes.MINIAPP:
        suffixedModuleName = `${moduleName}MiniApp`
        message = `We recommend suffixing the name of ${moduleName} with MiniApp, Do you want to use ${suffixedModuleName}?`
        break
      case ModuleTypes.API:
        suffixedModuleName = `${moduleName}Api`
        message = `We recommend suffixing the name of ${moduleName} with Api, Do you want to use ${suffixedModuleName}?`
        break
      case ModuleTypes.JS_API_IMPL:
        suffixedModuleName = `${moduleName}ApiImplJs`
        message = `We recommend suffixing the name of ${moduleName} with ApiImplJs, Do you want to use ${suffixedModuleName}?`
        break
      case ModuleTypes.NATIVE_API_IMPL:
        suffixedModuleName = `${moduleName}ApiImplNative`
        message = `We recommend suffixing the name of ${moduleName} with ApiImplNative, Do you want to use ${suffixedModuleName}?`
        break
      default:
        throw new Error(`Unsupported module type : ${moduleType}`)
    }
  }

  const {useSuffixedModuleName} = await inquirer.prompt(
    {
      type: 'confirm',
      name: 'useSuffixedModuleName',
      message: message,
      default: true
    }
  )

  return useSuffixedModuleName ? suffixedModuleName : moduleName
}

async function getDescriptorsMatchingSemVerDescriptor (semVerDescriptor: NativeApplicationDescriptor)
  : Promise<Array<NativeApplicationDescriptor>> {
  if (!semVerDescriptor.platform || !semVerDescriptor.version) {
    throw new Error(`${semVerDescriptor.toString()} descriptor is missing platform and/or version`)
  }
  const result = []
  const cauldron = await coreUtils.getCauldronInstance()
  const versionsNames = await cauldron.getVersionsNames(semVerDescriptor)
  const semVerVersionNames = normalizeVersionsToSemver(versionsNames)
  const zippedVersions = _.zipWith(versionsNames, semVerVersionNames, (nonSemVer, semVer) => ({nonSemVer, semVer}))

  const versions = _.filter(zippedVersions, z => semver.satisfies(z.semVer, semVerDescriptor.version))
  for (const version of versions) {
    const descriptor = new NativeApplicationDescriptor(semVerDescriptor.name, semVerDescriptor.platform, version.nonSemVer)
    result.push(descriptor)
  }

  return result
}

function normalizeVersionsToSemver (versions: Array<string>) : Array<string> {
  const validSemVerRe = /^\d+\.\d+.\d+.*/
  const versionMissingPatchRe = /^(\d+\.\d+)(.*)/
  const versionMissingMinorRe = /^(\d+)(.*)/
  return _.map(versions, v => {
    if (validSemVerRe.test(v)) {
      return v
    } else {
      if (versionMissingPatchRe.test(v)) {
        return v.replace(versionMissingPatchRe, '$1.0$2')
      } else if (versionMissingMinorRe.test(v)) {
        return v.replace(versionMissingMinorRe, '$1.0.0$2')
      }
    }
  })
}

export default {
  getNapDescriptorStringsFromCauldron,
  logErrorAndExitIfNotSatisfied,
  askUserToChooseANapDescriptorFromCauldron,
  askUserToChooseOneOrMoreNapDescriptorFromCauldron,
  performContainerStateUpdateInCauldron,
  epilog,
  runMiniApp,
  doesPackageExistInNpm,
  performPkgNameConflictCheck,
  checkIfModuleNameContainsSuffix,
  promptUserToUseSuffixModuleName,
  getDescriptorsMatchingSemVerDescriptor,
  normalizeVersionsToSemver
}
