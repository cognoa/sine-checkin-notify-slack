'use strict';

// No idea what this is: serverless-secrets crashes without it when run locally
if(process.env._HANDLER === undefined) { process.env._HANDLER = 'asdf.asdf'; }

const secretsPromise = require('serverless-secrets/client').load();

const Slack = require('slack');
var slackbotPromise = new Promise((resolve, reject) => {
    secretsPromise.then(() => {
        resolve(new Slack({token: process.env.SLACK_TOKEN}));
    })
    .catch(err => {
        reject(err);
    });
});

module.exports.injestSigninBefore = (event, context, callback) =>
{
    slackbotPromise.then(slackbot => {
        console.log(event, context);
        return slackbot.chat.postMessage({
            channel: '#frontdesk-signin',
            text: 'test message',
        });
    })
    .then(res => {
        callback(null, {
            "code": "SUCCESS",
            "adminNotes": "Notified via Slack",
            "visitorNotes": "Notification sent to Slack"
        });
    });
};
