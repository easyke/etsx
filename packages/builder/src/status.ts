export type STATE = number;
export type status = {
  // 初始化阶段
  INITIAL: STATE,
  // 构建完毕阶段
  BUILD_DONE: STATE,
  // 构建中阶段
  BUILDING: STATE,
}
export const STATUS: status = {
  INITIAL: 0,
  BUILD_DONE: 1,
  BUILDING: 2,
}
export function setStatus(res: status) {
  Object.assign(STATUS, res)
}
export default STATUS
