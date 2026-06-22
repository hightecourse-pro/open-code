/**
 * Open Code — email sender (Google Apps Script Web App).
 *
 * Sends email through your Google Workspace account (from office@opencode.org.il,
 * display name "קוד פתוח"). Runs under your account after a one-time
 * authorization — no App Password and no 2-Step Verification required.
 *
 * The app POSTs JSON to this web app's /exec URL when it needs to send mail.
 *
 * Accepted JSON body:
 *   { "secret": "...",                         // must match SECRET below
 *     "subject": "כותרת",
 *     "html": "<div>… optional {{name}} …</div>",
 *     // single recipient:
 *     "to": "a@b.com", "name": "נועה",
 *     // OR a group (mail-merge of {{name}} per recipient):
 *     "recipients": [ { "email": "a@b.com", "name": "נועה" }, … ]
 *   }
 *
 * Deploy: see README.md in this folder.
 */

// ⚠️ Set this to a long random string and put the SAME value in the app's
// APPS_SCRIPT_EMAIL_SECRET env var. This is what stops strangers from using
// your sender.
const SECRET = "CHANGE_ME_TO_A_LONG_RANDOM_STRING";
const SENDER_NAME = "קוד פתוח";

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (body.secret !== SECRET) {
      return json_({ ok: false, error: "unauthorized" });
    }
    if (!body.subject || !body.html) {
      return json_({ ok: false, error: "missing subject or html" });
    }

    const recipients =
      Array.isArray(body.recipients) && body.recipients.length
        ? body.recipients
        : [{ email: body.to, name: body.name || "" }];

    var sent = 0;
    var errors = [];
    recipients.forEach(function (r) {
      if (!r || !r.email) return;
      var personalized = String(body.html).replace(/\{\{\s*name\s*\}\}/g, r.name || "");
      try {
        GmailApp.sendEmail(r.email, body.subject, stripHtml_(personalized), {
          htmlBody: personalized,
          name: SENDER_NAME,
        });
        sent++;
      } catch (err) {
        errors.push(r.email + ": " + err);
      }
    });

    return json_({
      ok: true,
      sent: sent,
      errors: errors,
      remainingDailyQuota: MailApp.getRemainingDailyQuota(),
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Plain-text fallback for clients that don't render HTML.
function stripHtml_(html) {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
