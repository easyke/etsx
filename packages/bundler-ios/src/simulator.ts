import childprocess from 'child_process';
import { device } from './device'
/**
 * 在模拟器中，启动软件
 * @param appId appId
 */
export const launchApp = async (appId: string, device?: string | device): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const udid = (typeof device === 'object' ? device.udid : device) || 'booted'
    childprocess.exec(
      `xcrun simctl launch ${udid} ${appId}`,
      { encoding: 'utf8' },
      (error: childprocess.ExecException | null) => {
        error ? reject(error) : resolve()
      })
  })
}
/**
 * 安装软件
 * @param iosBuildPath 路径
 */
export const installApp = async (iosBuildPath: string, device?: string | device): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const udid = (typeof device === 'object' ? device.udid : device) || 'booted'
    childprocess.exec(
      `xcrun simctl install ${udid} ${iosBuildPath}`,
      { encoding: 'utf8' },
      (error: childprocess.ExecException | null) => {
        error ? reject(error) : resolve()
      })
  })
}
/**
 * 启动模拟器
 * @param input udid
 * @param system 限定系统
 */
export const launch = async (input: device | string, system?: string | string[]): Promise<void> => {
  const udid = typeof input === 'object' ? input.udid : input
  return isAvailable(udid, system)
    .then((is) => {
      if (is) {
        return Promise.resolve()
      } else {
        return Promise.reject(new Error('simulator is not available!'))
      }
    })
    .then(() => new Promise<void>((resolve, reject) => {
      childprocess.exec(
        `xcrun instruments -w ${JSON.stringify(udid)}`,
        { encoding: 'utf8' },
        (error: childprocess.ExecException | null, stdout: string, stderr: string) => {
          // 仪器总是以255失败，因为它需要更多的参数，但我们希望它只启动模拟器
          // instruments always fail with 255 because it expects more arguments,
          // but we want it to only launch the simulator
          resolve()
        })
    }))
}
export const isAvailable = async (input: device | string, system?: string | string[]) => {
  const udid = typeof input === 'object' ? input.udid : input
  if (!udid) {
    return Promise.reject(new Error('udid error'))
  }
  const lists = (await getLists(input))
    .filter((device) => {
      if (device.udid !== udid || device.isAvailable !== true) {
        return false
      }
      if (typeof system === 'string' && system) {
        return device.system.includes(system)
      } else if (Array.isArray(system)) {
        return system.filter((st) => device.system.includes(st)).length > 0
      } else {
        return true
      }
    })
  return Array.isArray(lists) && lists.length > 0
}
export const getLists = async (input: string | device) => {
  const udid = typeof input === 'object' ? input.udid : input
  return new Promise<{
    [sys: string]: Array<{
      name: string;
      udid: string;
      state: string;
      isAvailable: boolean;
      availability: string;
      availabilityError: string;
    }>;
  }>((resolve, reject) => {
    if (udid) {
      childprocess.exec(
        'xcrun simctl list --json devices',
        { encoding: 'utf8' },
        (error: childprocess.ExecException | null, stdout: string, stderr: string) => {
          try {
            error ? reject(error) : resolve((JSON.parse(stdout || '{}') || {}).devices || {})
          } catch (err) {
            reject(err)
          }
        })
    } else {
      reject(new Error('没有传入正确的udid'))
    }
  })
    .then((devices) => ([] as Array<{
      name: string;
      udid: string;
      system: string;
      state: string;
      isAvailable: boolean;
      availability: string;
      availabilityError: string;
    }>).concat(...Object.keys(devices).map((system) => {
      return Array.isArray(devices[system]) ? devices[system].filter((device) => device.udid === udid).map((device) => Object.assign(device, { system })) : []
    })))
}
