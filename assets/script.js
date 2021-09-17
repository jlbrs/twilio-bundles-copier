function account_fields_valid(account_sid, auth_token) {
  return account_sid.startsWith("AC") && account_sid.length === 34 && auth_token.length > 0;
}

function get_account_info(account_sid, auth_token) {
  return new Promise(((resolve) => {
    if (account_fields_valid(account_sid, auth_token)) {
      const header = new Headers();
      header.append("Content-Type", "application/json");
      resolve(fetch("/account-details", {
        method: "post",
        headers: header,
        body: JSON.stringify({account_sid: account_sid, auth_token: auth_token})
      }).then(function(response) {
        if (response.ok) {
          return response.json();
        } else {
          return {
            valid: false
          };
        }
      }).catch(reason => {
        resolve( {
          valid: false
        });
      }));
    } else {
      resolve( {
        valid: false
      });
    }
  }));
}

function update_button() {
  const btn = $("#go");
  const bdls = $("#src_bundles>option:selected").length;
  if(bdls && src_account.valid && dest_account.valid) {
    btn.text(`Copy ${bdls} bundle(s)\nfrom "${src_account.name}" (${src_account.sid})\nto "${dest_account.name}" (${dest_account.sid})`)
    btn.prop("disabled",false);
  } else {
    btn.text(`Please set the account credentials and select the bundle(s)`);
    btn.prop("disabled",true);
  }
}

function connect_src_account() {
  const src_bundle = $("#src_bundle");
  const src_bundles = $("#src_bundles");
  const src_account_name = $("#src_account_name");
  src_account_name.text("🔄");
  src_bundle.hide();
  src_bundles.children().remove();

  const account_sid = $("#src_account_sid").val();
  const auth_token = $("#src_auth_token").val();

  get_account_info(account_sid, auth_token)
    .then((account_info) => {
      src_account = {...account_info};
      if(src_account.valid) {
        src_account_name.text("✅ " + src_account.name);
        if(Object.keys(src_account.bundles).length > 1) {
          src_bundle.show();
          $.each(src_account.bundles, function (sid, item) {
            src_bundles.append($('<option>', {
              class: item.status,
              value: sid,
              text: sid + " (" + item.name + ")"
            }));
          });
        }
      } else {
        src_account_name.text("❌");
      }

      update_button();
    });

}

function connect_dest_account() {
  const dest_account_name = $("#dest_account_name");
  dest_account_name.text("🔄");

  const account_sid = $("#dest_account_sid").val();
  const auth_token = $("#dest_auth_token").val();

  get_account_info(account_sid, auth_token)
    .then((account_info) => {
      dest_account = {...account_info};
      if (dest_account.valid) {
        dest_account_name.text("✅ " + dest_account.name);
      } else {
        dest_account_name.text("❌");
      }

      update_button();
    });
}

function copy() {
  const btn = $("#go");
  btn.text(`Please wait...`);
  btn.prop("disabled",true);

  const src_sid = src_account.sid;
  const src_token = src_account.token;
  const dest_sid = dest_account.sid;
  const dest_token = dest_account.token;
  const bundles = $.map($("#src_bundles>option:selected"), function(t) { return t.value });
  const logs = $("#logs");

  const header = new Headers();
  header.append("Content-Type", "application/json");
  fetch("/copy-bundle", {
    method: "post",
    headers: header,
    body: JSON.stringify({
      "src_account_sid":src_sid,
      "src_auth_token":src_token,
      "dest_account_sid":dest_sid,
      "dest_auth_token":dest_token,
      "bundle_sids":bundles
    })
  }).then(function(response) {
    if (response.ok) {
      response.json().then((resjson) => {
        resjson.forEach((k,v) => logs.append(`${k}: ${v}`));
        logs.append("ready<br/>");
      })
    } else {
      logs.append("error");
    }
  }).catch(reason => {
    logs.append(reason);
  })

  logs.append("ready<br/>");
  update_button();
}

$(document).ready(function() {
  $("#src_account_sid").change(connect_src_account);
  $("#src_auth_token").change(connect_src_account);
  $("#dest_account_sid").change(connect_dest_account);
  $("#dest_auth_token").change(connect_dest_account);
  $("#src_bundles").change(update_button);
  update_button();
  $("#go").click(copy);
})

let src_account = {valid:false};
let dest_account = {valid:false};
