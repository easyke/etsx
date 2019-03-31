import childProcess from 'child_process'
import chalk from 'chalk'
import { format } from 'util'
import cliCursor from 'cli-cursor'
import cliSpinners from 'cli-spinners'

const TEXT = Symbol('text')
const pkg = require('../pkg')
const version = process.env.__ETSX_VERSION || pkg.version
const stripAnsi = require('./strip-ansi.js')
const stringWidth = require('./string-width.js')
const Table = require('./table/index.js')
const Debug = require('debug')

type color = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray' | 'grey' | 'blackBright' | 'redBright' | 'greenBright' | 'yellowBright' | 'blueBright' | 'magentaBright' | 'cyanBright' | 'whiteBright';

interface ILogger {
  isSupported: boolean;
  options: IOptions;
  spinner: ISpinner;
  interval: number;
  hideCursor: boolean;
  isEnabled: boolean;
}
interface ISpinner {
  interval: number;
  frames: string[];
}

interface IOptions {
  /**
   * Prefix.
   */
  prefix?: string;
  symbols?: ISymbols,
  color?: color;
  stdout?: NodeJS.WriteStream;
  stderr?: NodeJS.WriteStream;
  spinner?: ISpinner;
  interval?: number;
  hideCursor?: boolean;
  isEnabled?: boolean;
}
interface ISymbols {
  info: string;
  success: string;
  warn: string;
  error: string;
  other: string;
  question: string;
}

interface ISpawnExitError extends Error {
  code: number | null;
  signal: string | null;
}

class Logger implements ILogger {
  [TEXT]?: string;
  isSupported: boolean;
  options: IOptions;
  spinner: ISpinner;
  interval: number;
  hideCursor: boolean;
  id?: NodeJS.Timeout;
  frameIndex: number;
  isEnabled: boolean;
  lineCount: number = 0;
  linesToClear: number = 0;
  constructor(options?: string | IOptions) {
    if (typeof options === 'string') {
      this.text = options
      options = {}
    }
    // 是否支持终端
    this.isSupported = Boolean(
      process.platform !== 'win32' ||
      process.env.CI ||
      process.env.TERM === 'xterm-256color')

    this.options = Object.assign({
      prefix: `[etsx@${version}]`,
      stdout: process.stdout,
      stderr: process.stderr,
    }, options)

    const sp: ISpinner | void = this.options.spinner
    if (typeof sp === 'object') {
      this.spinner = sp
    } else if (process.platform === 'win32') {
      this.spinner = cliSpinners.line
    } else if (typeof sp === 'string') {
      this.spinner = cliSpinners[sp] || cliSpinners.dots
    } else {
      this.spinner = cliSpinners.dots
    }

    if (this.spinner.frames === undefined) {
      throw new Error('Spinner must define `frames`')
    }

    this.hideCursor = this.options.hideCursor !== false
    this.interval = this.options.interval || this.spinner.interval || 100
    this.id = void 0
    this.frameIndex = 0
    if (typeof this.options.isEnabled === 'boolean') {
      this.isEnabled = this.options.isEnabled
    } else {
      this.isEnabled = Boolean(((this.stderr && this.stderr.isTTY) && !process.env.CI))
    }

    // Set *after* `this.stderr`
    this.linesToClear = 0
  }

  /**
   * 获取调试模块
   *
   * @param      {<type>}  name      The name
   * @param      {<type>}  color     The color
   * @param      {<type>}  boundary  The boundary
   * @return     {<type>}  The debug.
   */
  getDebug(name: string, color: any, boundary?: string) {
    boundary = boundary || ':'
    const debug = Debug(exports.debugPrefix + boundary + name)
    // Force green color
    debug.color = color || 2
    return debug
  }
  /**
   * Log a `message` to the console.
   * @param {any} message
   */
  log(message?: any, ...optionalParams: any[]): Logger {
    return this.stopAndPersist(chalk.cyan(this.prefix) + ' ' + this.symbols.other, format.apply(format, arguments as any))
  }

