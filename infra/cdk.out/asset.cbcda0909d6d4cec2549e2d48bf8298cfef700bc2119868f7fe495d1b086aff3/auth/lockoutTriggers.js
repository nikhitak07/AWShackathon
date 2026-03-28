"use strict";
/**
 * Cognito Lambda triggers for account lockout enforcement.
 *
 * Pre-Authentication trigger:
 *   - Tracks failed login attempts in DynamoDB (pk: `LOCKOUT#{username}`)
 *   - If count >= 5 within 15 minutes, throws a custom error and sends an SES email
 *
 * Post-Authentication trigger:
 *   - Resets the failed-attempt counter on successful login
 *
 * Requirements: 7.6
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.preAuthHandler = preAuthHandler;
exports.postAuthHandler = postAuthHandler;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_ses_1 = require("@aws-sdk/client-ses");
const LOCKOUT_TABLE = process.env.LOCKOUT_TABLE_NAME ?? "auth_lockout";
const SES_FROM_ADDRESS = process.env.SES_FROM_ADDRESS ?? "no-reply@example.com";
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes
const ddb = new client_dynamodb_1.DynamoDBClient({});
const ses = new client_ses_1.SESClient({});
// ---------------------------------------------------------------------------
// Pre-Authentication trigger
// ---------------------------------------------------------------------------
async function preAuthHandler(event) {
    const username = event.userName;
    const pk = `LOCKOUT#${username}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - WINDOW_SECONDS;
    // Fetch current lockout record
    const getResult = await ddb.send(new client_dynamodb_1.GetItemCommand({
        TableName: LOCKOUT_TABLE,
        Key: { pk: { S: pk } },
    }));
    const item = getResult.Item;
    const storedWindowStart = item?.windowStart?.N
        ? parseInt(item.windowStart.N, 10)
        : 0;
    const storedCount = item?.count?.N ? parseInt(item.count.N, 10) : 0;
    // Determine effective count: reset if outside the 15-minute window
    const effectiveCount = storedWindowStart >= windowStart ? storedCount : 0;
    const effectiveWindowStart = storedWindowStart >= windowStart ? storedWindowStart : now;
    if (effectiveCount >= MAX_ATTEMPTS) {
        // Account is locked — send email notification if this is the first lockout hit
        // (i.e., count was exactly MAX_ATTEMPTS on the previous attempt)
        const userEmail = event.request.userAttributes?.email;
        if (userEmail) {
            await sendLockoutEmail(userEmail, username).catch(() => {
                // Best-effort — do not block the lockout error if SES fails
            });
        }
        throw new Error("PreAuthentication failed with error AccountLocked: Your account has been locked due to too many failed login attempts. Please check your email for instructions.");
    }
    // Increment the counter (will be written on failed auth by Cognito's own flow;
    // we write it here so the count is always up-to-date before Cognito validates credentials)
    const newCount = effectiveCount + 1;
    await ddb.send(new client_dynamodb_1.PutItemCommand({
        TableName: LOCKOUT_TABLE,
        Item: {
            pk: { S: pk },
            username: { S: username },
            count: { N: String(newCount) },
            windowStart: { N: String(effectiveWindowStart) },
            // TTL: expire the record 15 minutes after the window started
            ttl: { N: String(effectiveWindowStart + WINDOW_SECONDS + 60) },
        },
    }));
    if (newCount >= MAX_ATTEMPTS) {
        // This attempt is the 5th failure — lock now and notify
        const userEmail = event.request.userAttributes?.email;
        if (userEmail) {
            await sendLockoutEmail(userEmail, username).catch(() => { });
        }
        throw new Error("PreAuthentication failed with error AccountLocked: Your account has been locked due to too many failed login attempts. Please check your email for instructions.");
    }
    return event;
}
// ---------------------------------------------------------------------------
// Post-Authentication trigger — reset counter on successful login
// ---------------------------------------------------------------------------
async function postAuthHandler(event) {
    const pk = `LOCKOUT#${event.userName}`;
    await ddb.send(new client_dynamodb_1.DeleteItemCommand({
        TableName: LOCKOUT_TABLE,
        Key: { pk: { S: pk } },
    }));
    return event;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function sendLockoutEmail(toAddress, username) {
    await ses.send(new client_ses_1.SendEmailCommand({
        Source: SES_FROM_ADDRESS,
        Destination: { ToAddresses: [toAddress] },
        Message: {
            Subject: {
                Data: "Your Discharge Checklist account has been locked",
                Charset: "UTF-8",
            },
            Body: {
                Text: {
                    Data: [
                        `Hello ${username},`,
                        "",
                        "Your account has been temporarily locked because 5 consecutive failed login attempts were detected within the last 15 minutes.",
                        "",
                        "If this was you, please wait 15 minutes and try again, or contact support to unlock your account immediately.",
                        "",
                        "If you did not attempt to log in, please contact support immediately as your account may be under attack.",
                        "",
                        "— The Discharge Checklist Team",
                    ].join("\n"),
                    Charset: "UTF-8",
                },
            },
        },
    }));
}
