'use strict';

const moment = require('moment');
const { promisify } = require('util');
const Slack = require('slack');
const Logger = new require('cloudwatchlogger');

// No idea what this is: serverless-secrets crashes without it when run locally
if(process.env._HANDLER === undefined) { process.env._HANDLER = 'asdf.asdf'; }


const LogInstance = new Logger({
    region: 'us-west-2',
    batchSize: 10,
    batchDelay: 50,
    timeout: 500,
});

const makeLogger = promisify(LogInstance.setupLogger.bind(LogInstance));
const LOG_GROUP_NAME = 'PremisesVisitorLogs';
let loggerPromise;

const secretsPromise = require('serverless-secrets/client').load();

const slackbotPromise = new Promise((resolve, reject) => {
    secretsPromise.then(() => {
        return resolve(new Slack({ token: process.env.SLACK_TOKEN }));
    })
    .catch(err => {
        reject(err);
    });
});

const signin_after = (data, date) => {
    return slackbotPromise.then(slackbot => {
        const message = {
                            channel: process.env.SLACK_CHANNEL || '#general',
                            as_user: false,
                            username: 'BasilBot',
                            icon_url: 'https://rungie.com/basil.jpg',
                            text: '',
                            attachments: [
                                {
                                    fallback: `${data.firstName} ${data.lastName} from ${data.company} is here to see ${data.host.firstName} ${data.host.lastName} (${data.host.hostGroupName || 'No Group'}).`,
                                    color: 'good',
                                    title: `${data.firstName} ${data.lastName} from ${data.company} is here to see ${data.host.firstName} ${data.host.lastName} (${data.host.hostGroupName || 'No Group'}).`,
                                    text: 'Please come find me in reception.',
                                    title_link: 'https://dashboard.sine.co/#/',
                                    fields: [
                                        {
                                            title: 'Visitor',
                                            value: `${data.firstName} ${data.lastName}`,
                                            'short': true
                                        },
                                        {
                                            title: 'Company',
                                            value: data.company,
                                            'short': true
                                        },
                                        {
                                            title: 'Reason',
                                            value: data.formResponses.responses[0].value,
                                            'short': true
                                        },
                                    ],
                                    thumb_url: data.photoURL || undefined,
                                    ts:        moment(date).unix()
                                }
                            ]
                        };

        return slackbot.chat.postMessage(message);
    });
};

const signout_after = (data, date) => {
    return slackbotPromise.then(slackbot => {
        const message = {
                            channel: process.env.SLACK_CHANNEL || '#general',
                            as_user: false,
                            username: 'BasilBot',
                            icon_url: 'https://rungie.com/basil.jpg',
                            text: '',
                            attachments: [
                                {
                                    fallback: `${data.firstName} ${data.lastName} from ${data.company} has left the building.`,
                                    color: 'danger',
                                    title: `${data.firstName} ${data.lastName} from ${data.company} has left the building.`,
                                    text: `${data.firstName} had been visiting ${data.host.firstName} ${data.host.lastName} (${data.host.hostGroupName || 'No Group'}).`,
                                    title_link: 'https://dashboard.sine.co/#/',
                                    fields: [
                                        {
                                            title: 'Visitor',
                                            value: `${data.firstName} ${data.lastName}`,
                                            'short': true
                                        },
                                        {
                                            title: 'Company',
                                            value: data.company,
                                            'short': true
                                        },
                                        {
                                            title: 'Reason',
                                            value: data.formResponses.responses[0].value,
                                            'short': true
                                        },
                                    ],
                                    thumb_url: data.photoURL || undefined,
                                    ts:        moment(date).unix()
                                }
                            ]
                        };

        return slackbot.chat.postMessage(message);
    });
};

module.exports.injestSineEvents = async (event, context) => {
    if(loggerPromise === undefined) {
        loggerPromise = makeLogger(LOG_GROUP_NAME, `premises-visitor-log-${context.logStreamName}`);
    }

    return loggerPromise.then(logger => logger.log(event))
    .then(() => {
        if(!process.env.IS_LOCAL && (!event || !event.headers || event.headers['X-Sine-Auth'] != process.env.SINE_API_KEY)) {
            throw '[400] Missing or incorrect X-Sine-Auth header';
        }

        // Basic event validation
        if(!event || !event.payload || !event.payload.event || !event.payload.data) {
            throw "[500] There's something very wrong about the event format";
        }

        // Check if this is signin or signout
        switch(event.payload.event) {
            case 'signin_after':
                return signin_after(event.payload.data, event.payload.date);
            case 'signout_after':
                return signout_after(event.payload.data, event.payload.date);
            default:
                throw `[500] Unhandled event type: ${event.payload.event}`;
        }
    })
    .then(() => {
        return {
            code:         'SUCCESS',
            adminNotes:   'Notified via Slack',
            visitorNotes: 'Notification sent to Slack'
        };
    });
};
