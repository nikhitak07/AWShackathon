"use strict";
/**
 * Unit tests for account lockout trigger logic.
 * Requirements: 7.6
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// ---------------------------------------------------------------------------
// Mock AWS SDK clients before importing the module under test
// ---------------------------------------------------------------------------
const mockDdbSend = vitest_1.vi.fn();
const mockSesSend = vitest_1.vi.fn();
vitest_1.vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vitest_1.vi.fn(() => ({ send: mockDdbSend })),
    GetItemCommand: vitest_1.vi.fn((input) => ({ input, _type: "GetItem" })),
    PutItemCommand: vitest_1.vi.fn((input) => ({ input, _type: "PutItem" })),
    DeleteItemCommand: vitest_1.vi.fn((input) => ({ input, _type: "DeleteItem" })),
}));
vitest_1.vi.mock("@aws-sdk/client-ses", () => ({
    SESClient: vitest_1.vi.fn(() => ({ send: mockSesSend })),
    SendEmailCommand: vitest_1.vi.fn((input) => ({ input, _type: "SendEmail" })),
}));
// Set env vars before importing
process.env.LOCKOUT_TABLE_NAME = "auth_lockout";
process.env.SES_FROM_ADDRESS = "no-reply@example.com";
const lockoutTriggers_1 = require("./lockoutTriggers");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePreAuthEvent(username, email) {
    return {
        userName: username,
        request: {
            userAttributes: email ? { email } : {},
        },
    };
}
function makePostAuthEvent(username) {
    return {
        userName: username,
        request: { userAttributes: {} },
    };
}
function makeGetItemResult(count, windowStart) {
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
(0, vitest_1.describe)("preAuthHandler", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockSesSend.mockResolvedValue({});
    });
    (0, vitest_1.it)("allows login when no prior failed attempts exist", async () => {
        mockDdbSend.mockResolvedValueOnce({ Item: undefined }); // GetItem: no record
        mockDdbSend.mockResolvedValueOnce({}); // PutItem: write count=1
        const event = makePreAuthEvent("testuser", "user@example.com");
        const result = await (0, lockoutTriggers_1.preAuthHandler)(event);
        (0, vitest_1.expect)(result).toBe(event);
    });
    (0, vitest_1.it)("allows login when failed attempts are below threshold", async () => {
        const now = Math.floor(Date.now() / 1000);
        mockDdbSend.mockResolvedValueOnce(makeGetItemResult(3, now - 60)); // 3 attempts, within window
        mockDdbSend.mockResolvedValueOnce({}); // PutItem
        const event = makePreAuthEvent("testuser", "user@example.com");
        const result = await (0, lockoutTriggers_1.preAuthHandler)(event);
        (0, vitest_1.expect)(result).toBe(event);
    });
    (0, vitest_1.it)("throws and sends email when count reaches 5 (lockout on 5th attempt)", async () => {
        const now = Math.floor(Date.now() / 1000);
        // 4 prior attempts — this call increments to 5 → lockout
        mockDdbSend.mockResolvedValueOnce(makeGetItemResult(4, now - 60));
        mockDdbSend.mockResolvedValueOnce({}); // PutItem
        const event = makePreAuthEvent("testuser", "user@example.com");
        await (0, vitest_1.expect)((0, lockoutTriggers_1.preAuthHandler)(event)).rejects.toThrow("AccountLocked");
        (0, vitest_1.expect)(mockSesSend).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("throws immediately when count is already >= 5 (account already locked)", async () => {
        const now = Math.floor(Date.now() / 1000);
        mockDdbSend.mockResolvedValueOnce(makeGetItemResult(5, now - 60));
        const event = makePreAuthEvent("testuser", "user@example.com");
        await (0, vitest_1.expect)((0, lockoutTriggers_1.preAuthHandler)(event)).rejects.toThrow("AccountLocked");
        // Email sent on lockout
        (0, vitest_1.expect)(mockSesSend).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("resets counter when previous window has expired (> 15 minutes ago)", async () => {
        const now = Math.floor(Date.now() / 1000);
        // windowStart is 20 minutes ago — outside the 15-min window
        mockDdbSend.mockResolvedValueOnce(makeGetItemResult(5, now - 20 * 60));
        mockDdbSend.mockResolvedValueOnce({}); // PutItem with count=1
        const event = makePreAuthEvent("testuser", "user@example.com");
        // Should NOT throw — old window expired, effective count resets to 0 → 1
        const result = await (0, lockoutTriggers_1.preAuthHandler)(event);
        (0, vitest_1.expect)(result).toBe(event);
    });
    (0, vitest_1.it)("does not throw if SES send fails (best-effort email)", async () => {
        const now = Math.floor(Date.now() / 1000);
        mockDdbSend.mockResolvedValueOnce(makeGetItemResult(4, now - 60));
        mockDdbSend.mockResolvedValueOnce({});
        mockSesSend.mockRejectedValueOnce(new Error("SES error"));
        const event = makePreAuthEvent("testuser", "user@example.com");
        // Should still throw AccountLocked even if SES fails
        await (0, vitest_1.expect)((0, lockoutTriggers_1.preAuthHandler)(event)).rejects.toThrow("AccountLocked");
    });
    (0, vitest_1.it)("skips email notification when user has no email attribute", async () => {
        const now = Math.floor(Date.now() / 1000);
        mockDdbSend.mockResolvedValueOnce(makeGetItemResult(4, now - 60));
        mockDdbSend.mockResolvedValueOnce({});
        const event = makePreAuthEvent("testuser"); // no email
        await (0, vitest_1.expect)((0, lockoutTriggers_1.preAuthHandler)(event)).rejects.toThrow("AccountLocked");
        (0, vitest_1.expect)(mockSesSend).not.toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("postAuthHandler", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("deletes the lockout record on successful authentication", async () => {
        mockDdbSend.mockResolvedValueOnce({}); // DeleteItem
        const event = makePostAuthEvent("testuser");
        const result = await (0, lockoutTriggers_1.postAuthHandler)(event);
        (0, vitest_1.expect)(result).toBe(event);
        (0, vitest_1.expect)(mockDdbSend).toHaveBeenCalledTimes(1);
        // Verify the DeleteItem was called with the correct key
        const [deleteCall] = mockDdbSend.mock.calls;
        (0, vitest_1.expect)(deleteCall[0].input.Key.pk.S).toBe("LOCKOUT#testuser");
    });
});
