import path from 'path';
import url from 'url';

// This is needed because in nodejs typescript the __DIRNAME constant does not exist
function currentDir(fileUrl: string) {
  return path.dirname(url.fileURLToPath(fileUrl));
}

export default currentDir;
