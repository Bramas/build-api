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

const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log('Example app listening on port '+port+'!');
});
