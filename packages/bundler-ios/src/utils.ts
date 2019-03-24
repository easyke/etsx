import os from 'os'
import path from 'path'
import chalk from 'chalk'
import { logger } from '@etsx/utils'
import childProcess from 'child_process';
import { device } from './device'

// NpmWhich 查看命令所在目录
const NpmWhich = require('npm-which')
/**
 * 安装ios项目依赖
 */
export const installDep = async (cwd: string): Promise<void> => {
  logger.info(`pod update`)
  await logger.spawn('pod', ['update'], { cwd })
}
export type xcodeProject = {
  path: string;
  name: string;
  isWorkspace: boolean;
};
type baseLfs = {
  existsSync(path: string): boolean;
  readdirSync(path: string): string[]
};
export const findXcodeProject = async (iosPath: string, lfs: baseLfs): Promise<xcodeProject> => {
  if (!lfs) {
    throw new Error('没有找到本地文件系统')
  }

  if (!lfs.existsSync(iosPath)) {
    logger.error('iOS project not found !');
    logger.info(`You should run ${chalk.blue('weex create')} or ${chalk.blue('weex platform add ios')} first`);
    throw new Error('iOS project not found !')
  }
  // 读出目录文件
  const files = lfs.readdirSync(iosPath)
  // 排序文件
  const sortedFiles = files.sort()
  for (let i = sortedFiles.length - 1; i >= 0; i--) {
    const fileName = files[i];
    const ext = path.extname(fileName);

    if (ext === '.xcworkspace') {
      return {
        path: iosPath,
        name: fileName,
        isWorkspace: true,
      };
    }
    if (ext === '.xcodeproj') {
      return {
        path: iosPath,
        name: fileName,
        isWorkspace: false,
      };
    }
  }

  logger.error(`Could not find Xcode project files in ios folder.`);
  logger.info(`Please make sure you have installed iOS Develop Environment and CocoaPods`);
  throw new Error(`Could not find Xcode project files in ios folder.`)
}

/**
 * build the iOS app on simulator or real device
 * @param {Object} device
 * @param {Object} xcode project
 * @param {Object} options
 */
export const buildApp = async (xcodeProject: xcodeProject, isDev: boolean = false, devices?: device[]) => {
  // 获取ios项目信息
  const projectInfo = await getIOSProjectInfo(xcodeProject.path)
  // 获取scheme
  const scheme = projectInfo.schemes[0]
  const args = []
  // 指定工作空间文件XXX.xcworkspace
  args.push(`-${xcodeProject.isWorkspace ? 'workspace' : 'project'}`, xcodeProject.name)
  // 指定构建工程名称
  args.push('-scheme', scheme)
  // 选择Debug或者Release[PROD]构建
  args.push('-configuration', isDev ? 'Debug' : 'Release')
  // 调试模式 - 选择设备编译
  if (devices) {
    // 使用destinationspecifier来指定特定的目标设备。默认选择的是和对应scheme兼容的目标设备。
    devices.forEach((device) => args.push('-destination', `id=${device.udid}`))
    if (devices.filter((device) => device.isSimulator).length > 0) {
      // 在模拟器上构建iOS应用程序
      // 指定编译时使用的SDK
      args.push('-sdk', 'iphonesimulator')
      // 表示的生成的.app文件的路径 - 真机调试没有路径
      args.push('-derivedDataPath', 'build')
      args.push('clean', 'build')
    } else {
      args.push('clean', 'build')
      // 在真实设备上构建iOS应用程序
      args.push('CODE_SIGN_IDENTITY=iPhone Distribution: Nanjing Taobao Software Co., Ltd')
    }
  } else {
    // 指定编译时使用的SDK
    args.push('-sdk', 'iphoneos')
    // 表示的生成的.app文件的路径 - 真机调试没有路径
    args.push('-derivedDataPath', 'build')
    args.push('clean', 'build')
  }
  // 提示
  logger.info(`Buiding project...`)
  //
  await logger.spawn('xcodebuild', args, { cwd: xcodeProject.path })
}

type projectInfo = {
  name: string;
  targets: string[];
  configurations: string[];
  schemes: string[];
};

async function getIOSProjectInfo(iosPath: string): Promise<projectInfo> {
  return new Promise<string>((resolve, reject) => {
    childProcess.exec(
      'xcodebuild  -list',
      { encoding: 'utf8', cwd: iosPath },
      (error: childProcess.ExecException | null, stdout: string, stderr: string) => {
        logger.error(stderr)
        error ? reject(error) : resolve(stdout)
      })
  })
    .then((projectInfoText) => {
      const splits = projectInfoText.split(/Targets:|Build Configurations:|Schemes:/);
      let name: string = ''
      if (splits[0]) {
        const res = splits[0].match(/Information about project "([^"]+?)"/)
        if (res && res[1]) {
          name = res[1];
        }
      }
      const targets = splits[1] ? splits[1].split('\n').filter((e) => !!e.trim()).map((e) => e.trim()) : [];
      const configurations = splits[2] ? splits[2].split('\n').filter((e, i) => !!e.trim() && i < 3).map((e) => e.trim()) : [];
      const schemes = splits[3] ? splits[3].split('\n').filter((e) => !!e.trim()).map((e) => e.trim()) : [];
      return {
        name,
        targets,
        configurations,
        schemes,
      };
    })
}
const npmWhichs = new Map()
const getPathByNpmWhich = (cmd: string, cwd: string) => new Promise<string>((resolve, reject) => {
  const npmWhich: (cmd: string, cb: (err: Error | any, pathToTape: string) => void) => string = npmWhichs.has(cwd) ? npmWhichs.get(cwd) : NpmWhich(cwd)
  if (!npmWhichs.has(cwd)) {
    npmWhichs.set(cwd, npmWhich)
  }
  npmWhich(cmd, (err, pathToTape) => {
    err ? reject(err) : resolve(pathToTape)
  })
})
export const resolveIosDeployAutoInstall = async (cwd?: string, nodeModulesPath = path.resolve(__dirname, '../'), pkgName: string = 'ios-deploy') => getPathByNpmWhich(pkgName, nodeModulesPath)
  .catch((error) => cwd ? getPathByNpmWhich(pkgName, cwd) : Promise.reject(error))
  .catch(async () => {
    if (process.platform === 'win32') {
      logger.log('Run ios command is unsupported on windows');
      throw new Error('Run ios command is unsupported on windows')
    }
    const args = ['i', '--save', 'ios-deploy'];
    if (os.release() >= '15.0.0') {
      args.push('--unsafe-perm=true', '--allow-root');
    }
    logger.log('Instailling ios-deploy ...');
    await logger.spawn('npm', args, { cwd: nodeModulesPath })
    return getPathByNpmWhich(pkgName, nodeModulesPath)
  })
