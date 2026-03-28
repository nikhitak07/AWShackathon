/**
 * Unit tests for checklist persistence.
 * Requirements: 5.1, 5.2, 5.3, 9.3
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
  PutCommand: vi.fn().mockImplementation((input) => ({ input })),
  GetCommand: vi.fn().mockImplementation((input) => ({ input })),
  UpdateCommand: vi.fn().mockImplementation((input) => ({ input })),
  DeleteCommand: vi.fn().mockImplementation((input) => ({ input })),
  QueryCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

import {
  saveChecklist,
  getChecklist,
  deleteChecklist,
  saveHandler,
  getHandler,
  deleteHandler,
  makePk,
  makeSk,
  ttlInSeconds,
} from "./checklist";
import type { Checklist } from "@shared/types";
import type { APIGatewayProxyEvent } from "aws-lambda";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeChecklist = (userId: string, id = "cl-1"): Checklist => ({
  id,
  userId,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  items: [
    { id: "item-1", text: "Take aspirin 81mg", category: "Medications", priority: "Routine", completed: false },
  ],
});

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent =>
  ({
    body: null,
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    requestContext: { authorizer: { claims: { sub: "user-a" } } },
    ...overrides,
  } as unknown as APIGatewayProxyEvent);

beforeEach(() => vi.clearAllMocks());

// ---------------------------------------------------------------------------
// Test: cross-user access is denied (Req 5.4, 8.6)
// ---------------------------------------------------------------------------

describe("cross-user access control", () => {
  it("saveHandler returns 403 when JWT userId does not match checklist userId", async () => {
    const cl = makeChecklist("user-b");
    const event = makeEvent({
      body: JSON.stringify(cl),
      requestContext: { authorizer: { claims: { sub: "user-a" } } } as never,
    });
    const res = await saveHandler(event, {} as never, () => {});
    expect(res?.statusCode).toBe(403);
  });

  it("getHandler returns 403 when JWT userId does not match target userId", async () => {
    const event = makeEvent({
      pathParameters: { checklistId: "cl-1" },
      queryStringParameters: { userId: "user-b" },
      requestContext: { authorizer: { claims: { sub: "user-a" } } } as never,
    });
    const res = await getHandler(event, {} as never, () => {});
    expect(res?.statusCode).toBe(403);
  });

  it("deleteHandler returns 403 when JWT userId does not match target userId", async () => {
    const event = makeEvent({
      pathParameters: { checklistId: "cl-1" },
      queryStringParameters: { userId: "user-b" },
      requestContext: { authorizer: { claims: { sub: "user-a" } } } as never,
    });
    const res = await deleteHandler(event, {} as never, () => {});
    expect(res?.statusCode).toBe(403);
  });

  it("getChecklist for user-a cannot retrieve user-b's checklist via key mismatch", async () => {
    // DynamoDB returns nothing because pk won't match
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const result = await getChecklist("user-a", "cl-owned-by-b");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test: 30-day TTL is set correctly on save (Req 5.2)
// ---------------------------------------------------------------------------

describe("TTL on save", () => {
  it("ttlInSeconds returns a value ~30 days from now", () => {
    const now = Math.floor(Date.now() / 1000);
    const ttl = ttlInSeconds();
    const thirtyDays = 30 * 24 * 60 * 60;
    expect(ttl).toBeGreaterThanOrEqual(now + thirtyDays - 5);
    expect(ttl).toBeLessThanOrEqual(now + thirtyDays + 5);
  });

  it("saveChecklist sends a PutCommand with a ttl field set", async () => {
    mockSend.mockResolvedValueOnce({});
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    await saveChecklist(makeChecklist("user-a"));
    const callArg = (PutCommand as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.Item.ttl).toBeDefined();
    expect(typeof callArg.Item.ttl).toBe("number");
  });

  it("saveChecklist uses correct pk/sk key schema", async () => {
    mockSend.mockResolvedValueOnce({});
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    const cl = makeChecklist("user-a", "cl-42");
    await saveChecklist(cl);
    const callArg = (PutCommand as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.Item.pk).toBe("USER#user-a");
    expect(callArg.Item.sk).toBe("CHECKLIST#cl-42");
  });
});

// ---------------------------------------------------------------------------
// Test: storage-unavailable error path (Req 5.3)
// ---------------------------------------------------------------------------

describe("storage-unavailable error surface", () => {
  it("saveHandler returns 503 when DynamoDB throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("DynamoDB unavailable"));
    const cl = makeChecklist("user-a");
    const event = makeEvent({ body: JSON.stringify(cl) });
    const res = await saveHandler(event, {} as never, () => {});
    expect(res?.statusCode).toBe(503);
    expect(JSON.parse(res?.body ?? "{}").error).toMatch(/storage unavailable/i);
  });

  it("getHandler returns 503 when DynamoDB throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("DynamoDB unavailable"));
    const event = makeEvent({
      pathParameters: { checklistId: "cl-1" },
      queryStringParameters: { userId: "user-a" },
    });
    const res = await getHandler(event, {} as never, () => {});
    expect(res?.statusCode).toBe(503);
  });

  it("deleteHandler returns 503 when DynamoDB throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("DynamoDB unavailable"));
    const event = makeEvent({
      pathParameters: { checklistId: "cl-1" },
      queryStringParameters: { userId: "user-a" },
    });
    const res = await deleteHandler(event, {} as never, () => {});
    expect(res?.statusCode).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Test: happy path — save and retrieve
// ---------------------------------------------------------------------------

describe("save and retrieve", () => {
  it("getChecklist returns the checklist when found", async () => {
    const cl = makeChecklist("user-a");
    mockSend.mockResolvedValueOnce({ Item: { checklist: cl } });
    const result = await getChecklist("user-a", "cl-1");
    expect(result).toEqual(cl);
  });

  it("getChecklist returns null when item not found", async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const result = await getChecklist("user-a", "cl-missing");
    expect(result).toBeNull();
  });

  it("deleteChecklist sends DeleteCommand with correct key", async () => {
    mockSend.mockResolvedValueOnce({});
    const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
    await deleteChecklist("user-a", "cl-1");
    const callArg = (DeleteCommand as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.Key).toEqual({ pk: "USER#user-a", sk: "CHECKLIST#cl-1" });
  });
});

// ---------------------------------------------------------------------------
// Test: key helpers
// ---------------------------------------------------------------------------

describe("key helpers", () => {
  it("makePk formats correctly", () => {
    expect(makePk("user-123")).toBe("USER#user-123");
  });

  it("makeSk formats correctly", () => {
    expect(makeSk("cl-abc")).toBe("CHECKLIST#cl-abc");
  });
});
