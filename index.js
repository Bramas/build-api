const express = require('express');
const app = express();
const build = require('./build');
const request = require('request');
const unzip = require('unzip-stream');
const fs = require('fs-extra');
const crypto = require('crypto');

var bodyParser = require('body-parser');
app.use(bodyParser.json());


process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at:', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

app.post('/build', async function (req, res) {
  console.log(req.body);
  if(req.body.url) {
  	const nonce = (await crypto.randomBytes(25)).toString('hex');
  	const tmppath=__dirname+'/tmp/'+nonce;
	request.get(req.body.url)
	.pipe(unzip.Extract({ path: tmppath }))
	.on('close', async function() {
		console.log('END');
		const result = await build(tmppath, 3);
  		await fs.remove(tmppath);
  		res.send(JSON.stringify(result, null, 2));
	}).on('error', function(e) {
		console.error(e);
		res.end('Erreur');
	});
  }


});

const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log('Example app listening on port '+port+'!');
});
