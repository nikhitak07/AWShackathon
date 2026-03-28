"use strict";
/**
 * Unit tests for checklist persistence.
 * Requirements: 5.1, 5.2, 5.3, 9.3
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const { mockSend } = vitest_1.vi.hoisted(() => ({ mockSend: vitest_1.vi.fn() }));
vitest_1.vi.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: vitest_1.vi.fn().mockImplementation(() => ({})),
}));
vitest_1.vi.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: { from: vitest_1.vi.fn().mockReturnValue({ send: mockSend }) },
    PutCommand: vitest_1.vi.fn().mockImplementation((input) => ({ input })),
    GetCommand: vitest_1.vi.fn().mockImplementation((input) => ({ input })),
    UpdateCommand: vitest_1.vi.fn().mockImplementation((input) => ({ input })),
    DeleteCommand: vitest_1.vi.fn().mockImplementation((input) => ({ input })),
    QueryCommand: vitest_1.vi.fn().mockImplementation((input) => ({ input })),
}));
const checklist_1 = require("./checklist");
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const makeChecklist = (userId, id = "cl-1") => ({
    id,
    userId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
        { id: "item-1", text: "Take aspirin 81mg", category: "Medications", priority: "Routine", completed: false },
    ],
});
const makeEvent = (overrides = {}) => ({
    body: null,
    headers: {},
    pathParameters: null,
    queryStringParameters: null,
    requestContext: { authorizer: { claims: { sub: "user-a" } } },
    ...overrides,
});
(0, vitest_1.beforeEach)(() => vitest_1.vi.clearAllMocks());
// ---------------------------------------------------------------------------
// Test: cross-user access is denied (Req 5.4, 8.6)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("cross-user access control", () => {
    (0, vitest_1.it)("saveHandler returns 403 when JWT userId does not match checklist userId", async () => {
        const cl = makeChecklist("user-b");
        const event = makeEvent({
            body: JSON.stringify(cl),
            requestContext: { authorizer: { claims: { sub: "user-a" } } },
        });
        const res = await (0, checklist_1.saveHandler)(event, {}, () => { });
        (0, vitest_1.expect)(res?.statusCode).toBe(403);
    });
    (0, vitest_1.it)("getHandler returns 403 when JWT userId does not match target userId", async () => {
        const event = makeEvent({
            pathParameters: { checklistId: "cl-1" },
            queryStringParameters: { userId: "user-b" },
            requestContext: { authorizer: { claims: { sub: "user-a" } } },
        });
        const res = await (0, checklist_1.getHandler)(event, {}, () => { });
        (0, vitest_1.expect)(res?.statusCode).toBe(403);
    });
    (0, vitest_1.it)("deleteHandler returns 403 when JWT userId does not match target userId", async () => {
        const event = makeEvent({
            pathParameters: { checklistId: "cl-1" },
            queryStringParameters: { userId: "user-b" },
            requestContext: { authorizer: { claims: { sub: "user-a" } } },
        });
        const res = await (0, checklist_1.deleteHandler)(event, {}, () => { });
        (0, vitest_1.expect)(res?.statusCode).toBe(403);
    });
    (0, vitest_1.it)("getChecklist for user-a cannot retrieve user-b's checklist via key mismatch", async () => {
        // DynamoDB returns nothing because pk won't match
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const result = await (0, checklist_1.getChecklist)("user-a", "cl-owned-by-b");
        (0, vitest_1.expect)(result).toBeNull();
    });
});
// ---------------------------------------------------------------------------
// Test: 30-day TTL is set correctly on save (Req 5.2)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("TTL on save", () => {
    (0, vitest_1.it)("ttlInSeconds returns a value ~30 days from now", () => {
        const now = Math.floor(Date.now() / 1000);
        const ttl = (0, checklist_1.ttlInSeconds)();
        const thirtyDays = 30 * 24 * 60 * 60;
        (0, vitest_1.expect)(ttl).toBeGreaterThanOrEqual(now + thirtyDays - 5);
        (0, vitest_1.expect)(ttl).toBeLessThanOrEqual(now + thirtyDays + 5);
    });
    (0, vitest_1.it)("saveChecklist sends a PutCommand with a ttl field set", async () => {
        mockSend.mockResolvedValueOnce({});
        const { PutCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/lib-dynamodb")));
        await (0, checklist_1.saveChecklist)(makeChecklist("user-a"));
        const callArg = PutCommand.mock.calls[0][0];
        (0, vitest_1.expect)(callArg.Item.ttl).toBeDefined();
        (0, vitest_1.expect)(typeof callArg.Item.ttl).toBe("number");
    });
    (0, vitest_1.it)("saveChecklist uses correct pk/sk key schema", async () => {
        mockSend.mockResolvedValueOnce({});
        const { PutCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/lib-dynamodb")));
        const cl = makeChecklist("user-a", "cl-42");
        await (0, checklist_1.saveChecklist)(cl);
        const callArg = PutCommand.mock.calls[0][0];
        (0, vitest_1.expect)(callArg.Item.pk).toBe("USER#user-a");
        (0, vitest_1.expect)(callArg.Item.sk).toBe("CHECKLIST#cl-42");
    });
});
// ---------------------------------------------------------------------------
// Test: storage-unavailable error path (Req 5.3)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("storage-unavailable error surface", () => {
    (0, vitest_1.it)("saveHandler returns 503 when DynamoDB throws", async () => {
        mockSend.mockRejectedValueOnce(new Error("DynamoDB unavailable"));
        const cl = makeChecklist("user-a");
        const event = makeEvent({ body: JSON.stringify(cl) });
        const res = await (0, checklist_1.saveHandler)(event, {}, () => { });
        (0, vitest_1.expect)(res?.statusCode).toBe(503);
        (0, vitest_1.expect)(JSON.parse(res?.body ?? "{}").error).toMatch(/storage unavailable/i);
    });
    (0, vitest_1.it)("getHandler returns 503 when DynamoDB throws", async () => {
        mockSend.mockRejectedValueOnce(new Error("DynamoDB unavailable"));
        const event = makeEvent({
            pathParameters: { checklistId: "cl-1" },
            queryStringParameters: { userId: "user-a" },
        });
        const res = await (0, checklist_1.getHandler)(event, {}, () => { });
        (0, vitest_1.expect)(res?.statusCode).toBe(503);
    });
    (0, vitest_1.it)("deleteHandler returns 503 when DynamoDB throws", async () => {
        mockSend.mockRejectedValueOnce(new Error("DynamoDB unavailable"));
        const event = makeEvent({
            pathParameters: { checklistId: "cl-1" },
            queryStringParameters: { userId: "user-a" },
        });
        const res = await (0, checklist_1.deleteHandler)(event, {}, () => { });
        (0, vitest_1.expect)(res?.statusCode).toBe(503);
    });
});
// ---------------------------------------------------------------------------
// Test: happy path — save and retrieve
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("save and retrieve", () => {
    (0, vitest_1.it)("getChecklist returns the checklist when found", async () => {
        const cl = makeChecklist("user-a");
        mockSend.mockResolvedValueOnce({ Item: { checklist: cl } });
        const result = await (0, checklist_1.getChecklist)("user-a", "cl-1");
        (0, vitest_1.expect)(result).toEqual(cl);
    });
    (0, vitest_1.it)("getChecklist returns null when item not found", async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        const result = await (0, checklist_1.getChecklist)("user-a", "cl-missing");
        (0, vitest_1.expect)(result).toBeNull();
    });
    (0, vitest_1.it)("deleteChecklist sends DeleteCommand with correct key", async () => {
        mockSend.mockResolvedValueOnce({});
        const { DeleteCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/lib-dynamodb")));
        await (0, checklist_1.deleteChecklist)("user-a", "cl-1");
        const callArg = DeleteCommand.mock.calls[0][0];
        (0, vitest_1.expect)(callArg.Key).toEqual({ pk: "USER#user-a", sk: "CHECKLIST#cl-1" });
    });
});
// ---------------------------------------------------------------------------
// Test: key helpers
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("key helpers", () => {
    (0, vitest_1.it)("makePk formats correctly", () => {
        (0, vitest_1.expect)((0, checklist_1.makePk)("user-123")).toBe("USER#user-123");
    });
    (0, vitest_1.it)("makeSk formats correctly", () => {
        (0, vitest_1.expect)((0, checklist_1.makeSk)("cl-abc")).toBe("CHECKLIST#cl-abc");
    });
});