  /**
   * Log an warn `message` to the console and no exit.
   * @param {any} message
   */
  warn(message?: any, ...optionalParams: any[]): Logger {
    return this.stopAndPersist(chalk.yellow(this.prefix) + ' ' + this.symbols.warn, format.apply(format, arguments as any))
  }

  /**
   * Log an info `message` to the console and no exit.
   * @param {any} message
   */
  info(message?: any, ...optionalParams: any[]): Logger {
    return this.stopAndPersist(chalk.blue(this.prefix) + ' ' + this.symbols.info, format.apply(format, arguments as any))
  }

  debug(message?: any) {
    return this.info.apply(this, arguments as any)
  }

  /**
   * Log an error `message` to the console and no exit.
   * @param {any|Error} message
   */
  error(e?: Error | any, ...optionalParams: any[]): Logger {
    const stream = this.stderr
    const errorMsg = []
    if (arguments[0] && arguments[0].message) {
      errorMsg.push(arguments[0].message)
    }
    if (arguments[0] && arguments[0].stack) {
      Array.prototype.push.apply(errorMsg, arguments[0].stack.split('\n').slice(1))
    }
    errorMsg.push('', 'Error stringify:', format(arguments[0]))
    this.stopAndPersist(chalk.red(this.prefix) + ' ' + this.symbols.error, errorMsg.join('\n'), stream)
    if (stream) {
      stream.write(format.apply(format, Array.prototype.slice.call(arguments as IArguments, 1) as any) || this.text || '')
      stream.write('\n')
    }
    return this
  }

  /**
   * Log a success `message` to the console and exit.
   * @param {any} message
   */
  success(message?: any, ...optionalParams: any[]): Logger {
    return this.stopAndPersist(chalk.green(this.prefix) + ' ' + this.symbols.success, format.apply(format, arguments as any))
  }

  /**
   * Log an error `message` to the console and exit.
   * @param {any|Error} message
   */
  fatal(message?: any | Error, ...optionalParams: any[]) {
    this.error.apply(this, arguments as any)

    if (process.env.NODE_ENV === 'testing') {
      throw new Error('exit')
    } else {
      /* istanbul ignore next */
      process.exit(1)
    }
  }

  clear() {
    if (!this.isEnabled || !this.stderr || !this.stderr.isTTY) {
      return this
    }
    const stderr: any = this.stderr
    if (!stderr.moveCursor || !stderr.clearLine || !stderr.cursorTo) {
      return this
    }
    for (let i = 0; i < this.linesToClear; i++) {
      if (i > 0) {
        stderr.moveCursor(0, -1)
      }
      stderr.clearLine()
      stderr.cursorTo(0)
    }
    this.linesToClear = 0

    return this
  }

  start(text: string) {
    if (text) {
      this.text = text
    }

    if (!this.isEnabled) {
      if (this.stderr) {
        this.stderr.write(`- ${this.text}\n`)
      }
      return this
    }

    if (this.isSpinning) {
      return this
    }

    if (this.hideCursor) {
      cliCursor.hide(this.stderr)
    }

    this.render()
    this.id = setInterval(this.render.bind(this), this.interval)

    return this
  }

