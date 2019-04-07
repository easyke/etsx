export default {
  /**
   * 需要扩展框架，只需要在这个对象的基础上继续新增框架，后面的路径是为了能够快速的异步加载
   */
  anujs: () => [import('./anujs'), require.resolve('./anujs')],
  raxjs: () => [import('./raxjs'), require.resolve('./raxjs')]
}
