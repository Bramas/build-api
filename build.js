const crypto = require('crypto');
const util = require('util');
const child_process = require('child_process');
const fs = require('fs-extra');

const RUN = 'docker run --name {2} --rm -v {1}:/var/src -i buildapi';

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

async function runDockerCommand(cmd, workingDirectory, timeout, stdin) {

  const nonce = (await crypto.randomBytes(25)).toString('hex');
  const containerName = 'buildapi_'+nonce;
  const runCmd =  RUN.replace(/\{1\}/g, workingDirectory).replace(/\{2\}/g, containerName);

  var timeouterror = null;
  var timoutId = setTimeout(() => {
    exec('docker kill '+containerName);
    timoutId = null;
    timeouterror =  {
      timeout: timeout,
      message: "The process has been killed after "+timeout+" seconds"
    }
  }, timeout*1000);
  let stdinFile = '/dev/null';
  if(stdin) {
    stdinFile = workingDirectory+'/stdin';
    await fs.writeFile(stdinFile, stdin);
  }
  const {stdout, stderr, error} = await exec(runCmd+' '+cmd+' < '+stdinFile);
  if(timoutId) clearTimeout(timoutId);
  const result = {
    command: cmd,
    stdout
  };

  if(error || timeouterror)
    result.error = Object.assign(error || {}, timeouterror || {});

  if(stderr != "") {
    result.stderr = stderr;
  }
  return result;
}

/**
* @param timeout in second, for the execution of the program
*/
module.exports = async function(tmpWD, timeout, target, tests) {
  if(target.match(/\W/)) {
    throw new Error('the target is not acceptable');
    return; 
  }
  const result = {};
  try {
    result.compilation = await runDockerCommand('make '+target, tmpWD, 60);
    if(tests.length > 0) {
      result.execution = [];
      for(var i in tests) {
        result.execution.push(await runDockerCommand('./'+target+' '+tests[i].args, tmpWD, timeout, tests[i].stdin));
      }
    } else {
      result.execution = await runDockerCommand('./'+target, tmpWD, timeout);
    }
  } catch(e) {
    console.error(e);
    result.error = "Erreur serveur";
  }
  return result;
}
