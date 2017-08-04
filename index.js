const express = require('express');
const app = express();
const build = require('./build');

var bodyParser = require('body-parser');
app.use(bodyParser.json());

app.post('/build', async function (req, res) {
  console.log(req.body);
  const result = await build(3);
  res.send(JSON.stringify(result, null, 2));
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
