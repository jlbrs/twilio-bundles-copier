const twilio = require("twilio");

exports.handler = function(context, event, callback) {
  let response = {
    valid: false
  }

    const {
      account_sid, auth_token
    } = event;
    const client = new twilio(account_sid, auth_token);
    client.api.accounts(account_sid)
      .fetch()
      .then(account => {
        response.valid = true;
        response.name = account.friendlyName;
        response.sid = account.sid;
        response.token = account.authToken;
        response.bundles = {};
        client.numbers.regulatoryCompliance
          .bundles
          .list()
          .then(bundles => bundles.forEach(b => response.bundles[b.sid] = {status: b.status, name: b.friendlyName}))
          .then(() => callback(null, response));
      })
      .catch((reason) => {
        console.log(reason);
        callback(null, response);
      });

};
