"use strict";
/**
 * Checklist persistence — DynamoDB CRUD Lambda handlers.
 *
 * Key schema:
 *   pk: USER#{userId}
 *   sk: CHECKLIST#{checklistId}
 *
 * - 30-day TTL on every item (Req 5.2)
 * - Per-user access enforcement: userId from JWT must match pk (Req 5.4, 8.6)
 *
 * Requirements: 5.1, 5.2, 5.4, 8.6, 9.3
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listHandler = exports.deleteHandler = exports.updateHandler = exports.getHandler = exports.saveHandler = void 0;
exports.makePk = makePk;
exports.makeSk = makeSk;
exports.ttlInSeconds = ttlInSeconds;
exports.saveChecklist = saveChecklist;
exports.getChecklist = getChecklist;
exports.updateChecklist = updateChecklist;
exports.deleteChecklist = deleteChecklist;
exports.listChecklists = listChecklists;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const TABLE_NAME = process.env.CHECKLISTS_TABLE ?? "checklists";
const TTL_DAYS = 30;
const ddb = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Content-Type": "application/json",
};
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePk(userId) {
    return `USER#${userId}`;
}
function makeSk(checklistId) {
    return `CHECKLIST#${checklistId}`;
}
function ttlInSeconds(days = TTL_DAYS) {
    return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}
/** Extracts userId from the JWT claims injected by API Gateway authorizer. */
function getUserIdFromEvent(event) {
    return (event.requestContext?.authorizer?.claims?.sub ?? null);
}
/** Returns 403 if the requesting userId doesn't match the target userId. */
function forbiddenIfMismatch(requestingUserId, targetUserId) {
    if (!requestingUserId || requestingUserId !== targetUserId) {
        return {
            statusCode: 403,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Access denied." }),
        };
    }
    return null;
}
// ---------------------------------------------------------------------------
// Save checklist (POST /checklists)
// Requirements: 5.1, 5.2, 9.3
// ---------------------------------------------------------------------------
async function saveChecklist(checklist) {
    await ddb.send(new lib_dynamodb_1.PutCommand({
        TableName: TABLE_NAME,
        Item: {
            pk: makePk(checklist.userId),
            sk: makeSk(checklist.id),
            checklist,
            createdAt: checklist.createdAt,
            updatedAt: checklist.updatedAt,
            ttl: ttlInSeconds(),
        },
    }));
}
const saveHandler = async (event) => {
    const requestingUserId = getUserIdFromEvent(event);
    let body;
    try {
        body = JSON.parse(event.body ?? "{}");
    }
    catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
    }
    const denied = forbiddenIfMismatch(requestingUserId, body.userId);
    if (denied)
        return denied;
    try {
        await saveChecklist(body);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
    }
    catch {
        return { statusCode: 503, headers: CORS_HEADERS, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
    }
};
exports.saveHandler = saveHandler;
// ---------------------------------------------------------------------------
// Get checklist (GET /checklists/{checklistId}?userId=...)
// Requirements: 5.1, 5.4, 8.6
// ---------------------------------------------------------------------------
async function getChecklist(userId, checklistId) {
    const result = await ddb.send(new lib_dynamodb_1.GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: makePk(userId), sk: makeSk(checklistId) },
    }));
    return result.Item ? result.Item.checklist : null;
}
const getHandler = async (event) => {
    const requestingUserId = getUserIdFromEvent(event);
    const checklistId = event.pathParameters?.checklistId;
    const targetUserId = event.queryStringParameters?.userId;
    if (!checklistId || !targetUserId) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "checklistId and userId are required." }) };
    }
    const denied = forbiddenIfMismatch(requestingUserId, targetUserId);
    if (denied)
        return denied;
    try {
        const checklist = await getChecklist(targetUserId, checklistId);
        if (!checklist) {
            return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: "Checklist not found." }) };
        }
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(checklist) };
    }
    catch {
        return { statusCode: 503, headers: CORS_HEADERS, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
    }
};
exports.getHandler = getHandler;
// ---------------------------------------------------------------------------
// Update checklist (PUT /checklists/{checklistId})
// Requirements: 5.1, 5.4, 8.6
// ---------------------------------------------------------------------------
async function updateChecklist(checklist) {
    await ddb.send(new lib_dynamodb_1.UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: makePk(checklist.userId), sk: makeSk(checklist.id) },
        UpdateExpression: "SET checklist = :cl, updatedAt = :ua",
        ExpressionAttributeValues: {
            ":cl": checklist,
            ":ua": checklist.updatedAt,
        },
        ConditionExpression: "attribute_exists(pk)", // must already exist
    }));
}
const updateHandler = async (event) => {
    const requestingUserId = getUserIdFromEvent(event);
    let body;
    try {
        body = JSON.parse(event.body ?? "{}");
    }
    catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
    }
    const denied = forbiddenIfMismatch(requestingUserId, body.userId);
    if (denied)
        return denied;
    try {
        await updateChecklist(body);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
    }
    catch {
        return { statusCode: 503, headers: CORS_HEADERS, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
    }
};
exports.updateHandler = updateHandler;
// ---------------------------------------------------------------------------
// Delete checklist (DELETE /checklists/{checklistId}?userId=...)
// Requirements: 5.1, 5.4, 8.6
// ---------------------------------------------------------------------------
async function deleteChecklist(userId, checklistId) {
    await ddb.send(new lib_dynamodb_1.DeleteCommand({
        TableName: TABLE_NAME,
        Key: { pk: makePk(userId), sk: makeSk(checklistId) },
    }));
}
const deleteHandler = async (event) => {
    const requestingUserId = getUserIdFromEvent(event);
    const checklistId = event.pathParameters?.checklistId;
    const targetUserId = event.queryStringParameters?.userId;
    if (!checklistId || !targetUserId) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "checklistId and userId are required." }) };
    }
    const denied = forbiddenIfMismatch(requestingUserId, targetUserId);
    if (denied)
        return denied;
    try {
        await deleteChecklist(targetUserId, checklistId);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true }) };
    }
    catch {
        return { statusCode: 503, headers: CORS_HEADERS, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
    }
};
exports.deleteHandler = deleteHandler;
// ---------------------------------------------------------------------------
// List checklists for a user (GET /checklists?userId=...)
// Requirements: 5.1, 5.4
// ---------------------------------------------------------------------------
async function listChecklists(userId) {
    const result = await ddb.send(new lib_dynamodb_1.QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
            ":pk": makePk(userId),
            ":prefix": "CHECKLIST#",
        },
    }));
    return (result.Items ?? []).map((item) => item.checklist);
}
const listHandler = async (event) => {
    const requestingUserId = getUserIdFromEvent(event);
    const targetUserId = event.queryStringParameters?.userId;
    if (!targetUserId) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "userId is required." }) };
    }
    const denied = forbiddenIfMismatch(requestingUserId, targetUserId);
    if (denied)
        return denied;
    try {
        const checklists = await listChecklists(targetUserId);
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(checklists) };
    }
    catch {
        return { statusCode: 503, headers: CORS_HEADERS, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
    }
};
exports.listHandler = listHandler;
