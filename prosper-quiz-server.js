'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var app = express();

var container = require("./dependency/container")();

app.use(bodyParser.urlencoded( { extended: false}));
app.use(bodyParser.json());
app.use('/prosperquiz', express.static(path.join(__dirname, 'static'))); // get references to the html's

app.use(container.quizmasterCheck);

require("./routes/question-routes")(app, container.questionsApi);
require("./routes/quizMaster-routes")(app, container.quizMaster, container.quizmasterRequired);
require("./routes/slack-routes")(app, container.slackApi);
require("./routes/test-routes")(app, container.testApi);
require("./routes/static-routes")(app);


var portNumber = 34343;
app.listen(portNumber);
console.log('Server started and listening on port ['+portNumber+']...');

module.exports = app;

