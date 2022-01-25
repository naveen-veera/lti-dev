//@ts-check
const configKey = require('../config/keys.json');
const wileyAssignments = require('../config/assignments.json');
const router = require('express').Router();
const path = require('path');

// Requiring Ltijs
const lti = require('ltijs').Provider;

// status route
router.get('/status', async(req, res) => {
    return res.status(200).send("working");
});
    
// Grading route
router.post('/grade', async (req, res) => {
    const idtoken = res.locals.token; // IdToken
    const score = req.body.scoreGiven;
    console.log('idtoken--->', idtoken);
    const resouce_id = idtoken.platformContext.context.id + '_' + idtoken.platformContext.resource.id;
    const logprefix =
        'grade---' +
        idtoken.userInfo.email +
        '---' +
        idtoken.platformContext.context.title +
        '---' +
        idtoken.platformContext.custom.assignment_id +
        '---' +
        resouce_id +
        '---' +
        score +
        '--->>';
    try {
        // User numeric score sent in the body
        // Creating Grade object
        const gradeObj = {
            userId: idtoken.user,
            scoreGiven: score,
            scoreMaximum: 100,
            activityProgress: 'Completed',
            gradingProgress: 'FullyGraded',
        };

        // Selecting linetItem ID
        let lineItemId = idtoken.platformContext.endpoint.lineitem;
        if (!lineItemId) {
            const response = await lti.Grade.getLineItems(idtoken, { resourceLinkId: true });
            console.log(logprefix + 'getlineitems-->', response);
            const lineItems = response.lineItems;
            if (lineItems.length === 0) {
                // Creating line item if there is none
                console.log(logprefix + ' Creating new line item');
                const newLineItem = {
                    scoreMaximum: 100,
                    label: 'Grade',
                    tag: 'grade',
                    resourceLinkId: idtoken.platformContext.resource.id,
                };
                const lineItem = await lti.Grade.createLineItem(idtoken, newLineItem);
                lineItemId = lineItem.id;
            } else lineItemId = lineItems[0].id;
        }

        let success = false;
        let retry = 0;
        let responseGrade = {};
        let errmessage = ''
        // Sending Grade
        while(!success && retry < 2) {
            retry++;
            try {
                console.log("we came into try -- " + retry);
console.log(gradeObj, 'gradObj');
console.log(idtoken, 'idtoke');
console.log(lineItemId, 'lineif');
                responseGrade = await lti.Grade.submitScore(idtoken, lineItemId, gradeObj);
console.log('resp',responseGrade);
                if (responseGrade && responseGrade.userId) {
                    success = true;
                }
            } catch(err) {
                errmessage = err.message;
console.log('errorMsg', errmessage);
            }
        }
        if (responseGrade && responseGrade.userId) {
            console.log(logprefix + '##submitscore------>', responseGrade);
            return res.send(responseGrade);
        } else {
            console.log(logprefix + 'submitscoreerror---> inside ---> ', errmessage);
            return res.status(500).send({ err: errmessage });
        }
    } catch (err) {
        console.log(logprefix + 'submitscoreerror---> outside ---> ', err.message);
        return res.status(500).send({ err: err.message });
    }
});

// Names and Roles route
router.get('/members', async (req, res) => {
    try {
        const result = await lti.NamesAndRoles.getMembers(res.locals.token);
        if (result) return res.send(result.members);
        return res.sendStatus(500);
    } catch (err) {
        console.log(err);
        return res.status(500).send(err.message);
    }
});

// Deep linking route
router.post('/deeplink', async (req, res) => {
    try {
        const resource = req.body;

        const items = {
            type: 'ltiResourceLink',
            title: 'Ltijs Demo',
            custom: {
                name: resource.name,
                value: resource.value,
            },
        };

        const form = await lti.DeepLinking.createDeepLinkingForm(res.locals.token, items, {
            message: 'Successfully Registered',
        });
        if (form) return res.send(form);
        return res.sendStatus(500);
    } catch (err) {
        console.log(err.message);
        return res.status(500).send(err.message);
    }
});

// Return available deep linking resources
router.get('/resources', async (req, res) => {
    const resources = [
        {
            name: 'Resource1',
            value: 'value1',
        },
        {
            name: 'Resource2',
            value: 'value2',
        },
        {
            name: 'Resource3',
            value: 'value3',
        },
    ];
    return res.send(resources);
});

// Get user and context information
router.get('/info', async (req, res) => {
    const token = res.locals.token;
    const context = res.locals.context;

    const info = {};
    if (token.userInfo) {
        if (token.userInfo.name) info.name = token.userInfo.name;
        if (token.userInfo.email) info.email = token.userInfo.email;
    }

    if (token.roles) info.roles = token.roles;
    if (context.context) info.context = context.context;

    return res.send(info);
});

