const express = require('express');
const app = express();
const build = require('./build');
const request = require('request');
const unzip = require('unzip-stream');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const stream = require('stream');
const queue = require('express-queue');
var bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '50mb'}));
app.use (function (error, req, res, next){
    //Catch json error
    console.log("json error", error, error.type);
    res.status(500);
    res.end('{"error": "JSON error"}');
});


app.use(queue({ activeLimit: 1 }));

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at:', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

app.post('/build', async function (req, res) {
  if(req.body.url || req.body.data) {
	const main = req.body.main || 'main.c';
	const target = req.body.target || main.replace('.c', '');
  	const nonce = (await crypto.randomBytes(25)).toString('hex');
  	const tmppath=__dirname+'/tmp/'+nonce;
	await fs.mkdir(tmppath);
	var dataStream;
	if(req.body.url) {
	  request.get(req.body.url);
	}
	else {
	  dataStream = new stream.PassThrough();
	  dataStream.end(new Buffer(req.body.data, 'base64'));
	}
	dataStream.pipe(unzip.Extract({ path: tmppath }))
	.on('close', async function() {
		console.log('END');
		try {
			if(req.body.testMakefile) {
				await fs.writeFile(path.join(tmppath,'Makefile'), new Buffer(req.body.testMakefile, 'base64'));
			}
			if(req.body.files) {
			  for(let name in req.body.files) {
                            await fs.writeFile(path.join(tmppath,name), new Buffer(req.body.files[name], 'base64'));
			  }
                        }
			const result = await build(tmppath, 3, target, req.body.tests);
  			await fs.remove(tmppath);
  			res.send(JSON.stringify(result, null, 2));
		} catch(e) {
			res.send('{"error":"serveur error"}');
			console.error(e);
		}
	}).on('error', function(e) {
		console.error(e);
		res.end('Erreur');
	});
  }
  else {
	res.end('ERROR');
  }

});

const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log('Example app listening on port '+port+'!');
});
