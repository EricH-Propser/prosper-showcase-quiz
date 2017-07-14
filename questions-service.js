var fs = require('fs');

module.exports = {
    changeAnswersLeftDown: function () {
        return doChangeAnswersLeftDown();
    },
    setCurrentQuestion: function(questionNumber) {
        return doSetCurrentQuestion(questionNumber);
    },
    getQuestionForNumber : function(questionNumber) {
        return doGetQuestionForNumber(questionNumber);
    },
    stopQuiz : function() {
        return doStopQuiz();
    },
    pauseQuiz: function() {
        return doPauseQuiz();
    },
    getStatisticsForQuestion: function (questionNumber) {
        return doGetStatisticsForQuestion(questionNumber);
    },
    recordPlayerAnswer: function(name, answer) {
        return doRecordPlayerAnswer(name, answer);
    },
    getCurrentScores: function() {
        return doGetCurrentScores();
    },
    getAnswerForQuestion: function(questionNumber) {
        return doGetAnswerForQuestion(questionNumber);
    },
    generateTestData: function () {
        return doGenerateTestData();
    }
};

// Read the latest file
var questionsJson = fs.readFileSync('config/questions.2017-07-14.json');

if ( !questionsJson ) {
    throw Error("Did not load questions from json file");
}

var questions = JSON.parse(questionsJson);

console.log("Loaded a total of ["+questions.length+"] questions");

var allPlayerScores = {};
var answerStatistics = {};
var currentQuestionInUse = null; // Not in play at the start
var currentAnswersInUse = null;

function doStartNewGame() {
    allPlayerScores = {};
    answerStatistics = {};
    console.log("Started a new game");
    return true;
}

function doSetCurrentQuestion(questionNumber) {
    var question = getQuestion(questionNumber);
    if ( question ) {
        if ( questionNumber == 1 ) {
            doStartNewGame();
        }
        currentQuestionInUse = questionNumber;
        currentAnswersInUse = getTotalAnswersForQuestion(question);
        console.log("Changed the question in use to ["+currentQuestionInUse+"] - answers is use ["+currentAnswersInUse+"]");
        return true;
    }
    return false;
}

function doGetStatisticsForQuestion(questionNumber) {
    if ( ! getQuestion(questionNumber) ) {
        return { error: "Question number ["+questionNumber+"] is invalid"};
    }
    var statsQuestion = answerStatistics[questionNumber];
    if ( !statsQuestion ) {
        return { error: "There are no stats at this time"};
    }
    return {
        answerOne: ( statsQuestion[1] ? statsQuestion[1] : 0),
        answerTwo: (statsQuestion[2] ? statsQuestion[2] : 0),
        answerThree: (statsQuestion[3] ? statsQuestion[3] : 0),
        answerFour: (statsQuestion[4] ? statsQuestion[4] : 0)
    }
}

function doGenerateTestData() {
    if ( ! allPlayerScores ) {
        doSetCurrentQuestion(1);
    }
    var totalQuestions = questions.length;
    var i;
    for (i = 1; i < 100; i++) {
        var name = "test-name-"+i;
        var q;
        for ( q = 1; q <= totalQuestions; q++) {
            var answer = 1; // will be wrong for some questions
            if ( Math.floor(Math.random() * 2) === 1) {
                answer = doGetAnswerForQuestion(q).answer; // actually get the answer
            }
            // record a score
            doRecordPlayerAnswerWithGameState(name, answer, q, 4);
        }
    }
    console.log("Generated test data for ["+allPlayerScores.length+"] players");
    return true;
}

function doGetAnswerForQuestion(questionNumber) {
    var question = getQuestion(questionNumber);
    if ( question ) {
        return { answer: question.correctAnswer}
    }
}

function doChangeAnswersLeftDown() {
    var answersInUse = currentAnswersInUse;
    if ( answersInUse ) {
        var newScoreAmount = getScoreAmountForAnswersLeft(answersInUse);
        if ( answersInUse > 2 ) {
            var previousScoreAmount = newScoreAmount;
            --answersInUse;
            newScoreAmount = getScoreAmountForAnswersLeft(answersInUse);
            console.log("Changing scoreAmount from [" + previousScoreAmount + "] to [" + newScoreAmount + "]");
            // Now set the score amount
            currentAnswersInUse = answersInUse;
        }
        return newScoreAmount;
    }
    return null;
}

