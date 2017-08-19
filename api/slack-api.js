
function SlackApi(config, questionService){
    this.config = config;
    this.questionService = questionService;
    this.slackUserInfo = {};

    if (!config.APPLICATION_SLACK_OAUTH_TOKEN) {
        throw new Error("No application oauth token defined");
    }

    if (!config.QUIZ_SLACK_TOKEN) {
        throw new Error("No application quiz key defined");
    }

    console.log("Will use slack oauth token: "+config.APPLICATION_SLACK_OAUTH_TOKEN);
    console.log("Will use slack interactive token key: "+config.QUIZ_SLACK_TOKEN);
}

SlackApi.prototype.slackInteractive = function (request, response) {
    var token = request.body.token;

    var authResponse = checkSlackRequestAuthentication(token, response);
    if ( authResponse ) {
        return response.status(200);
    }

    var textEntered = request.body.text;
    if ( !textEntered ) {
        // For slack we respond with 200
        return response.status(200).json( { text: "You didn't provide any command text. e.g. '/quiz play'"} );
    }

    textEntered = textEntered.trim();

    var name = request.body.user_name;
    if ( !name ) {
        return response.status(422).json( { text: "No username provided"} );
    }
    var userId = request.body.user_id;
    if ( !userId) {
        return response.status(422).json( { text: "No userId provided"} );
    }
    var slashCommandChannelId = request.body.channel_id;
    // check the text entered
    if ( textEntered === 'play') {
        console.log("Player ["+name+"] with userId ["+userId+"] has opted to join the quiz");
        addSlackUserInfo(name, true, userId, slashCommandChannelId);
        return response.status(200).json( { text: "Hurrah! You've registered. Note, all further interaction will be done in the slackbot channel, so go there!"} );
    }  
    
    if ( textEntered === 'stop') {  
        console.log("Player ["+name+"] has opted to stop playing in the the quiz");
        removeSlackUserFromQuiz(name);
        return response.status(200).json( { text: "You got it! I won't annoy you anymore with the quiz"} );
    }

    addSlackNonInteractiveUserIfNotFound(name, userId, slashCommandChannelId);
    // We'll just treat this like they are answering normally (i.e. /quiz 2)
    return recordSlackAnswer(name, textEntered, response);
    
};


/*
var questionService = require('./questions-service');
var request = require('request');
*/

SlackApi.prototype.sendNewQuestionToSlackUsers = function (questionInformation) {
    console.log("Sending new question to slack users");
    var answersRawText = "1. "+questionInformation.answerOne+"\n2. "+questionInformation.answerTwo;
    var availableActions = [
        {
            name: "answer",
            text: "Answer 1",
            type: "button",
            value: "1"
        },
        {
            name: "answer",
            text: "Answer 2",
            type: "button",
            value: "2"
    }];
    if ( questionInformation.answerThree) {
        answersRawText += "\n3. "+questionInformation.answerThree;
        availableActions.push({
            name: "answer",
            text: "Answer 3",
            type: "button",
            value: "3"
        });
    }
    if ( questionInformation.answerFour) {
        answersRawText += "\n4. "+questionInformation.answerFour;
        availableActions.push({
            name: "answer",
            text: "Answer 4",
            type: "button",
            value: "4"
        });
    }

    // for each player that is still active and playing - send the question
    var slackQuestion = questionInformation.question;
    var slackAttachments = [ {
            text: answersRawText,
            fallback: "Something went wrong",
            callback_id: "slack",
            color: "#0d1b52",
            attachment_type: "default",
            actions: availableActions
        }];

    for ( var slackName in this.slackUserInfo ) {
        if (this.slackUserInfo.hasOwnProperty(slackName)) {
            // Get the url to post to
            var personalChannelId = this.slackUserInfo[slackName].personalChannelId;
            var wantsToPlayInteractively = this.slackUserInfo[slackName].wantsToPlayInteractively;
            if ( !personalChannelId || !wantsToPlayInteractively ) {
                continue; // don't annoy this person
            }

            sendMessageToSlack(this.slackUserInfo[slackName].slackPersonalChannelName, slackQuestion, slackAttachments)
        }
    }
};

function checkSlackRequestAuthentication(token, response) {
    if ( token && token == this.config.QUIZ_SLACK_TOKEN ) {
        return null; // all good
    }

    console.log("Provided slack message token is not correct: ["+token+"] != ["+QUIZ_SLACK_TOKEN+"]");
    return response.status(403).json({});
}

