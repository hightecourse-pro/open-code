/**
 * Open Code — email sender (Google Apps Script Web App) + send log.
 *
 * Sends email through your Google Workspace account (display name "קוד פתוח"),
 * and writes one row per recipient to a "Log" tab in the bound spreadsheet.
 * Runs under your account after a one-time authorization — no App Password and
 * no 2-Step Verification required.
 *
 * IMPORTANT: this script must be *bound to a Google Sheet* (open a Sheet →
 * Extensions → Apps Script), so it can log to it. Standalone scripts have no
 * active spreadsheet.
 *
 * POST JSON body:
 *   { "secret": "...",                         // must match SECRET below
 *     "subject": "כותרת",
 *     "html": "<div>… optional {{name}} …</div>",
 *     "to": "a@b.com", "name": "נועה"            // single recipient
 *     // — or — a group (mail-merge of {{name}} per recipient):
 *     "recipients": [ { "email": "a@b.com", "name": "נועה" }, … ]
 *   }
 */

// ⚠️ Set to a long random string; put the SAME value in the app's
// APPS_SCRIPT_EMAIL_SECRET env var. This is what blocks strangers.
const SECRET = "CHANGE_ME_TO_A_LONG_RANDOM_STRING";
const SENDER_NAME = "קוד פתוח";
const LOG_SHEET_NAME = "Log";

/** Health check — opening the /exec URL in a browser shows this. */
function doGet() {
  return json_({ ok: true, service: "open-code-mailer", remainingDailyQuota: MailApp.getRemainingDailyQuota() });
}

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

    const now = new Date();
    var sent = 0;
    var errors = [];
    var logRows = [];

    recipients.forEach(function (r) {
      if (!r || !r.email) return;
      var name = r.name || "";
      var personalized = String(body.html).replace(/\{\{\s*name\s*\}\}/g, name);
      var status = "sent";
      var errorMsg = "";
      try {
        GmailApp.sendEmail(r.email, body.subject, stripHtml_(personalized), {
          htmlBody: personalized,
          name: SENDER_NAME,
        });
        sent++;
      } catch (err) {
        status = "error";
        errorMsg = String(err);
        errors.push(r.email + ": " + errorMsg);
      }
      logRows.push([now, r.email, name, body.subject, status, errorMsg]);
    });

    appendLog_(logRows);

    return json_({
      ok: true,
      sent: sent,
      failed: errors.length,
      errors: errors,
      remainingDailyQuota: MailApp.getRemainingDailyQuota(),
    });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Append rows to the Log sheet (creates it + header on first use). */
function appendLog_(rows) {
  if (!rows || !rows.length) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return; // not bound to a sheet — skip logging
  var sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(["Timestamp", "Email", "Name", "Subject", "Status", "Error"]);
    sheet.setFrozenRows(1);
  }
  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
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
