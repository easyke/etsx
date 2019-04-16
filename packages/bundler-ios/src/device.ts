import path from 'path';
import childProcess from 'child_process';
import { resolveIosDeployAutoInstall } from './utils'
import { logger } from '@etsx/utils';
export const udidReg = /^\[{0,1}(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})\]{0,1}$/;
export const versionReg = /^\((.*?)\)$/;

export type device = {
  name: string;
  version: string;
  udid: string;
  isSimulator: boolean;
};

export const runIosDevice = async (udid: string, iosBuildPath: string, cwd?: string): Promise<void> => {
  const tape = await resolveIosDeployAutoInstall(cwd)
  return new Promise<void>((resolve, reject) => {
    childProcess.exec(
      `${tape} --justlaunch --debug --id ${udid} --bundle ${path.resolve(iosBuildPath)}`,
      { encoding: 'utf8' },
      (error: childProcess.ExecException | null, stdout: string, stderr: string) => {
        error ? reject(error) : resolve()
        error ? logger.error(stderr) : logger.info(stdout)
      })
  })
}
/**
 * 获取 IPad 设备列表
 */
export const getIPadLists = async (): Promise<device[]> => {
  return (await getLists()).filter(({ name }) => name.includes('iPad'))
}
/**
 * 获取 TV 设备列表
 */
export const getTVLists = async (): Promise<device[]> => {
  return (await getLists()).filter(({ name }) => name.includes('TV'))
}
/**
 * 获取 Watch 设备列表
 */
export const getWatchLists = async (): Promise<device[]> => {
  return (await getLists()).filter(({ name }) => name.includes('Watch'))
}
/**
 * 获取 IPhone 设备列表
 */
export const getIPhoneLists = async (): Promise<device[]> => {
  return (await getLists()).filter(({ name }) => name.includes('iPhone') && (!name.includes('Watch')))
}

/**
 * 获取设备列表
 */
export const getLists = async (): Promise<device[]> => {
  const devices: device[] = []
  return new Promise<string>((resolve, reject) => {
    childProcess.exec(
      'xcrun instruments -s devices',
      { encoding: 'utf8' },
      (error: childProcess.ExecException | null, stdout: string, stderr: string) => {
        error ? reject(error) : resolve(stdout)
      })
  })
    .then((info) => {
      return info
        .trim()
        .split(/\r?\n/)
        .forEach((line) => {
          const lines = (line || '').split(' ') || []
          const lineLen = lines.length
          for (let index: number = lineLen - 1; index >= 0; index--) {
            const udid = getUdid(lines[index])
            if (udid) {
              const isSimulator = (lines.slice(index + 1) || []).join(' ').includes('Simulator')
              const names = lines.slice(0, index)
              return devices.push({
                name: names.join(' '),
                version: getVersion(names),
                udid,
                isSimulator,
              })
            }
          }
        })
    })
    .then(() => devices)
}

export let getVersion = (names: string[]): string => {
  for (let i: number = names.length - 1; i >= 0; i--) {
    const v = names[i] && names[i].match(versionReg)
    if (v && v[1]) {
      return v[1]
    }
  }
  return ''
}

export let getUdid = (str: string): string => {
  if (str) {
    const lres = str.match(udidReg)
    if (lres && lres[1]) {
      return lres[1]
    }
  }
  return ''
}

export const setGetUdidFn = (fn: (str: string) => string): void => {
  getUdid = fn
}
export const setGetVersionFn = (fn: (names: string[]) => string): void => {
  getVersion = fn
}
