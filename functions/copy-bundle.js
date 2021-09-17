const twilio = require("twilio");
const request = require("request");
const fs = require("fs");

function copy_bundle(src_client, dest_client, src_bundle_sid) {
  return src_client.numbers.regulatoryCompliance
    .bundles(src_bundle_sid)
    .fetch()
    .then((src_bundle) => ({
      regulationSid: src_bundle.regulationSid,
      statusCallback: src_bundle.statusCallback,
      friendlyName: src_bundle.friendlyName,
      email: src_bundle.email,
    }))
    .then((bundle_infos) =>
      // TODO: uncomment to actually create the bundle
      // dest_client.numbers.regulatoryCompliance.bundles.create(bundle_infos)
      ({ sid: "BU-fake-" + src_bundle_sid })
    )
    .then((new_bundle) => new_bundle.sid);
}

function copy_address(src_client, dest_client, src_address_sid) {
  return src_client
    .addresses(src_address_sid)
    .fetch()
    .then((src_address) => ({
      customerName: src_address.customerName,
      street: src_address.street,
      city: src_address.city,
      region: src_address.region,
      postalCode: src_address.postalCode,
      isoCountry: src_address.isoCountry,
      friendlyName: src_address.friendlyName,
      emergencyEnabled: src_address.emergencyEnabled,
    }))
    .then((address_infos) =>
      // TODO: uncomment to actually create the address
      // dest_client.addresses.create(address_infos)
      ({ sid: "AD-fake-" + src_address_sid })
    )
    .then((new_address) => new_address.sid);
}

function copy_document(
  src_client,
  dest_client,
  dest_account_sid,
  dest_auth_token,
  src_doc_sid,
  address_conv
) {
  return src_client.numbers.regulatoryCompliance
    .supportingDocuments(src_doc_sid)
    .fetch()
    .then((src_document) => {
      const new_supporting_document = {
        friendlyName: src_document.friendlyName,
        type: src_document.type,
        attributes: { ...src_document.attributes },
      };
      if (src_document.attributes.address_sids)
        new_supporting_document.attributes.address_sids =
          src_document.attributes.address_sids.map(
            (src_address_sid) => address_conv[src_address_sid]
          );
      return new_supporting_document;
    })
    .then((document_infos) =>
      // TODO: uncomment to actually create the document (without the pdf :( as we miss an api to get it)
      // dest_client.numbers.regulatoryCompliance.supportingDocuments.create(document_infos)
      // TODO: find a way to download the original document
      /*
      {

        const path = "";
        request.post({
          url: `https://numbers-upload.twilio.com/v2/RegulatoryCompliance/SupportingDocuments`,
          auth: {'user': dest_account_sid, 'pass': dest_auth_token},
          formData: {"file": fs.readFileSync(path), ...new_supporting_document}
        }).
          .then((error, response, body) {
          console.error('error:', error); // Print the error if one occurred
          console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
          console.log('body:', body); // Print the HTML for the Google homepage.
          callback(null, body);
        });
        })
        */
      ({ sid: "RD-fake-" + src_doc_sid })
    )
    .then((document) => document.sid);
}

function copy_end_user(src_client, dest_client, end_user_sid, address_conv) {
  return src_client.numbers.regulatoryCompliance
    .endUsers(end_user_sid)
    .fetch()
    .then((src_user) => {
      const new_user = {
        attributes: { ...src_user.attributes },
        friendlyName: src_user.friendlyName,
        type: src_user.type,
      };
      if (src_user.attributes.address_sids)
        new_user.attributes.address_sids = src_user.attributes.address_sids.map(
          (src_address_sid) => address_conv[src_address_sid]
        );
      return new_user;
    })
    .then((user_infos) =>
      // TODO: uncomment to actually create the user
      // dest_client.numbers.regulatoryCompliance.endUsers.create(user_infos)
      ({ sid: "IT-fake-" + end_user_sid })
    )
    .then((end_user) => end_user.sid);
}

