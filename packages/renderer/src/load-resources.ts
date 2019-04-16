import path from 'path'
import fs from 'graceful-fs'
import { logger } from '@etsx/utils'
import { parseTemplate } from './utils'
import Renderer, { resources } from './renderer'

export const loadResources = async (renderer: Renderer, resources: resources, mfs: any) => {
  const updated: string[] = []
  const readResource: readResource = readResourceRun.bind({
    mfs: mfs || fs,
    buildDir: renderer.options.dir.build,
  });

  (Object.keys(resourceMap) as Array<keyof resourceMap>).forEach((resourceName) => {
    const map = resourceMap[resourceName]
    if (map) {
      const { fileName, transform, encoding, isMFS } = map
      // Load resource
      const resource = readResource(fileName, encoding, isMFS)
      // Skip unavailable resources
      if (!resource) {
        logger.debug('Resource not available:', resourceName)
        return
      }
      // Apply transforms
      if (typeof transform === 'function') {
        resources[resourceName] = transform(resource, {
          readResource,
          oldValue: resources[resourceName] as any,
        })
      } else {
        // Update resource
        resources[resourceName] = resource as any
      }

      updated.push(resourceName)
    }
  })
  // Call createRenderer if any resource changed
  if (updated.length > 0 && renderer.isReady) {
    await renderer.createRenderer()
  }
  // Call resourcesLoaded hook
  logger.debug('Resources loaded:', updated.join(','))

  return renderer.etsx.callHook('render:resourcesLoaded', resources)
}

type readResource = (fullPath: string, encoding?: string, isMFS?: boolean) => (string | Buffer | void)

type readResourceContext = { mfs: any; buildDir: string; };

function readResourceRun(this: readResourceContext, fullPath: string, encoding?: string, isMFS: boolean = false, isAutoUnlink: boolean = false) {
  const _fs = isMFS ? this.mfs : fs
  fullPath = path.resolve(this.buildDir, fullPath)
  try {
    if (!_fs.existsSync(fullPath)) {
      return
    }
    const contents = _fs.readFileSync(fullPath, encoding)
    if (isAutoUnlink) {
      // 尽快清理MFS以节省内存
      _fs.unlinkSync(fullPath)
    }
    return contents as string
  } catch (err) {
    logger.error('Unable to load resource:', path.basename(fullPath), err)
  }
}
type resourceTransform<R> = (readResource: string | Buffer, o: { readResource: readResource, oldValue: R }) => R
type resourceMap = {
  [x in keyof resources]: {
    isMFS: boolean;
    fileName: string;
    transform: resourceTransform<resources[x]>;
    encoding?: string;
  };
};
const resourceMap: resourceMap = {
  errorTemplate: {
    isMFS: false,
    fileName: 'views/error.html',
    transform: (source: string | Buffer) => parseTemplate(String(source)),
    encoding: 'utf-8',
  },
  clientManifest: {
    isMFS: true,
    fileName: 'dist/server/client.manifest.json',
    transform: (source: string | Buffer) => JSON.parse(String(source)),
  },
  modernManifest: {
    isMFS: true,
    fileName: 'dist/server/modern.manifest.json',
    transform: (source: string | Buffer) => JSON.parse(String(source)),
  },
  serverManifest: {
    isMFS: true,
    fileName: 'dist/server/server.manifest.json',
    // BundleRenderer needs resolved contents
    transform: (source: string | Buffer, { readResource, oldValue  }) => {
      const serverManifest: {
        entry: string;
        files: {
          [fileName: string]: string;
        };
        maps: {
          [fileName: string]: string;
        };
      } = JSON.parse(String(source))
      oldValue = oldValue || { entry: '', files: {}, maps: {} }

      const resolveAssets = (obj: any, oldObj: any): any => {
        Object.keys(obj).forEach((name) => {
          obj[name] = readResource(path.join('dist/server/', obj[name]), 'utf-8', true)
          // Try to reuse deleted MFS files if no new version exists
          if (!obj[name]) {
            obj[name] = oldObj[name]
          }
          if (Buffer.isBuffer(obj[name])) {
            obj[name] = obj[name].toString()
          }
        })
        return obj
      }
      const files = resolveAssets(serverManifest.files, (oldValue.files || {}))
      const maps = resolveAssets(serverManifest.maps, oldValue.maps || {})

      return {
        ...serverManifest,
        files,
        maps,
      }
    },
  },
}
export default loadResources;
