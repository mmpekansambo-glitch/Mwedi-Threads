import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, createSign } from "node:crypto";
import type { Server } from "node:http";
import { PgDialect } from "drizzle-orm/pg-core";

const { mockSelect, clerkSetupShouldFail, clerkHostArguments } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  clerkSetupShouldFail: { value: false },
  clerkHostArguments: [] as string[],
}));

vi.mock("../lib/users", () => ({ ensureUserRow: async () => undefined }));

vi.mock("@workspace/db", async () => {
  const schema = await vi.importActual<typeof import("@workspace/db/schema")>(
    "@workspace/db/schema",
  );
  return {
    ...schema,
    db: {
      select: mockSelect,
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

vi.mock("@clerk/shared/keys", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@clerk/shared/keys")>();
  return {
    ...actual,
    publishableKeyFromHost: (
      ...args: Parameters<typeof actual.publishableKeyFromHost>
    ) => {
      clerkHostArguments.push(args[0]);
      if (clerkSetupShouldFail.value) {
        throw new Error("CLERK_INTERNAL_SETUP_STACK_SENTINEL");
      }
      return actual.publishableKeyFromHost(...args);
    },
  };
});

const userId = "user_valid-session";
const forgedUserId = "user_forged-header";
const publishableKey = `pk_test_${Buffer.from("test.clerk.accounts.dev$").toString("base64").replace(/=+$/, "")}`;

let server: Server;
let baseUrl: string;
let privateKey: string;
let invalidPrivateKey: string;
let capturedCondition: unknown;
let previousEnvironment: Record<string, string | undefined>;

function createSessionToken(signingKey: string, forUserId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-key" }),
  ).toString("base64url");
  const encodedClaims = Buffer.from(
    JSON.stringify({
      iss: "https://test.clerk.accounts.dev",
      sub: forUserId,
      sid: "sess_test-session",
      iat: now,
      nbf: now - 1,
      exp: now + 60,
      azp: baseUrl,
    }),
  ).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(signingKey, "base64url")}`;
}

function validSessionToken(forUserId: string): string {
  return createSessionToken(privateKey, forUserId);
}

async function request(options: {
  sessionToken?: string;
  headers?: Record<string, string>;
} = {}) {
  return fetch(`${baseUrl}/api/projects`, {
    headers: {
      ...options.headers,
      ...(options.sessionToken
        ? { authorization: `Bearer ${options.sessionToken}` }
        : {}),
    },
  });
}

beforeAll(async () => {
  previousEnvironment = {
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
    CLERK_JWT_KEY: process.env.CLERK_JWT_KEY,
    REPLIT_DOMAINS: process.env.REPLIT_DOMAINS,
    REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
  };
  const keys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const invalidKeys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  privateKey = keys.privateKey;
  invalidPrivateKey = invalidKeys.privateKey;
  process.env.CLERK_PUBLISHABLE_KEY = publishableKey;
  process.env.CLERK_JWT_KEY = keys.publicKey;

  mockSelect.mockImplementation(() => {
    const query = {
      from: () => query,
      where: (condition: unknown) => {
        capturedCondition = condition;
        return query;
      },
      orderBy: async () => [],
    };
    return query;
  });

  const { default: app } = await import("../app");
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not start.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

afterEach(() => {
  for (const name of ["REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN"]) {
    const value = previousEnvironment[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("Clerk-backed API authentication", () => {
  it("uses the configured production host for Clerk key selection", async () => {
    process.env.REPLIT_DOMAINS = "threads.example.com";
    process.env.REPLIT_DEV_DOMAIN = "";
    clerkHostArguments.length = 0;

    const response = await request({
      headers: {
        "x-forwarded-host": "threads.example.com",
      },
    });

    expect(response.status).toBe(401);
    expect(clerkHostArguments.at(-1)).toBe("threads.example.com");
  });

  it("does not use an unconfigured forwarded host for Clerk key selection", async () => {
    process.env.REPLIT_DOMAINS = "threads.example.com";
    process.env.REPLIT_DEV_DOMAIN = "";
    clerkHostArguments.length = 0;

    const response = await request({
      headers: {
        "x-forwarded-host": "attacker.example",
      },
    });

    expect(response.status).toBe(401);
    expect(clerkHostArguments.at(-1)).toBe("");
  });

  it("rejects requests without a session or with an invalid session", async () => {
    const withoutSession = await request();
    const invalidSession = await request({
      sessionToken: createSessionToken(invalidPrivateKey, userId),
    });

    expect(withoutSession.status).toBe(401);
    expect(invalidSession.status).toBe(401);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("uses the Clerk session identity and ignores client-supplied user headers", async () => {
    capturedCondition = undefined;
    const response = await request({
      sessionToken: validSessionToken(userId),
      headers: {
        "x-test-user": forgedUserId,
        "x-user-id": forgedUserId,
        "x-clerk-user-id": forgedUserId,
      },
    });

    expect(response.status).toBe(200);
    const query = new PgDialect().sqlToQuery(capturedCondition as never);
    expect(query.params).toContain(userId);
    expect(query.params).not.toContain(forgedUserId);
  });

  it("returns a generic JSON error when Clerk authentication setup throws", async () => {
    const internalDetails = "CLERK_INTERNAL_SETUP_STACK_SENTINEL";
    clerkSetupShouldFail.value = true;
    try {
      const response = await request();
      const body = await response.text();

      expect(response.status).toBe(500);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(body).toContain("An unexpected error occurred.");
      expect(body).not.toContain(internalDetails);
      expect(body).not.toContain("Error:");
      expect(body).not.toContain("at ");
    } finally {
      clerkSetupShouldFail.value = false;
    }
  });
});