function doPauseQuiz() {
    console.log("Paused game at question ["+currentQuestionInUse+"]");
    currentQuestionInUse = null;
    return true;
}

function getScoreAmountForAnswersLeft(currentAnswersInUse) {
    if ( currentAnswersInUse && currentAnswersInUse > 0 ) {
        if ( currentAnswersInUse === 4 ) {
            return 5; // there's four questions in play
        } else if ( currentAnswersInUse === 3 ) {
            return 3; // there's three questions in play
        }
        return 1; // default
     }
     return 0; // hmmm...
}

function getTotalAnswersForQuestion(question) {
    if ( question.answerFour) {
        return 4;
    } else if ( question.answerThree) {
        return 3;
    } else if ( question.answerTwo) {
        return 2;
    }
    return 1; // only one answer? (shouldn't happen)
}

function doStopQuiz() {
    // Pause the game for now - later we may want to add stop game logic (extra to pause game logic)
    doPauseQuiz();
    return true;
}

function getQuestion(number) {
    var questionKey = number - 1;
    if ( questionKey >= 0 && questionKey < questions.length) {
        return questions[questionKey];
    }
    return null;
}

function doGetQuestionForNumber(questionNumber) {
    var foundQuestion = getQuestion(questionNumber);
    if ( foundQuestion ) {
        // Don't return the direct question object, create the response we want to send to the client
        return {
            question: foundQuestion.question,
            answerOne: foundQuestion.answerOne,
            answerTwo: foundQuestion.answerTwo,
            answerThree: foundQuestion.answerThree,
            answerFour: foundQuestion.answerFour,
            timeAllowed: foundQuestion.timeAllowed,
            totalQuestions: questions.length // Add the total questions in this quiz
        };
    }
    return null;
}

function doRecordPlayerAnswer(name, answer) {
    return doRecordPlayerAnswerWithGameState(name, answer, currentQuestionInUse, currentAnswersInUse);
}

function doRecordPlayerAnswerWithGameState(name, answerGiven, questionInPlay, answersInUse) {
    if ( !questionInPlay ) {
        return { error: "The quiz is either temporarily paused (between rounds) or it's already over" }
    }
    var scoreAmount = getScoreAmountForAnswersLeft(answersInUse);
    // console.log("Recording player "+name+" answer "+answer+" for question in play "+questionInPlay);
    var currentQuestion = getQuestion(questionInPlay);
    if ( !currentQuestion ) {
        console.log("Could not get the current question: "+questionInPlay);
        return { error: "Could not record score for question "+questionInPlay };
    }
    var correctAnswer = currentQuestion.correctAnswer;
    // console.log("Correct answer: "+correctAnswer+" - given answer "+answer);
    if ( !(name in allPlayerScores) ) {
        allPlayerScores[name] = {};
    }

    // We only allow one answer per question now
    if ( (questionInPlay in allPlayerScores[name]) ) {
        // console.log("Not allowing player to answer again since they already answered");
        return { error: "Looks like you already answered this question - I can't let you answer it again"};
    }

    if ( correctAnswer == answerGiven) {
        allPlayerScores[name][questionInPlay] = scoreAmount; // Give them the score
    } else {
        allPlayerScores[name][questionInPlay] = 0; // Give them nothing
    }

    updateStatistics(questionInPlay, answerGiven);

    return { currentQuestion: questionInPlay};
}

function updateStatistics(currentQuestion, answerGiven) {
    // See if we have already set statistics on this
    if ( !answerStatistics[currentQuestion]) {
        answerStatistics[currentQuestion] = {
            // correctAnswer: question.correctAnswer
        }
    }

    if ( ! answerStatistics[currentQuestion][answerGiven] ) {
        answerStatistics[currentQuestion][answerGiven] = 0; // set to zero
    }
    answerStatistics[currentQuestion][answerGiven]++; // now just increment it
}

function doGetCurrentScores() {
    var returnScores = [];
    for ( var playerName in allPlayerScores ) {
        var totalPlayerScore = 0;
        if ( allPlayerScores.hasOwnProperty(playerName) ) {
            for ( var questionNumber in allPlayerScores[playerName] ) {
                if ( allPlayerScores[playerName].hasOwnProperty(questionNumber)) {
                    totalPlayerScore += allPlayerScores[playerName][questionNumber];
                }
            }
        }
        returnScores.push({"name": playerName, "score": totalPlayerScore});
    }
    return returnScores;
}

