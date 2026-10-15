import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { generateFitAnswer, LocalLlmError } from "../src/lib/localLlm";
import { POST } from "../src/app/api/ai/fit/route";

const input = { jobTitle: "Engineer", jobDescription: "TypeScript", companyName: "Example", resumeText: "Built TypeScript applications." };

test("local LLM request, configuration, failures and route validation", async () => {
  const originalFetch = globalThis.fetch;
  const keys = ["LOCAL_LLM_BASE_URL", "LOCAL_LLM_MODEL", "LOCAL_LLM_API_KEY", "VERCEL"];
  const saved = keys.map(key => process.env[key]);
  for (const key of keys) delete process.env[key];
  const request = (body: unknown) => new NextRequest("http://localhost/api/ai/fit", {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  });
  try {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(String(url), "http://127.0.0.1:11435/v1/chat/completions");
      const payload = JSON.parse(options!.body as string);
      assert.equal(payload.model, "qwen2.5:3b");
      assert.equal(payload.stream, false);
      assert.equal(JSON.parse(payload.messages[1].content).resume, input.resumeText);
      return Response.json({ choices: [{ message: { content: "I build TypeScript applications." } }] });
    };
    assert.equal((await POST(request({ ...input, resumeText: "" }))).status, 400);
    assert.equal((await POST(request({ ...input, jobTitle: 123 }))).status, 400);
    assert.equal((await POST(request({ ...input, resumeText: "x".repeat(100001) }))).status, 413);
    assert.equal(calls, 0);
    const response = await POST(request(input));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { fitReason: "I build TypeScript applications." });

    process.env.LOCAL_LLM_BASE_URL = "http://127.0.0.1:1234/v1/";
    process.env.LOCAL_LLM_MODEL = "test-model";
    process.env.LOCAL_LLM_API_KEY = "test-key";
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "http://127.0.0.1:1234/v1/chat/completions");
      assert.equal((options!.headers as Record<string, string>).Authorization, "Bearer test-key");
      assert.equal(JSON.parse(options!.body as string).model, "test-model");
      return Response.json({ choices: [{ message: { content: "word ".repeat(120) } }] });
    };
    assert.equal((await generateFitAnswer(input)).split(" ").length, 100);

    globalThis.fetch = async () => new Response(null, { status: 404 });
    assert.equal((await POST(request(input))).status, 502);
    globalThis.fetch = async () => Response.json({ choices: [] });
    await assert.rejects(generateFitAnswer(input), /empty or unsupported/);
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    assert.equal((await POST(request(input))).status, 503);
    globalThis.fetch = async () => { throw new DOMException("timeout", "TimeoutError"); };
    assert.equal((await POST(request(input))).status, 504);

    process.env.VERCEL = "1";
    await assert.rejects(generateFitAnswer(input), error => error instanceof LocalLlmError && error.status === 503 && /Vercel/.test(error.message));
    process.env.LOCAL_LLM_BASE_URL = "file:///tmp/model";
    await assert.rejects(generateFitAnswer(input), /HTTP\(S\)/);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => {
      if (saved[i] === undefined) delete process.env[key];
      else process.env[key] = saved[i];
    });
  }
});