exports.handler = async function (context, event, callback) {
  const {
    src_account_sid,
    src_auth_token,
    dest_account_sid,
    dest_auth_token,
    bundle_sids,
  } = event;

  const src_client = new twilio(src_account_sid, src_auth_token);
  const dest_client = new twilio(dest_account_sid, dest_auth_token);

  /*
   1) COPY THE RAW BUNDLE(S)
   */
  console.log("*** COPYING BUNDLES ***");
  // Variables to be filled-in:
  const bundle_conv = {};
  const valid_bundles = [];

  // Filter duplicates
  const bundles_to_copy = [...new Set(bundle_sids)];
  console.log("Bundles to copy: ", bundles_to_copy);

  // Copy all bundles in parallel, or insert the new name or an error
  await Promise.all(
    bundles_to_copy.map((src_bundle_sid) =>
      copy_bundle(src_client, dest_client, src_bundle_sid)
        .then((new_bundle_sid) => {
          bundle_conv[src_bundle_sid] = new_bundle_sid;
          valid_bundles.push(src_bundle_sid);
        })
        .catch((reason) => {
          bundle_conv[src_bundle_sid] = `ERROR: ${reason}`;
        })
    )
  );

  // Log the conversion table
  console.log("Bundle conversion table: ", bundle_conv);

  /*
   2) FIND ALL ITEMS TO COPY
   */
  console.log("*** SEARCHING RELATED RESOURCES ***");
  // Variable to be filled-in:
  const bundle_items = {};

  // List all documents from all valid bundles
  const all_documents = [];
  const all_end_users = [];
  await Promise.all(
    valid_bundles.map((bundle_sid) =>
      src_client.numbers.regulatoryCompliance
        .bundles(bundle_sid)
        .itemAssignments.list()
        .then((items) => items.map((item) => item.objectSid))
        .then((object_sids) => (bundle_items[bundle_sid] = [...object_sids]))
        .then((object_sids) =>
          object_sids.forEach((object_sid) => {
            switch (object_sid.substr(0, 2)) {
              case "RD":
                all_documents.push(object_sid);
                break;
              case "IT":
                all_end_users.push(object_sid);
                break;
              default:
                console.error(`unknown object type: ${object_sid}`);
            }
          })
        )
        .catch((reason) => console.error(reason))
    )
  );
  console.log("Related resources: ", bundle_items);

  // filter duplicates
  const documents_to_copy = [...new Set(all_documents)];
  const end_users_to_copy = [...new Set(all_end_users)];

  // Log the list
  console.log("Documents to copy: ", documents_to_copy);
  console.log("End Users to copy: ", end_users_to_copy);

  // Get all addresses needed in all documents
  const all_addresses = [];
  await Promise.all([
    Promise.all(
      documents_to_copy.map((document_sid) =>
        src_client.numbers.regulatoryCompliance
          .supportingDocuments(document_sid)
          .fetch()
          .then((src_document) => {
            if (src_document.attributes.address_sids) {
              all_addresses.push.apply(
                all_addresses,
                src_document.attributes.address_sids
              );
            }
          })
          .catch((reason) => console.error(reason))
      )
    ),
    Promise.all(
      end_users_to_copy.map((end_user_sid) =>
        src_client.numbers.regulatoryCompliance
          .endUsers(end_user_sid)
          .fetch()
          .then((end_user) => {
            if (end_user.attributes.address_sids) {
              all_addresses.push.apply(
                all_addresses,
                end_user.attributes.address_sids
              );
            }
          })
          .catch((reason) => console.error(reason))
      )
    ),
  ]);

  // Filter duplicates
  const addresses_to_copy = [...new Set(all_addresses)];

  // Log the list
  console.log("Addresses to copy: ", addresses_to_copy);

  /*
   3) COPY ALL THE ADDRESSES
   */
  console.log("*** COPYING ADDRESSES ***");
  const address_conv = {};

  await Promise.all(
    addresses_to_copy.map((src_address_sid) =>
      copy_address(src_client, dest_client, src_address_sid)
        .then((new_address_sid) => {
          address_conv[src_address_sid] = new_address_sid;
        })
        .catch((reason) => {
          console.error(reason);
        })
    )
  );

  // Log the conversion table
  console.log("Address conversion table:", address_conv);

  /*
   4) COPY ALL THE ASSIGNED ITEMS
   */
  console.log("*** COPYING ASSIGNED ITEMS ***");
  const items_conv = {};
  await Promise.all([
    /*
     4-1) COPY ALL THE SUPPORTING DOCUMENTS
     */
    Promise.all(
      documents_to_copy.map((src_doc_sid) =>
        copy_document(
          src_client,
          dest_client,
          dest_account_sid,
          dest_auth_token,
          src_doc_sid,
          address_conv
        )
          .then((new_doc_sid) => {
            items_conv[src_doc_sid] = new_doc_sid;
          })
          .catch((reason) => {
            console.error(reason);
          })
      )
    ),

    /*
     4-2) COPY ALL THE END USERS
     */
    Promise.all(
      end_users_to_copy.map((src_user_sid) =>
        copy_end_user(src_client, dest_client, src_user_sid, address_conv)
          .then((new_user_sid) => {
            items_conv[src_user_sid] = new_user_sid;
          })
          .catch((reason) => {
            console.error(reason);
          })
      )
    ),
  ]);

  // Log the conversion table
  console.log("Item conversion table:", items_conv);

  /*
   5) ASSIGN ITEMS TO THE NEW BUNDLES
   */
  console.log("*** ATTACHING COPIED ITEMS ***");
  await Promise.all(
    valid_bundles.map((src_bundle) =>
      Promise.all(
        bundle_items[src_bundle].map((src_item) =>
          dest_client.numbers.regulatoryCompliance
            .bundles(bundle_conv[src_bundle])
            .itemAssignments.create({ objectSid: items_conv[src_item] })
            .catch((reason) =>
              console.error(
                `Error while assigning ${items_conv[src_item]} to bundle ${bundle_conv[src_bundle]}: ${reason}`
              )
            )
        )
      )
    )
  );

  /*
   6) MATCH BUNDLE STATUSES
   */
  console.log("*** SUBMITTING BUNDLES ***");
  await Promise.all(
    valid_bundles.map((src_bundle) =>
      src_client.numbers.regulatoryCompliance
        .bundles(src_bundle)
        .fetch()
        .then((bundle) => {
          // TODO: uncomment to actually submit the bundle
          /*if (
            bundle.status in ["pending-review", "in-review", "twilio-approved"]
          )
            dest_client.numbers.regulatoryCompliance
              .bundles(bundle_conv[bundle.sid])
              .update({ status: "pending-review" });*/
          console.log(`Bundle ${bundle.sid} is ${bundle.status}`);
        })
    )
  );

  callback(null, bundle_conv);
};
