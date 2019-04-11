export const runQueue = (queue: Router.NavigationGuard[], fn: ((q: Router.NavigationGuard, next: () => void) => void), cb: () => void): void => {
  const step = (index: number) => {
    if (index >= queue.length) {
      cb()
    } else {
      if (queue[index]) {
        fn(queue[index], () => {
          step(index + 1)
        })
      } else {
        step(index + 1)
      }
    }
  }
  step(0)
}
