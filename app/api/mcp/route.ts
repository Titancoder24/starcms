import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyApiKey } from "@/lib/auth/api-key";
import { createMcpServer } from "@/lib/mcp/server";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";

const RATE_LIMIT_PER_MIN = 60;
const RATE_LIMIT_PER_DAY = 5000;

async function checkRateLimit(keyId: string): Promise<void> {
  const now = Date.now();
  const minuteKey = `rl:min:${keyId}:${Math.floor(now / 60000)}`;
  const dayKey = `rl:day:${keyId}:${Math.floor(now / 86400000)}`;

  try {
    const { kv } = await import("@vercel/kv");
    const [minCount, dayCount] = await Promise.all([
      kv.incr(minuteKey),
      kv.incr(dayKey),
    ]);
    if (minCount === 1) await kv.expire(minuteKey, 60);
    if (dayCount === 1) await kv.expire(dayKey, 86400);

    if (minCount > RATE_LIMIT_PER_MIN) {
      throw new ApiError("rate-limited", "Rate limit exceeded: 60 calls/minute", 429);
    }
    if (dayCount > RATE_LIMIT_PER_DAY) {
      throw new ApiError("rate-limited", "Rate limit exceeded: 5000 calls/day", 429);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // KV unavailable — allow through
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return Response.json({ error: "Missing Authorization header" }, { status: 401 });
  }

  let ctx;
  try {
    ctx = await verifyApiKey(token);
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : "Unauthorized";
    return Response.json({ error: msg }, { status: 401 });
  }

  try {
    await checkRateLimit(ctx.keyId);
  } catch (err) {
    if (err instanceof ApiError && err.code === "rate-limited") {
      return Response.json({ error: err.message }, { status: 429 });
    }
  }

  const server = createMcpServer(ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    const body = await req.json() as unknown;
    // Use ReadableStream to pass the request body to the transport
    const textBody = JSON.stringify(body);
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => { headers[k] = v; });

    // Create a mock Node.js-style request for the transport
    const { Readable } = await import("stream");
    const mockReq = Object.assign(Readable.from([textBody]), {
      headers,
      method: "POST",
      url: "/",
      socket: { remoteAddress: "127.0.0.1" },
    });

    const chunks: Buffer[] = [];
    let statusCode = 200;
    const mockRes = {
      writeHead: (code: number) => { statusCode = code; },
      write: (chunk: Buffer | string) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); },
      end: (chunk?: Buffer | string) => { if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); },
      setHeader: () => undefined,
      getHeader: () => undefined,
    };

    await transport.handleRequest(mockReq as never, mockRes as never);

    const responseBody = Buffer.concat(chunks).toString("utf-8");
    return new Response(responseBody || '{"result":null}', {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({
    status: "StarCMS MCP endpoint",
    info: "Send POST requests with Authorization: Bearer <api-key>.",
    docs: "/docs/mcp.md",
  });
}
