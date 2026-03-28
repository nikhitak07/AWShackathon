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

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyHandler } from "aws-lambda";
import type { Checklist } from "@shared/types";

const TABLE_NAME = process.env.CHECKLISTS_TABLE ?? "checklists";
const TTL_DAYS = 30;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function makePk(userId: string) {
  return `USER#${userId}`;
}

export function makeSk(checklistId: string) {
  return `CHECKLIST#${checklistId}`;
}

export function ttlInSeconds(days = TTL_DAYS): number {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

/** Extracts userId from the JWT claims injected by API Gateway authorizer. */
function getUserIdFromEvent(event: Parameters<APIGatewayProxyHandler>[0]): string | null {
  return (
    (event.requestContext?.authorizer?.claims?.sub as string | undefined) ?? null
  );
}

/** Returns 403 if the requesting userId doesn't match the target userId. */
function forbiddenIfMismatch(requestingUserId: string | null, targetUserId: string) {
  if (!requestingUserId || requestingUserId !== targetUserId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: "Access denied." }),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Save checklist (POST /checklists)
// Requirements: 5.1, 5.2, 9.3
// ---------------------------------------------------------------------------

export async function saveChecklist(checklist: Checklist): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: makePk(checklist.userId),
        sk: makeSk(checklist.id),
        checklist,
        createdAt: checklist.createdAt,
        updatedAt: checklist.updatedAt,
        ttl: ttlInSeconds(),
      },
    })
  );
}

export const saveHandler: APIGatewayProxyHandler = async (event) => {
  const requestingUserId = getUserIdFromEvent(event);
  let body: Checklist;
  try {
    body = JSON.parse(event.body ?? "{}") as Checklist;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  const denied = forbiddenIfMismatch(requestingUserId, body.userId);
  if (denied) return denied;

  try {
    await saveChecklist(body);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch {
    return { statusCode: 503, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
  }
};

// ---------------------------------------------------------------------------
// Get checklist (GET /checklists/{checklistId}?userId=...)
// Requirements: 5.1, 5.4, 8.6
// ---------------------------------------------------------------------------

export async function getChecklist(
  userId: string,
  checklistId: string
): Promise<Checklist | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: makePk(userId), sk: makeSk(checklistId) },
    })
  );
  return result.Item ? (result.Item.checklist as Checklist) : null;
}

export const getHandler: APIGatewayProxyHandler = async (event) => {
  const requestingUserId = getUserIdFromEvent(event);
  const checklistId = event.pathParameters?.checklistId;
  const targetUserId = event.queryStringParameters?.userId;

  if (!checklistId || !targetUserId) {
    return { statusCode: 400, body: JSON.stringify({ error: "checklistId and userId are required." }) };
  }

  const denied = forbiddenIfMismatch(requestingUserId, targetUserId);
  if (denied) return denied;

  try {
    const checklist = await getChecklist(targetUserId, checklistId);
    if (!checklist) {
      return { statusCode: 404, body: JSON.stringify({ error: "Checklist not found." }) };
    }
    return { statusCode: 200, body: JSON.stringify(checklist) };
  } catch {
    return { statusCode: 503, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
  }
};

// ---------------------------------------------------------------------------
// Update checklist (PUT /checklists/{checklistId})
// Requirements: 5.1, 5.4, 8.6
// ---------------------------------------------------------------------------

export async function updateChecklist(checklist: Checklist): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: makePk(checklist.userId), sk: makeSk(checklist.id) },
      UpdateExpression: "SET checklist = :cl, updatedAt = :ua",
      ExpressionAttributeValues: {
        ":cl": checklist,
        ":ua": checklist.updatedAt,
      },
      ConditionExpression: "attribute_exists(pk)", // must already exist
    })
  );
}

export const updateHandler: APIGatewayProxyHandler = async (event) => {
  const requestingUserId = getUserIdFromEvent(event);
  let body: Checklist;
  try {
    body = JSON.parse(event.body ?? "{}") as Checklist;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  const denied = forbiddenIfMismatch(requestingUserId, body.userId);
  if (denied) return denied;

  try {
    await updateChecklist(body);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch {
    return { statusCode: 503, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
  }
};

// ---------------------------------------------------------------------------
// Delete checklist (DELETE /checklists/{checklistId}?userId=...)
// Requirements: 5.1, 5.4, 8.6
// ---------------------------------------------------------------------------

export async function deleteChecklist(userId: string, checklistId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: makePk(userId), sk: makeSk(checklistId) },
    })
  );
}

export const deleteHandler: APIGatewayProxyHandler = async (event) => {
  const requestingUserId = getUserIdFromEvent(event);
  const checklistId = event.pathParameters?.checklistId;
  const targetUserId = event.queryStringParameters?.userId;

  if (!checklistId || !targetUserId) {
    return { statusCode: 400, body: JSON.stringify({ error: "checklistId and userId are required." }) };
  }

  const denied = forbiddenIfMismatch(requestingUserId, targetUserId);
  if (denied) return denied;

  try {
    await deleteChecklist(targetUserId, checklistId);
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch {
    return { statusCode: 503, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
  }
};

// ---------------------------------------------------------------------------
// List checklists for a user (GET /checklists?userId=...)
// Requirements: 5.1, 5.4
// ---------------------------------------------------------------------------

export async function listChecklists(userId: string): Promise<Checklist[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
      ExpressionAttributeValues: {
        ":pk": makePk(userId),
        ":prefix": "CHECKLIST#",
      },
    })
  );
  return (result.Items ?? []).map((item) => item.checklist as Checklist);
}

export const listHandler: APIGatewayProxyHandler = async (event) => {
  const requestingUserId = getUserIdFromEvent(event);
  const targetUserId = event.queryStringParameters?.userId;

  if (!targetUserId) {
    return { statusCode: 400, body: JSON.stringify({ error: "userId is required." }) };
  }

  const denied = forbiddenIfMismatch(requestingUserId, targetUserId);
  if (denied) return denied;

  try {
    const checklists = await listChecklists(targetUserId);
    return { statusCode: 200, body: JSON.stringify(checklists) };
  } catch {
    return { statusCode: 503, body: JSON.stringify({ error: "Storage unavailable. Please try again." }) };
  }
};
