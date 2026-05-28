import { describe, expect, it } from "vitest";
import app from "../src/index.ts";
import { createApiTestEnv } from "./helpers.ts";

describe("admin api auth", () => {
  it("rejects unauthenticated access to visitor list", async () => {
    const response = await app.request("/admin/api/visitors", undefined, createApiTestEnv());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("allows configured production origins", async () => {
    const response = await app.request(
      "/health",
      {
        headers: {
          Origin: "https://antimatch.example",
        },
      },
      createApiTestEnv({ APP_ENV: "production" }),
    );

    expect(response.headers.get("access-control-allow-origin")).toBe("https://antimatch.example");
  });

  it("does not allow origins outside the configured production allowlist", async () => {
    const response = await app.request(
      "/health",
      {
        headers: {
          Origin: "https://evil.example",
        },
      },
      createApiTestEnv({ APP_ENV: "production" }),
    );

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});