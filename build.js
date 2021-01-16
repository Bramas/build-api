const crypto = require('crypto');
const util = require('util');
const child_process = require('child_process');
const fs = require('fs-extra');

const memoryLimit = process.env.MEMORY_LIMIT ? '--memory='+process.env.MEMORY_LIMIT:'';
const RUN = 'docker run --name {2} --rm -v {1}:/var/src '+memoryLimit+' --memory-swap=-1 -i buildapi';

function runArgs(name, folder, args) {
        let r = ['run', '--name', name, '--rm', '-v', folder+':/var/src', '-i', 'buildapi', 'bash', 'run-in.sh'];
        for(i in args)
                r.push(args[i]);
        return r;
}



function safeWrite(data, writable, callback, offset) {
  offset = offset || 0;
  const chunkSize = 512;
  if(offset === 0) {
    writable.__closed =false;
    writable.once('close', () => { writable.__closed = true; });
    writable.once('finish', () => { writable.__closed = true; });
    writable.once('error', (e) => { console.log('onError', e); writable.__closed = true; });
  }

  if(data.length <= offset || writable.__closed) {
    callback();
    return;
  }

  let cb = () => {
    safeWrite(data, writable, callback, offset + chunkSize);
  }
  if(!writable.write(data.slice(offset, offset + chunkSize))) {
    writable.once('drain', cb);
  } else {
    process.nextTick(cb);
  }
}

function exec(args, options) {
  let {timeout, stdin} = options || {}
  timeout = timeout || 0;
  timeout *= 1000;

  return new Promise((acc, rej) => {
    const p = child_process.execFile('docker', args, {timeout}, function(err, stdout, stderr) {
      if(err)
        acc({error: {code:err.code, killed:err.killed, signal:err.signal}, stdout, stderr});
      else
        acc({stdout, stderr});
    });
    if(stdin)
      safeWrite(stdin, p.stdin, () => p.stdin.end());
    else
      p.stdin.end();
  });
}

function cmdLineToArray(line) {
        let args = [];
        let bufferLine = null;
        let waitForQuotes = false;
        for(let i = 0; i < line.length; i++){
                if(line[i] === ' ' && bufferLine === null) {
                        continue;
                }
                if(line[i] === ' ' && !waitForQuotes) {
                        args.push(bufferLine);
                        bufferLine = null;
                        continue;
                }
                if(line[i] === '"') {
                        if(waitForQuotes){
                                args.push(bufferLine);
                                bufferLine = null;
                                waitForQuotes = false;                                
				continue;
                        }
                        waitForQuotes = true;
                        continue;
                }
                if(bufferLine===null) {
                        bufferLine = '';
                }
                bufferLine += line[i];

        }
        if(bufferLine) {
                args.push(bufferLine);
        }
        return args;
}

async function runDockerCommand(cmd, workingDirectory, timeout, stdin) {

  const nonce = (await crypto.randomBytes(25)).toString('hex');
  const containerName = 'buildapi_'+nonce;
  const runCmd =  RUN.replace(/\{1\}/g, workingDirectory).replace(/\{2\}/g, containerName);

  var timeouterror = null;
  var timoutId = setTimeout(() => {
    exec(['kill',containerName]);
    timoutId = null;
    timeouterror =  {
      timeout: timeout,
      message: "The process has been killed after "+timeout+" seconds"
    }
  }, timeout*1000);
  /*let stdinFile = '/dev/null';
  if(stdin) {
    stdinFile = workingDirectory+'/stdin';
    await fs.writeFile(stdinFile, stdin);
  }*/
  const args = runArgs(containerName, workingDirectory, cmdLineToArray(cmd));//cmd.split(' ').filter(e => e.length != 0))
  console.log('runDockerCommand', cmd);
  let startingTime = process.hrtime();
  const {stdout, stderr, error} = await exec(args, {timeout, stdin});
  if(timoutId) clearTimeout(timoutId);
  const result = {
    command: cmd,
    stdout
  };
  let duration = process.hrtime(startingTime);
  result.duration = duration[0] + Math.round(duration[1]/1000000);

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

    console.log(await fs.copy('./run.sh', wd+'/run-in.sh'));

    result.compilation = await runDockerCommand(make, wd, 60);
    if(result.compilation.error) return result;

    if(tests.length > 0) {
      result.execution = [];
      for(var i in tests) {
	await writeLocalFiles(wd, tests[i].localFiles);
	let args = tests[i].args || '';
	let stdin = tests[i].stdin || null;
	if(!stdin && tests[i].stdinFile) {
		stdin = await fs.readFile(wd+'/'+tests[i].stdinFile);
	} 
	let test_timeout = tests[i].timeout || 3;
	let cmd = tests[i].cmd || ('./'+target+' '+args);
        result.execution.push(await runDockerCommand(cmd, wd, test_timeout, stdin));
	await cleanLocalFiles(wd, tests[i].localFiles);
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
