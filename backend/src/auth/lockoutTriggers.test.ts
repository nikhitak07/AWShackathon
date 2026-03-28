/**
 * Unit tests for account lockout trigger logic.
 * Requirements: 7.6
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AWS SDK clients before importing the module under test
// ---------------------------------------------------------------------------

const mockDdbSend = vi.fn();
const mockSesSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockDdbSend })),
  GetItemCommand: vi.fn((input) => ({ input, _type: "GetItem" })),
  PutItemCommand: vi.fn((input) => ({ input, _type: "PutItem" })),
  DeleteItemCommand: vi.fn((input) => ({ input, _type: "DeleteItem" })),
}));

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: vi.fn(() => ({ send: mockSesSend })),
  SendEmailCommand: vi.fn((input) => ({ input, _type: "SendEmail" })),
}));

// Set env vars before importing
process.env.LOCKOUT_TABLE_NAME = "auth_lockout";
process.env.SES_FROM_ADDRESS = "no-reply@example.com";

import { preAuthHandler, postAuthHandler } from "./lockoutTriggers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePreAuthEvent(
  username: string,
  email?: string
): Parameters<typeof preAuthHandler>[0] {
  return {
    userName: username,
    request: {
      userAttributes: email ? { email } : {},
    },
  } as Parameters<typeof preAuthHandler>[0];
}

function makePostAuthEvent(
  username: string
): Parameters<typeof postAuthHandler>[0] {
  return {
    userName: username,
    request: { userAttributes: {} },
  } as Parameters<typeof postAuthHandler>[0];
}

function makeGetItemResult(count: number, windowStart: number) {
  return {
    Item: {
      pk: { S: `LOCKOUT#testuser` },
      count: { N: String(count) },
      windowStart: { N: String(windowStart) },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("preAuthHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSesSend.mockResolvedValue({});
  });

  it("allows login when no prior failed attempts exist", async () => {
    mockDdbSend.mockResolvedValueOnce({ Item: undefined }); // GetItem: no record
    mockDdbSend.mockResolvedValueOnce({}); // PutItem: write count=1

    const event = makePreAuthEvent("testuser", "user@example.com");
    const result = await preAuthHandler(event);
    expect(result).toBe(event);
  });

  it("allows login when failed attempts are below threshold", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockDdbSend.mockResolvedValueOnce(makeGetItemResult(3, now - 60)); // 3 attempts, within window
    mockDdbSend.mockResolvedValueOnce({}); // PutItem

    const event = makePreAuthEvent("testuser", "user@example.com");
    const result = await preAuthHandler(event);
    expect(result).toBe(event);
  });

  it("throws and sends email when count reaches 5 (lockout on 5th attempt)", async () => {
    const now = Math.floor(Date.now() / 1000);
    // 4 prior attempts — this call increments to 5 → lockout
    mockDdbSend.mockResolvedValueOnce(makeGetItemResult(4, now - 60));
    mockDdbSend.mockResolvedValueOnce({}); // PutItem

    const event = makePreAuthEvent("testuser", "user@example.com");
    await expect(preAuthHandler(event)).rejects.toThrow("AccountLocked");
    expect(mockSesSend).toHaveBeenCalledTimes(1);
  });

  it("throws immediately when count is already >= 5 (account already locked)", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockDdbSend.mockResolvedValueOnce(makeGetItemResult(5, now - 60));

    const event = makePreAuthEvent("testuser", "user@example.com");
    await expect(preAuthHandler(event)).rejects.toThrow("AccountLocked");
    // Email sent on lockout
    expect(mockSesSend).toHaveBeenCalledTimes(1);
  });

  it("resets counter when previous window has expired (> 15 minutes ago)", async () => {
    const now = Math.floor(Date.now() / 1000);
    // windowStart is 20 minutes ago — outside the 15-min window
    mockDdbSend.mockResolvedValueOnce(makeGetItemResult(5, now - 20 * 60));
    mockDdbSend.mockResolvedValueOnce({}); // PutItem with count=1

    const event = makePreAuthEvent("testuser", "user@example.com");
    // Should NOT throw — old window expired, effective count resets to 0 → 1
    const result = await preAuthHandler(event);
    expect(result).toBe(event);
  });

  it("does not throw if SES send fails (best-effort email)", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockDdbSend.mockResolvedValueOnce(makeGetItemResult(4, now - 60));
    mockDdbSend.mockResolvedValueOnce({});
    mockSesSend.mockRejectedValueOnce(new Error("SES error"));

    const event = makePreAuthEvent("testuser", "user@example.com");
    // Should still throw AccountLocked even if SES fails
    await expect(preAuthHandler(event)).rejects.toThrow("AccountLocked");
  });

  it("skips email notification when user has no email attribute", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockDdbSend.mockResolvedValueOnce(makeGetItemResult(4, now - 60));
    mockDdbSend.mockResolvedValueOnce({});

    const event = makePreAuthEvent("testuser"); // no email
    await expect(preAuthHandler(event)).rejects.toThrow("AccountLocked");
    expect(mockSesSend).not.toHaveBeenCalled();
  });
});

describe("postAuthHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the lockout record on successful authentication", async () => {
    mockDdbSend.mockResolvedValueOnce({}); // DeleteItem

    const event = makePostAuthEvent("testuser");
    const result = await postAuthHandler(event);
    expect(result).toBe(event);
    expect(mockDdbSend).toHaveBeenCalledTimes(1);

    // Verify the DeleteItem was called with the correct key
    const [deleteCall] = mockDdbSend.mock.calls;
    expect(deleteCall[0].input.Key.pk.S).toBe("LOCKOUT#testuser");
  });
});
