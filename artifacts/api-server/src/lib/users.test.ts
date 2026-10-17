import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockGetUser, selectRows, insertedValues } = vi.hoisted(() => {
  const selectRows: { value: Array<{ email: string | null }> } = { value: [] };
  const insertedValues: unknown[] = [];
  const mockDb = {
    select: vi.fn(() => ({
      from: () => ({ where: async () => selectRows.value }),
    })),
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        insertedValues.push(values);
        return { onConflictDoUpdate: async () => undefined };
      },
    })),
  };
  return { mockDb, mockGetUser: vi.fn(), selectRows, insertedValues };
});

vi.mock("@workspace/db", async () => {
  const schema = await vi.importActual<typeof import("@workspace/db/schema")>(
    "@workspace/db/schema",
  );
  return { ...schema, db: mockDb };
});

vi.mock("@clerk/express", () => ({
  clerkClient: { users: { getUser: mockGetUser } },
}));

vi.mock("./logger", () => ({ logger: { warn: vi.fn() } }));

import { ensureUserRow, forgetCompleteUsersForTests } from "./users";

const userId = "user_ngwe";

beforeEach(() => {
  forgetCompleteUsersForTests();
  vi.clearAllMocks();
  selectRows.value = [];
  insertedValues.length = 0;
  process.env.CLERK_SECRET_KEY = "sk_test_placeholder";
  mockGetUser.mockResolvedValue({
    firstName: "Ngwe",
    lastName: null,
    username: null,
    primaryEmailAddress: { emailAddress: "ngwe@example.com" },
  });
});

describe("ensureUserRow", () => {
  it("creates a users row with Clerk details on the first request", async () => {
    await ensureUserRow(userId);

    expect(mockGetUser).toHaveBeenCalledWith(userId);
    expect(insertedValues).toEqual([
      { id: userId, email: "ngwe@example.com", displayName: "Ngwe" },
    ]);
  });

  it("does nothing more once the row has an email", async () => {
    selectRows.value = [{ email: "ngwe@example.com" }];

    await ensureUserRow(userId);
    await ensureUserRow(userId);

    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("fills in the email and name for an existing owner whose row is blank", async () => {
    selectRows.value = [{ email: null }];

    await ensureUserRow(userId);

    expect(insertedValues).toEqual([
      { id: userId, email: "ngwe@example.com", displayName: "Ngwe" },
    ]);
  });

  it("still creates the row when Clerk can't be reached, and retries next time", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Clerk is down"));

    await ensureUserRow(userId);
    await ensureUserRow(userId);

    expect(insertedValues).toEqual([
      { id: userId, email: null, displayName: null },
      { id: userId, email: "ngwe@example.com", displayName: "Ngwe" },
    ]);
  });
});
