/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export {
  savePrivateFile,
  readPrivateFile,
  setPrivateFolder
};

const homeDir = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
if (!homeDir) {
  throw new Error('Cannot determine home directory.');
}

let privateDir = join(homeDir, '.private');

function setPrivateFolder(path: string) {
  privateDir = path;
}

function savePrivateFile(name: string, data: any): void {
  try {
    if (!existsSync(privateDir)) {
      mkdirSync(privateDir);
    }
    const filePath = join(privateDir, `${name}.identity.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log('File has been saved to', filePath);
  } catch (err) {
    console.error('Error writing file:', err);
  }
}

function readPrivateFile(name: string): any | null {
  try {
    const filePath = join(privateDir,  `${name}.identity.json`);
    const fileContent = readFileSync(filePath, 'utf8');
    const jsonData: any = JSON.parse(fileContent);
    // console.log('File content:', jsonData);
    return jsonData;
  } catch (err) {
    console.error('Error reading file:', err);
    return null;
  }
}