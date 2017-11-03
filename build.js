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

async function writeLocalFiles(tmpWD, files) {
	if(!files) return;
	for(var i in files) {
		await fs.writeFile(tmpWD+'/'+i, new Buffer(files[i], 'base64'));
	}
}
async function cleanLocalFiles(tmpWD, files) {
        if(!files) return;
        for(var i in files) {
                await fs.remove(tmpWD+'/'+i);
        }
}

/**
* @param timeout in second, for the execution of the program
*/
module.exports = async function({wd, timeout, target, make, tests}) {
  if(target.match(/[^\w\-\_]/)) {
    throw new Error('the target is not acceptable');
    return; 
  }
  make = make || ('make '+target);
  const result = {};
  try {
    result.compilation = await runDockerCommand(make, wd, 60);
    if(result.compilation.error) return result;

    if(tests.length > 0) {
      result.execution = [];
      for(var i in tests) {
	await writeLocalFiles(wd, tests[i].localFiles);
	let args = tests[i].args || '';
	let stdin = tests[i].stdin || null;
	let cmd = tests[i].cmd || ('./'+target+' '+args);
        result.execution.push(await runDockerCommand(cmd, wd, timeout, stdin));
	await cleanLocalFiles(tmpWD, tests[i].localFiles);
      }
    } else {
      result.execution = await runDockerCommand('./'+target, wd, timeout);
    }
  } catch(e) {
    console.error(e);
    result.error = "Erreur serveur";
  }
  return result;
}
