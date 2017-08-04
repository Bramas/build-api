const crypto = require('crypto');
const util = require('util');
const child_process = require('child_process');
const fs = require('fs-extra');

const RUN = 'docker run --name {2} --rm -v $PWD/tmp/{1}:/var/src buildapi';

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
/**
* @param timeout in second, for the execution of the program
*/
module.exports = async function(timeout) {
  const nonce = (await crypto.randomBytes(25)).toString('hex');
  const tmpWD = __dirname+'/tmp/'+nonce;
  const containerName = 'buildapi_'+nonce;
  await fs.copy(__dirname+'/template', tmpWD);

  const runCmd =  RUN.replace(/\{1\}/g, nonce).replace(/\{2\}/g, containerName);
  console.log(runCmd+' make hello');
  let result = {}
  var timoutId = setTimeout(() => {
    exec('docker kill '+containerName);
    console.log('KIIILL COMPILATION ','docker kill '+containerName);
    timoutId = null;
    result.compilation = {
      error: {
        timeout: 60,
        message: "The compilation of your program has been killed after "+60+" seconds"
      }
    }
  }, 60000);
  result.compilation = Object.assign(await exec(runCmd+' make hello'), result.compilation || {});
  if(timoutId) clearTimeout(timoutId);
  console.log('make:', result.compilation);
  console.log(runCmd+' "./hello"');
  timoutId = setTimeout(() => {
    exec('docker kill '+containerName);
    console.log('KIIILL EXECUTION','docker kill '+containerName);
    result.execution = {
      error: {
        timeout,
        message: "Your program has been killed after "+timeout+" seconds"
      }
    }
    timoutId = null;
  }, timeout*1000);
  result.execution = Object.assign(await exec(runCmd+' "./hello"'), result.execution || {});
  if(timoutId) clearTimeout(timoutId);
  console.log('exec:', result.execution);
  await fs.remove(tmpWD);
  return result;
}
