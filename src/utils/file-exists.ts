import { access, constants } from 'node:fs';

function testFileAccess(filePath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    access(filePath, constants.F_OK, (err) => {
      if (err) {
        // console.log('file does not exist: ', err.message);
        reject(err.message);
      }
      resolve();
    });
  });
}

// helper function that returns a boolean if a file exists rather than throwing an exception
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await testFileAccess(filePath);
    return true;
  } catch (error) {
    // console.debug('fileExists error: ', error);
  }
  return false;
}

export default fileExists;
