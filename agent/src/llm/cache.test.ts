import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { PromptCache, disabledCache } from "./cache.ts";

describe("PromptCache", () => {
  let cache: PromptCache;

  beforeEach(async () => {
    cache = new PromptCache(await mkdtemp(join(tmpdir(), "agent-cache-")), true);
  });

  it("returns undefined before anything is stored", async () => {
    expect(await cache.get(["model", "schema", "system", "user"])).toBeUndefined();
  });

  it("round-trips a stored response", async () => {
    await cache.set(["m", "s", "sys", "usr"], '{"ok":true}');
    expect(await cache.get(["m", "s", "sys", "usr"])).toBe('{"ok":true}');
  });

  it("misses when any part of the request differs", async () => {
    await cache.set(["m", "s", "sys", "usr"], "value");

    expect(await cache.get(["other-model", "s", "sys", "usr"])).toBeUndefined();
    expect(await cache.get(["m", "s", "sys", "different prompt"])).toBeUndefined();
  });

  it("cannot be confused by shifting a character between parts", async () => {
    // Length-prefixed keys: ["ab","c"] and ["a","bc"] must not collide.
    await cache.set(["ab", "c"], "first");
    expect(await cache.get(["a", "bc"])).toBeUndefined();
  });

  it("counts hits and misses", async () => {
    await cache.set(["a", "b"], "v");
    await cache.get(["a", "b"]);
    await cache.get(["nope"]);

    expect(cache.stats()).toMatchObject({ hits: 1, misses: 1, enabled: true });
  });

  it("never hits when disabled, and stores nothing", async () => {
    const off = disabledCache();
    await off.set(["a"], "v");

    expect(await off.get(["a"])).toBeUndefined();
    expect(off.stats().enabled).toBe(false);
  });
});
