import * as path from 'path';
import { readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { App, TerraformStack } from 'cdktf';
import currentDir from './utils/current-dir.js';
import fileExists from './utils/file-exists.js';
import StackMap from './stack-map-type.js';

interface StackInfoObj {
  stackFilePathExists: boolean,
  stackFolder: string,
  stackFileIndexPath: string,
  stackHandle?: TerraformStack,
}

// collects some more info about the folders in the stacks path
async function getStackCollection(stackRootPath: string, stackFolders: string[]): Promise<StackInfoObj[]> {
  return Promise.all(stackFolders.map(async (stackFolder) => {
    const stackFileIndexPath: string = path.join(stackRootPath, stackFolder, 'index.js');
    return {
      stackFilePathExists: await fileExists(stackFileIndexPath),
      stackFolder,
      stackFileIndexPath,
    };
  }));
}

// returns all subfolders in src\stacks
async function getStackPathArr(stackRootPath: string): Promise<string[]> {
  try {
    return (await readdir(stackRootPath, { withFileTypes: true })).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
  } catch (readDirError) {
    console.error('readdir error: ', readDirError);
    console.log('readdir stacks path: ', stackRootPath);
    console.log(`Is the "${stackRootPath}" path missing?`);
    return [];
  }
}

// turns the collection into an object where the key is the stack name and the value is the stack object
function transformStackCollectionToObj(stackCollection: StackInfoObj[]): StackMap {
  return stackCollection.reduce((accumulator: StackMap, currentValue) => {
    // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#non-null-assertion-operator
    accumulator[currentValue.stackFolder] = currentValue.stackHandle!;
    return accumulator;
  }, {});
}

// addStacks will import all folders in src\stacks that have an index.ts (or index.js) file
// the stack name used will match the folder name.  GitHub Actions can skip folders/stacks with no changes.
async function addStacks(app: App): Promise<StackMap> {
  const stackRootPath = path.join(currentDir(import.meta.url), 'stacks');
  const stackPaths = await getStackPathArr(stackRootPath);
  const rawStackCollection: StackInfoObj[] = await (await getStackCollection(stackRootPath, stackPaths))
    .filter((stackInfoObj) => stackInfoObj.stackFilePathExists === true);
  const stackCollection: StackInfoObj[] = await Promise.all(rawStackCollection.map(async (stackInfoObj) => {
    const NewStackDefaultFunc = (await import(pathToFileURL(stackInfoObj.stackFileIndexPath).href)).default;
    return { ...stackInfoObj, stackHandle: new NewStackDefaultFunc(app, stackInfoObj.stackFolder) };
  }));
  return transformStackCollectionToObj(stackCollection);
}

// This hook is so that stacks can handle cross stack references themselves.
// It it can also be used for anything that needs to happen after all the
// stacks have been instantiated and before the app.synth() is done.
// The way it works is if a stack has a "preSynth" function then it gets called
// and passes the stacksObj handle to the stack preSynth function
// https://developer.hashicorp.com/terraform/cdktf/concepts/stacks#cross-stack-references
async function triggerPreSynthHook(stacksObj: StackMap): Promise<void> {
  await Promise.all(Object.keys(stacksObj).map(async (stackKeyName) => {
    const stack = (stacksObj[stackKeyName] as any);
    if (typeof (stack?.preSynth) === 'function') {
      await stack.preSynth(stacksObj);
    }
  }));
}

// where the app starts executing
(async () => {
  const app = new App();
  const stacksObj = await addStacks(app);
  await triggerPreSynthHook(stacksObj);
  app.synth();
})();