function recordSlackAnswer(name, answer, response) {

    if ( !name ) {
        return response.status(422).json({ "error": "No name provided"});
    }
 
    if ( !answer || !isNumber(answer)) {
        // 200 for slack
        return response.status(200).json({"text": "Looks like you provided an invalid answer number, try again with a valid answer"});
    }

    var scoreResult = questionService.recordPlayerAnswer(name, answer.trim());
    if ( scoreResult && !scoreResult.error ) {
        return response.status(200).json({"text": "Cool, got your answer to question "+scoreResult.currentQuestion});
    } 
    if ( scoreResult.error) {
        // needs to be a 200 for slack response
        return response.status(200).json({"text": scoreResult.error});
    } 
        
    return response.status(500).json({"text": "Could not save answer"});    
}

function addSlackNonInteractiveUserIfNotFound(name, userId, slashCommandChannelId) {
    if ( name in this.slackUserInfo ) {
        return;
    }
    
    // we don't have this user - so let's add him
    addSlackUserInfo(name, false, userId, slashCommandChannelId); // set interactivity to false
    
}

function addSlackUserInfo(name, wantsToPlayInteractively, userId, slashCommandChannelId) {
    if ( !(name in this.slackUserInfo) ) {
        this.slackUserInfo[name] = {};
    }
    var playerInfo = {};
    playerInfo.wantsToPlayInteractively = wantsToPlayInteractively;
    playerInfo.userId = userId;
    playerInfo.slashCommandChannelId = slashCommandChannelId;
    playerInfo.slackPersonalChannelName = "@"+name;
    this.slackUserInfo[name] = playerInfo;

    setProfileInfoForUser(playerInfo);
}

function removeSlackUserFromQuiz(name) {
    if (!this.slackUserInfo.hasOwnProperty(name)) {
        return;
    }

    var userInfo = this.slackUserInfo[name];
    userInfo.personalChannelId = null;
    userInfo.slashCommandChannelId = null;
    userInfo.wantsToPlayInteractively = false;
}

function unregisterAllSlackUsersFromQuiz() {
    console.log("Un registering all slack user information");
    for ( var slackName in this.slackUserInfo ) {
        if (this.slackUserInfo.hasOwnProperty(slackName)) {
            var userInfo = this.slackUserInfo[slackName];
            userInfo.wantsToPlayInteractively = false;
        }
    }
}


function setPersonalChannelIdForUser(playerInfo) {
    console.log("Getting personal IM channel for player user id ["+playerInfo.userId+"]");
    // We need to open an IM to the user and get the channel info to participate in the quiz
    request.post({
        url:'https://slack.com/api/im.open',
        form: {
            token: APPLICATION_SLACK_OAUTH_TOKEN,
            return_im: false,
            user: playerInfo.userId
        }},
        function( error, httpResponse, body) {
            if (error) {
                console.log("There was an error trying to get the personal channel id for user Id ["+playerInfo.userId+"]: "+JSON.stringify(error));
                return;
            } 
            if ( !body ) {
                return;
            }

            var parsedBody = JSON.parse(body);
            if ( parsedBody && parsedBody.channel && parsedBody.channel.id) {
                playerInfo.personalChannelId = parsedBody.channel.id;
                // var personalChannelSameAsSlashChannel = playerInfo.slashCommandChannelId && playerInfo.slashCommandChannelId === playerInfo.personalChannelId;
                // if ( !personalChannelSameAsSlashChannel && playerInfo.personalChannelId && playerInfo.wantsToPlayInteractively ) {
                    // Only send a message to the person if the slash command channel is different to the personal channel
                if ( playerInfo.slackPersonalChannelName && playerInfo.wantsToPlayInteractively ) {
                    var name = playerInfo.firstName ? playerInfo.firstName : playerInfo.slackPersonalChannelName;
                    var message = "Oh hai "+name+"! I'll post the quiz questions for you here in this channel.";
                    sendSimpleSlackMessageToChannel(playerInfo.slackPersonalChannelName, message);
                }
            }
        }
    );
}

function setProfileInfoForUser(playerInfo) {
    console.log("Getting profile info for player user id ["+playerInfo.userId+"]");

    request.post({
        url:'https://slack.com/api/users.profile.get',
        form: {
            token: APPLICATION_SLACK_OAUTH_TOKEN,
            include_labels: false,
            user: playerInfo.userId
        }},
    function( error, httpResponse, body) {
        if (error) {
            console.log("There was an error trying to get the profile info for user Id ["+playerInfo.userId+"]: "+JSON.stringify(error));
        } else {
            if ( body ) {
                var parsedBody = JSON.parse(body);
                if ( parsedBody && parsedBody.profile ) {
                    var firstName = parsedBody.profile.first_name;
                    var lastName = parsedBody.profile.last_name;
                    if (firstName && lastName) {
                        playerInfo.firstName = firstName;
                        playerInfo.lastName = lastName;
                        console.log("Got profile information for ["+playerInfo.userId+"] - ["+playerInfo.firstName+"] - ["+playerInfo.lastName+"]")
                    }
                } else {
                    // Somethings this happens - but it shouldn't since slack gives the profile info for each user
                    // It mainly happens during quizzes, so logging a message this time to investigate after the fact
                    console.log("Could not get profile information for ["+playerInfo.userId+"] - ["+playerInfo.name+"]")
                }
                setPersonalChannelIdForUser(playerInfo);
            }
        }
        setPersonalChannelIdForUser(playerInfo);
    });
}

