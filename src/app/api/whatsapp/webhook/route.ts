import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { timingSafeEqual } from "crypto";

/**
 * WhatsApp Cloud API webhook.
 * Verifies Meta challenge and upgrades delivery status when confirmed.
 * Never exposes tokens or tenant internals.
 */
function tokensMatch(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (
    mode === "subscribe" &&
    expected &&
    token &&
    challenge &&
    tokensMatch(token, expected)
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (appSecret) {
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const crypto = await import("crypto");
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
    if (!tokensMatch(signature, expected)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const statuses =
      (
        body as {
          entry?: Array<{
            changes?: Array<{
              value?: {
                statuses?: Array<{
                  id?: string;
                  status?: string;
                  timestamp?: string;
                  errors?: Array<{ code?: number; title?: string }>;
                }>;
              };
            }>;
          }>;
        }
      ).entry?.flatMap((e) =>
        e.changes?.flatMap((c) => c.value?.statuses ?? []) ?? []
      ) ?? [];

    if (statuses.length) {
      const supabase = createServiceClient();
      for (const s of statuses) {
        if (!s?.id) continue;
        if (s.status === "delivered" || s.status === "read") {
          await supabase
            .from("whatsapp_invoice_deliveries")
            .update({
              status: "delivered",
              delivered_at: new Date(
                Number(s.timestamp || Date.now() / 1000) * 1000
              ).toISOString(),
            })
            .eq("provider_message_id", s.id)
            .in("status", ["pending", "sent"]);
        } else if (s.status === "failed") {
          await supabase
            .from("whatsapp_invoice_deliveries")
            .update({
              status: "failed",
              failed_at: new Date().toISOString(),
              error_code: String(s.errors?.[0]?.code ?? "provider_failed"),
              error_message: s.errors?.[0]?.title?.slice(0, 500) ?? "failed",
            })
            .eq("provider_message_id", s.id);
        }
      }
    }
  } catch (err) {
    console.error("whatsapp webhook processing error", err);
  }

  return NextResponse.json({ ok: true });
}
