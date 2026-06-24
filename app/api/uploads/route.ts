import { NextResponse } from "next/server";
import { ensureAdminOrPosApiKey } from "@/lib/pos-or-admin-auth";

export async function POST(request: Request) {
  try {
    const authError = await ensureAdminOrPosApiKey(request);
    if (authError) return authError;

    const workerUrl = process.env.WORKER_UPLOAD_URL;
    const workerApiKey = process.env.WORKER_UPLOAD_API_KEY;

    if (!workerUrl || !workerApiKey) {
      return NextResponse.json(
        { error: "Upload worker configuration missing" },
        { status: 500 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    const key = `${Date.now()}-${crypto.randomUUID()}-${file.name}`.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    // Forward to worker to perform the actual R2 put
    const upstream = new FormData();
    upstream.append(
      "file",
      new Blob([Buffer.from(await file.arrayBuffer())], {
        type: file.type || "application/octet-stream",
      }),
      file.name
    );
    upstream.append("key", key);
    upstream.append("contentType", file.type || "application/octet-stream");

    const workerRes = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "x-api-key": workerApiKey,
      },
      body: upstream,
    });

    if (!workerRes.ok) {
      const error = await workerRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error || "Upload worker failed" },
        { status: workerRes.status }
      );
    }

    const result = await workerRes.json();
    return NextResponse.json({ url: result.url, key: result.key });
  } catch (error: unknown) {
    console.error("Upload failed:", error);
    return NextResponse.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

