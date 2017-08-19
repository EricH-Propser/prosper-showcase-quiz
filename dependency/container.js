module.exports = function(){
    var container = {};

    container.config = require("../config");

    container.quizmasterCheck = require("../middleware/quizmaster-check");
    container.quizmasterRequired = require("../middleware/quizmaster-required");

    var questionValidatorDef = require("../services/question-validator");
    container.questionValidator = new questionValidatorDef();

    var questionsServiceDef = require("../services/questions-service");
    container.questionsService = new questionsServiceDef(container.questionValidator, 'config/questions.2017-08-11.json');

    var questionsApiDef = require('../api/questions-api');
    container.questionsApi = new questionsApiDef(container.questionsService);

    var slackApiDef = require('../api/slack-api');
    container.slackApi = new slackApiDef(container.config, container.questionsService);

    var testApiDef = require('../api/test-api');
    container.testApi = new testApiDef(container.questionsService);

    var quizMasterDef = require('../api/quiz-master');
    container.quizMaster = new quizMasterDef(container.config, container.questionsApi, container.slackApi);

    return container;
};