  stop() {
    if (!this.isEnabled) {
      return this
    }

    if (this.id) {
      clearInterval(this.id)
      this.id = void 0
    }
    this.frameIndex = 0
    this.clear()
    if (this.hideCursor) {
      cliCursor.show(this.stderr)
    }

    return this
  }
  render() {
    this.clear()
    if (this.stderr) {
      this.stderr.write(this.frame())
    }
    this.linesToClear = this.lineCount

    return this
  }
  frame() {
    const { frames } = this.spinner
    let frame = frames[this.frameIndex]

    if (this.color) {
      frame = chalk[this.color](frame)
    }

    this.frameIndex = ++this.frameIndex % frames.length

    return frame + ' ' + this.text
  }
  spawn(command: string, args?: ReadonlyArray<string>, options?: childProcess.SpawnOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (typeof options !== 'object') {
        options = {}
      }
      options.stdio = ['inherit', 'pipe', 'inherit', 'ipc']
      let onError = (e: Error) => {
        if (!onExit || !onError || !reject || !resolve) {
          return
        }
        reject(e)
        onExit = onError = reject = resolve = ((e: any) => { })
      }
      let onExit = (code: number | null, signal: string | null, isRun?: boolean) => {
        if (!onExit || !onError || !reject || !resolve) {
          return
        }
        if (isRun !== true) {
          process.nextTick(() => (onExit && onExit(code, signal, true)))
          return
        }
        if (code === 0) {
          resolve()
        } else {
          const e = new Error(`signal: ${signal},exit code:${code}`) as ISpawnExitError
          e.code = code
          e.signal = signal
          reject(e)
        }
        onExit = onError = reject = resolve = ((e: any) => { })
      }
      const cp = childProcess.spawn(command, args, options)

      if (cp.stdout) {
        cp.stdout.on('data', (data) => data && this.stdout && this.stdout.write(
          data.toString().split('\n').filter((line?: string) => line).map((line: string) => `${chalk.cyan(this.prefix)} ${this.symbols.other} ${command} > ${line}`).join('\n') + '\n',
        ))
      }

      // 绑定错误事件
      cp.on('error', onError)
      // 绑定退出事件
      cp.once('exit', onExit)
      // 绑定关闭事件
      cp.once('close', onExit)
    })
  }
  stopAndPersist(prefix?: string, msg?: string | Buffer, stream?: NodeJS.WriteStream): Logger {
    stream = stream || this.stdout
    this.stop()
    if (stream && this.symbols) {
      stream.write(`${prefix || (chalk.cyan(this.prefix) + ' ' + this.symbols.other)} ${msg || this.text}\n`)
    }

    return this
  }
  get text() {
    if (!this[TEXT]) {
      this[TEXT] = ''
    }
    return this[TEXT]
  }

  set text(value) {
    this[TEXT] = value
    if (this.stderr) {
      const columns = this.stderr.columns || 80
      this.lineCount = stripAnsi('--' + value).split('\n').reduce((count: number, line: string) => {
        return count + Math.max(1, Math.ceil(stringWidth(line) / columns))
      }, 0)
    }
  }
  get color() {
    if (!this.options.color) {
      this.options.color = 'cyan'
    }
    return this.options.color
  }
  set color(value) {
    this.options.color = value
  }
  get prefix(): string {
    if (!this.options.prefix) {
      this.options.prefix = ''
    }
    return this.options.prefix
  }
  set prefix(value) {
    this.options.prefix = value
  }
  get symbols(): ISymbols {
    if (!this.options.symbols) {
      if (this.isSupported) {
        this.options.symbols = {
          info: chalk.blue('ℹ'),
          success: chalk.green('✔'),
          warn: chalk.yellow('⚠'),
          error: chalk.red('✖'),
          other: chalk.gray('-'),
          question: chalk.gray('?'),
        }
      } else {
        this.options.symbols = {
          info: chalk.blue('i'),
          success: chalk.green('√'),
          warn: chalk.yellow('‼'),
          error: chalk.red('×'),
          other: chalk.gray('-'),
          question: chalk.gray('?'),
        }
      }
    }
    return this.options.symbols
  }
  set symbols(value: ISymbols) {
    this.options.symbols = value
  }
  get stdout() {
    return this.options.stdout
  }
  set stdout(value) {
    this.options.stdout = value
  }
  get stderr() {
    return this.options.stderr
  }
  set stderr(value) {
    this.options.stderr = value
  }
  get isSpinning() {
    return this.id !== null
  }
}

const logger = new Logger()

export {
  Table,
  Logger,
  logger,
  logger as default,
}