router.get('/redirect', async (req, res) => {
    const token = res.locals.token;
    const context = res.locals.context;
    const info = {};

    if (token.userInfo && token.clientId) {
        const platform = configKey['platformSchoolMapping'][token.clientId];
        if (token.userInfo.name) info.name = token.userInfo.name;
        if (token.userInfo.email) {
            info.email = token.userInfo.email;
            let resp = await sendRequest(info.email, platform);
            console.log('-------->resp.locals', res.locals);
            resp = JSON.parse(resp);
            let redirectURL = '';
console.log(platform, 'dired');
            if (platform.direct_mapping === true) {
                redirectURL =
                    'https://' +
                    platform.school_url +
                    '/loginredirect?email=' +
                    info.email +
                    '&tokenid=' +
                    resp.tokenid +
                    platform.assignmentMapping['default'] +
                    '&lk=' +
                    res.locals.ltik;
                console.log('redirecturl---->', redirectURL);
            } else {
                let assignment_id = '';
                //does title contain a mapping
                if (context.resource && context.resource.title && context.resource.title.lastIndexOf('#') > 0) {
                    assignment_id = context.resource.title.substring(context.resource.title.lastIndexOf('#') + 1);
                } else if (context.custom && context.custom.assignment_id) {
                    // is it a canvas assignment id
                    assignment_id = context.custom.assignment_id;
                } else {
                    // is custom activity_id from engage moodle
                    assignment_id = context.custom.activity_id;
                }
                console.log('assignment_id--->', assignment_id);
                let redirectId = '';
                if (platform.assignmentMapping === 'WileyList') {
                    redirectId = wileyAssignments[assignment_id]
                } else {
                    redirectId = platform.assignmentMapping[assignment_id]
                }
                console.log('assignment in platform--->', redirectId);
                redirectURL =
                    'https://' +
                    platform.school_url +
                    '/loginredirect?email=' +
                    info.email +
                    '&tokenid=' +
                    resp.tokenid +
                    redirectId +
                    '&lk=' +
                    res.locals.ltik;
                console.log('redirecturl---->', redirectURL);
            }

            lti.redirect(res, redirectURL);
        }
    }
});

async function sendRequest(emailid, platform) {
    return new Promise((resolved, rejected) => {
        const https = require('https');

        const data = JSON.stringify({
            email: emailid,
            apikey: platform.apikey,
            school_code: platform.school_code,
        });

        let host = 'api.examly.net';
        if (process.env.NODE_ENV === 'production') {
            host = 'api.examly.io';
        }

        const options = {
            hostname: host,
            port: 443,
            path: '/api/users/ltilogin',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
            },
        };

        const req = https.request(options, (res) => {
            console.log(`statusCode: ${res.statusCode}`);
            let responsedata = '';
            res.on('data', (d) => {
                responsedata += d;
            });
            res.on('end', () => {
                console.log(`response:`, responsedata);
                resolved(responsedata);
            });
        });

        req.on('error', (error) => {
            console.error(error);
            resolved(false);
        });

        req.write(data);
        req.end();
    });
}
router.post('/assignmentIDMapping', async (req, res) => {
    try {
        const { exec } = require("child_process");
        var fs = require('fs');
        console.log('Mapping Process Sstarted----->')
        let request = req.body;
        if (request && request.accesskey && request.accesskey === "ngKRKlQlDey1y#k9uHIjo!kioLlbML1@szqa") {
            console.log(request.updatedJson, 'dfasdfdsaf')
            let updateJson = request.updatedJson;
            updateJson = JSON.parse(updateJson);
            let assJson = wileyAssignments;
            for (let eachUpdate in updateJson) {
                assJson[eachUpdate] = updateJson[eachUpdate];
            }
            assJson = JSON.stringify(assJson);
            var a = new Date();
            var month = ("0" + (a.getMonth() + 1)).slice(-2);
            var date = ("0" + a.getDate()).slice(-2);
            let copyFile = `/home/ubuntu/git/examly-lti/config/assignments-${month}-${date}.json`
            exec(`cp /home/ubuntu/git/examly-lti/config/assignments.json ${copyFile}`, (error, stdout, stderr) => {
                if (error) {
                    console.log('Error in Mapping', error.message);
                    return res.status(500).send({ status: 500, message: error.message });
                }
                if (stderr) {
                    console.log('Error in Mapping', stderr);
                    return res.status(500).send({ status: 500, message: stderr });
                }
                fs.writeFile('/home/ubuntu/git/examly-lti/config/assignments.json', assJson, (err) => {
                    if (err) {
                        console.log('Error in Mapping', err.message);
                        exec(`cp ${copyFile} /home/ubuntu/git/examly-lti/config/assignments.json`);
                        return res.status(500).send({ status: 500, message: err.message });
                    } else {
                        exec('pm2 reload all');
                        return res.status(200).send({ status: 200, messgae: 'File Saved' });
                    }
                })
            });
        }
    } catch (err) {
        console.log('Error in Mapping', err.message);
        return res.status(500).send({ status: 500, message: err.message });
    }
});
    
// Wildcard route to deal with redirecting to routes that are actually React routes
router.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

module.exports = router;

