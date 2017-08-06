const crypto = require('crypto');
const util = require('util');
const child_process = require('child_process');
const fs = require('fs-extra');

const RUN = 'docker run --name {2} --rm -v {1}:/var/src buildapi';

function exec(cmd) {
  return new Promise((acc, rej) => {
    child_process.exec(cmd, function(err, stdout, stderr) {
      if(err)
        acc({error: {code:err.code, killed:err.killed, signal:err.signal}, stdout, stderr});
      else
        acc({stdout, stderr});
    });
  });
}

async function runDockerCommand(cmd, workingDirectory, timeout) {

  const nonce = (await crypto.randomBytes(25)).toString('hex');
  const containerName = 'buildapi_'+nonce;
  const runCmd =  RUN.replace(/\{1\}/g, workingDirectory).replace(/\{2\}/g, containerName);

  var error = {};
  var timoutId = setTimeout(() => {
    exec('docker kill '+containerName);
    timoutId = null;
    error =  {
      timeout: timeout,
      message: "The process has been killed after "+timeout+" seconds"
    }
  }, timeout*1000);

  const result = await exec(runCmd+' '+cmd);
  if(timoutId) clearTimeout(timoutId);

  if(result.error)
    error = Object.assign(result.error, error);
  // include possible timeout error
  if(error != {}) {
    result.error = error;
  }
  // remove empty stderr
  if(!result.stderr) {
    delete result.stderr;
  }
  // remove empty error
  if(!result.error) {
    delete result.error;
  }
  result.command = cmd;
  return result;
}

/**
* @param timeout in second, for the execution of the program
*/
module.exports = async function(tmpWD, timeout) {
  const result = {};
  result.compilation = await runDockerCommand('make hello', tmpWD, 60);
  result.execution = await runDockerCommand('./hello', tmpWD, timeout);
  return result;
}