SlackApi.prototype.slackInteractiveAnswer = function (request, response) {
    /**
     * Slack gives the request body as a single x-www-url-encoded key called "payload" that contains
     * JSON that's also encoded - so it's a bit fucked
     * So here I just rely on JSON library to parse and handle the encoding (escaping) madness
     */
    var stringifyBody = JSON.stringify(request.body);
    var parsedJson = JSON.parse(stringifyBody);
    var data = JSON.parse(parsedJson.payload);

    var token = data.token;
    var authResponse = checkSlackRequestAuthentication(token, response);
    if ( authResponse ) {
        return;
    }

    var name = data.user.name;
    var answerNumber = data.actions[0].value;
    return recordSlackAnswer(name, answerNumber, response);

};

SlackApi.prototype.updateCurrentScoresWithUserInfo = function (currentScores) {
    console.log("Updating current scores with more user info");
    // current scores is an array
    for ( var score in currentScores ) {
        if ( currentScores.hasOwnProperty(score)) {
            var slackName = currentScores[score].name;
            // try and find this name in the player info we have
            currentScores[score].name = this.getSlackFullName(slackName);
        }
    }
    return currentScores; // return the (possibly) updated data
};

SlackApi.prototype.getSlackFullName = function (username) {
    // try and find this name in the player info we have
    if (this.slackUserInfo.hasOwnProperty(username)) {
        var playerInfo = this.slackUserInfo[username];
        if (playerInfo.firstName && playerInfo.lastName) {
            return playerInfo.firstName + " " + playerInfo.lastName;
        }
    }
    return username; // default to returning the given name
};

SlackApi.prototype.quizHasStarted = function () {
    var message = "The quiz has now started! Get ready for some tasty questions! :-)";
    sendSimpleSlackMessageToAllUsers(message, false);
};

SlackApi.prototype.quizHasStopped = function() {
    console.log("The quiz is over - so sending a goodbye to everyone that participated");
    var message = "The quiz is now over! Thanks for playing - I hope you had fun! (I've also un-registered you, so I won't annoy you anymore)";
    sendSimpleSlackMessageToAllUsers(message, true);
    unregisterAllSlackUsersFromQuiz();
};

function sendSimpleSlackMessageToAllUsers(message, shouldRemoveUsersAfterSending) {
    if ( !this.slackUserInfo ) {
        return; // nothing to do
    }
    // don't send any more updates to people
    for ( var slackName in this.slackUserInfo ) {
        if (this.slackUserInfo.hasOwnProperty(slackName)) {
            // Get the url to post to
            var personalChannelId = this.slackUserInfo[slackName].personalChannelId;
            var wantsToPlayInteractively = this.slackUserInfo[slackName].wantsToPlayInteractively;
            if ( !personalChannelId || !wantsToPlayInteractively ) {
                continue; // they do not want to be bothered, so skip this person
            }

            sendSimpleSlackMessageToChannel(this.slackUserInfo[slackName].slackPersonalChannelName, message);

            if ( shouldRemoveUsersAfterSending ) {
                // This is the last message we should send to this person
                this.slackUserInfo[slackName].wantsToPlayInteractively = false;
                this.slackUserInfo[slackName].personalChannelId = null;
            }
        }
    }
}

function sendSimpleSlackMessageToChannel(channelId, message) {
    sendMessageToSlack(channelId, message, null);
}

function sendMessageToSlack(channelId, message, attachments) {

    var postForm = {
        token: APPLICATION_SLACK_OAUTH_TOKEN,
        channel: channelId,
        text: message,
        as_user: false
    };

    if ( attachments ) {
        postForm.attachments = JSON.stringify(attachments);
    }

    request.post({
            url:'https://slack.com/api/chat.postMessage',
            form: postForm
        },
        function( error, httpResponse, body) {
            if (error) {
                console.log("There was an error sending the message ["+message+"] to channel id ["+channelId+"] postMessage "+JSON.stringify(error));
            }
        }
    );
}


function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}


module.exports = SlackApi;