#! /usr/bin/env node

var https = require('https');

process.on('SIGTERM', function() {
	process.exit(1);
});

process.on('exit', function() {
	console.log("Shutting Down");
});

// ----------
// PARAMETERS
// ----------

var apiHost = process.env.API_HOST;
var apiPath = '/api/v3/';
var token = process.env.API_TOKEN;
var projectId = process.env.PROJECT_ID;
var approvedLabel = 'Approved';
var wipLabel = 'Work in progress';

// ---------
// FUNCTIONS
// ---------

// Get all open merge requests and run callback on the array.
function getMergeRequests(callback) {
    var req = https.request(
        {
            hostname: apiHost,
            path: apiPath + '/projects/' + projectId + '/merge_requests?state=opened&per_page=100',
            method: 'GET',
            headers: { 'PRIVATE-TOKEN': token }
        },
        function (res) {
            var body = '';

            res.on('data', function (chunk) {
                body = body + chunk;
            });

            res.on('end', function () {
                callback(JSON.parse(body));
            });
        }
    );

    req.end();
}

// Set labels on given merge request in gitlab.
function putLabels(merge) {
    var req = https.request(
        {
            hostname: apiHost,
            path: apiPath + '/projects/' + projectId + '/merge_request/' + merge.id + '?labels=' + encodeURIComponent(merge.labels.join(',')),
            method: 'PUT',
            headers: { 'PRIVATE-TOKEN': token }
        }
    );

    req.end();
}

function addLabel(merge, newLabel) {
	console.log('Adding ' + newLabel + ' to #' + merge.iid);
	merge.labels = merge.labels.concat([newLabel]);
	putLabels(merge);
}

function checkApproved(merge, callback) {
    var req = https.request(
        {
            hostname: apiHost,
            path: apiPath + '/projects/' + projectId + '/merge_request/' + merge.id + '/approvals',
            method: 'GET',
            headers: { 'PRIVATE-TOKEN': token }
        },
        function (res) {
            var body = '';

            res.on('data', function (chunk) {
				body += chunk;
            });

            res.on('end', function() {
                response = JSON.parse(body);
                callback(!Boolean(response.approvals_left));
            });
        }
    );

    req.end();
}

// ---
// GO!
// ---

setInterval(function() {
	getMergeRequests(function (merges) {
		merges.forEach(function (merge) {
			checkApproved(merge, function(isApproved) {
				if (merge.labels.indexOf(approvedLabel) === -1 && isApproved) {
					addLabel(merge, approvedLabel);
				}
			});

			if (merge.labels.indexOf(wipLabel) === -1 && merge.work_in_progress) {
				addLabel(merge, wipLabel);
			}
		});
	});
}, 60000);
