'use strict';

const moment = require('moment');

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


const signin_after = (data, date) => {
    return slackbotPromise.then(slackbot => {

        const message = {
                            channel: '#frontdesk-signin',
                            text: '',
                            "attachments": [
                                {
                                    "fallback": `${data.firstName} ${data.lastName} from ${data.company} is here to see ${data.host.firstName} ${data.host.lastName}.`,
                                    "color": "good",
                                    "title": `${data.firstName} ${data.lastName} from ${data.company} is here to see ${data.host.firstName} ${data.host.lastName}.`,
                                    "text": 'Please come find me in reception.',
                                    "title_link": "https://dashboard.sine.co/#/",
                                    "fields": [
                                        {
                                            "title": "Visitor",
                                            "value": `${data.firstName} ${data.lastName}`,
                                            "short": true
                                        },
                                        {
                                            "title": "Company",
                                            "value": data.company,
                                            "short": true
                                        },
                                        {
                                            "title": "Reason",
                                            "value": data.formResponses.responses[0].value,
                                            "short": true
                                        },
                                    ],
                                    "thumb_url": data.photoURL || undefined,
                                    "ts": moment(date).unix()
                                }
                            ]
                        };

        return slackbot.chat.postMessage(message);
    });
}

const signout_after = (data, date) => {
    return slackbotPromise.then(slackbot => {
        const message = {
                            channel: '#frontdesk-signin',
                            text: '',
                            "attachments": [
                                {
                                    "fallback": `${data.firstName} ${data.lastName} from ${data.company} has left the building.`,
                                    "color": "danger",
                                    "title": `${data.firstName} ${data.lastName} from ${data.company} has left the building.`,
                                    "text": `${data.firstName} had been visiting ${data.host.firstName} ${data.host.lastName}.`,
                                    "title_link": "https://dashboard.sine.co/#/",
                                    "fields": [
                                        {
                                            "title": "Visitor",
                                            "value": `${data.firstName} ${data.lastName}`,
                                            "short": true
                                        },
                                        {
                                            "title": "Company",
                                            "value": data.company,
                                            "short": true
                                        },
                                        {
                                            "title": "Reason",
                                            "value": data.formResponses.responses[0].value,
                                            "short": true
                                        },
                                    ],
                                    "thumb_url": data.photoURL || undefined,
                                    "ts": moment(date).unix()
                                }
                            ]
                        };

        return slackbot.chat.postMessage(message);
    });
}

module.exports.injestSineEvents = (event, context, callback) => {
    Promise.resolve()
    .then(() => {
        if(!process.env.IS_LOCAL && (!event || !event.headers || event.headers['X-Sine-Auth'] != process.env.SINE_API_KEY)) {
            return Promise.reject('Missing or incorrect auth header');
        }

        // Basic event validation
        if(!event || !event.payload || !event.payload.event || !event.payload.data) {
            return Promise.reject("There's something very wrong about the event format");
        }

        // Check if this is signin or signout
        switch(event.payload.event) {
            case 'signin_after': return signin_after(event.payload.data, event.payload.date); break;
            case 'signout_after': return signout_after(event.payload.data, event.payload.date); break;
            default: return Promise.reject(`Unhandled event type: ${event.payload.event}`);
        }
    })
    .then(res => {
        callback(null, {
            "code": "SUCCESS",
            "adminNotes": "Notified via Slack",
            "visitorNotes": "Notification sent to Slack"
        });
    });
};
