function account_fields_valid(account_sid, auth_token) {
  return account_sid.startsWith("AC") && account_sid.length === 34 && auth_token.length > 0;
}

function get_account_info(account_sid, auth_token) {
  if(account_fields_valid(account_sid, auth_token)) {
    return {
      valid: true,
      sid: account_sid,
      token: auth_token,
      name: "My First Twilio Account",
      bundles: {
        BUxxxx: "nom du premier bundle",
        BUyyyy: "nom du second bundle"
      }
    };
  } else {
    return {
      valid: false
    };
  }
}

function update_button() {
  const btn = $("#go");
  const bdls = $("#src_bundles>option:selected").length;
  if(bdls && src_account.valid && dest_account.valid) {
    btn.text(`Copy ${bdls} bundle(s) from "${src_account.name}" (${src_account.sid}) to "${dest_account.name}" (${dest_account.sid})`)
    btn.prop("disabled",false);
  } else {
    btn.text(`Please set the account credentials and select the bundle(s)`);
    btn.prop("disabled",true);
  }
}

function connect_src_account() {
  $("#src_bundles").children().remove();

  const account_sid = $("#src_account_sid").val();
  const auth_token = $("#src_auth_token").val();

  src_account = get_account_info(account_sid, auth_token);
  if(src_account.valid) {
    $("#src_account_name").text(src_account.name);
    $.each(src_account.bundles, function (sid, item) {
      $("#src_bundles").append($('<option>', {
        value: sid,
        text : sid + " (" + item + ")"
      }));
    });
  }

  update_button();
}

function connect_dest_account() {
  const account_sid = $("#dest_account_sid").val();
  const auth_token = $("#dest_auth_token").val();

  dest_account = get_account_info(account_sid, auth_token);
  if(dest_account.valid) {
    $("#dest_account_name").text(dest_account.name);
  }

  update_button();
}

function start_copy() {
  const logs = $("logs");
  logs.append("<p>ready</p>");
}

$(document).ready(function() {
  $("#src_account_sid").change(connect_src_account);
  $("#src_auth_token").change(connect_src_account);
  $("#dest_account_sid").change(connect_dest_account);
  $("#dest_auth_token").change(connect_dest_account);
  $("#src_bundles").change(update_button);
  update_button();
  $("#go").click(start_copy());
})

let src_account = {valid:false};
let dest_account = {valid:false};
