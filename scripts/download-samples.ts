import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';


async function downloadAndExtract() {
  try {
    // 目标目录
    const targetDir = path.join(import.meta.dirname, '..', 'apps', 'mock', 'public', 'video', 'huge');
    const url = 'https://sourceforge.net/projects/matroska/files/test_files/matroska_test_w1_1.zip/download';
    const zipFile = 'matroska_test_w1_1.zip';
    const platform = os.platform();

    const execPromise = (cmd: string) => promisify(exec)(cmd, {
      cwd: targetDir,
      shell: platform === 'win32' ? 'powershell' : undefined
    });

    await fsp.mkdir(targetDir, { recursive: true })

    console.log(`Working directory switched to: ${targetDir}`);

    if (platform === 'win32') {
      // Windows: 使用 PowerShell 的 Invoke-WebRequest 和 Expand-Archive
      console.log('Downloading on Windows...');
      await execPromise(`Invoke-WebRequest -Uri '${url}' -OutFile '${zipFile}' -UserAgent "wget"`);
      console.log('Extracting on Windows...');
      await execPromise(`Expand-Archive -Path '${zipFile}' -DestinationPath '.' -Force`);
      console.log('Cleaning up...');
      await execPromise(`rm '${zipFile}'`);
    } else {
      // *nix: 使用 curl 和 unzip
      console.log('Downloading on *nix...');
      await execPromise(`curl -L "${url}" -o "${zipFile}"`);
      console.log('Extracting on *nix...');
      await execPromise(`unzip -o "${zipFile}"`);
      console.log('Cleaning up...');
      await execPromise(`rm "${zipFile}"`);
    }

    console.log('Download and extraction completed successfully!');
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
}

// 执行
downloadAndExtract().catch((err) => {
  console.error(err)
  process.exit(1);
});