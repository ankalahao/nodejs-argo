const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const os = require('os');

const isWin32 = os.platform() === 'win32';

/**
 * Run a shell command and log that the named process is running.
 * Consolidates the repeated pattern:
 *   await exec(cmd);
 *   console.log(name + ' is running');
 *   await delay(ms);
 */
async function runBinary(command, name, delayMs = 2000) {
  await exec(command);
  console.log(`${name} is running`);
  await delay(delayMs);
}

/**
 * Execute a platform-specific command (Windows vs Unix).
 * Consolidates repeated platform branching for process/file operations.
 */
async function platformExec(winCmd, unixCmd, callback) {
  const cmd = isWin32 ? winCmd : unixCmd;
  return exec(cmd, callback);
}

/**
 * Kill a process by name, cross-platform.
 * Consolidates duplicated kill logic in cleanFiles and extractDomains.
 */
async function killProcess(processName) {
  if (isWin32) {
    await exec(`taskkill /f /im ${processName}.exe > nul 2>&1`).catch(() => {});
  } else {
    const firstChar = processName.charAt(0);
    const rest = processName.substring(1);
    await exec(`pkill -f "[${firstChar}]${rest}" > /dev/null 2>&1`).catch(() => {});
  }
}

/**
 * Promise-based delay.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { exec, runBinary, platformExec, killProcess, delay, isWin32 };
