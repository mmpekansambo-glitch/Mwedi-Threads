import { describe, expect, it, vi } from "vitest";

describe("database pool", () => {
  it("logs a dropped idle connection instead of crashing the server", async () => {
    process.env.DATABASE_URL ??= "postgresql://postgres@localhost:5432/unused";
    const { pool } = await import("@workspace/db");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(pool.listenerCount("error")).toBeGreaterThan(0);
    expect(() => pool.emit("error", new Error("terminating connection due to administrator command"))).not.toThrow();
    expect(log).toHaveBeenCalledWith("Postgres pool: idle connection error", "terminating connection due to administrator command");
    log.mockRestore();
  });
});
