import Store from 'electron-store';
import path from 'path';

export function createLocalStore() {
  const cwd = process.env.V2MD_CONFIG_DIR
    ? path.resolve(process.env.V2MD_CONFIG_DIR)
    : path.join(process.cwd(), '.appdata');

  return new Store({
    cwd,
    name: 'config',
  });
}

