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

module.exports.injestSineEvents = (event, context, callback) =>
{
    slackbotPromise.then(slackbot => {
        if(!process.env.IS_LOCAL && (!event.headers || event.headers['X-Sine-Auth'] != process.env.SINE_API_KEY))
        {
            return Promise.reject('Missing or incorrect auth header');
        }

        return slackbot.chat.postMessage({
            channel: '#frontdesk-signin',
            text: `${event.payload.data.firstName} ${event.payload.data.lastName} from ${event.payload.data.company} is here to see ${event.payload.data.host.firstName} ${event.payload.data.host.lastName}:\`\`\`${JSON.stringify(event)}\`\`\``,
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
