import { NextResponse } from "next/server";
import { ensureStaffOrPosApiKey } from "@/lib/pos-or-admin-auth";
import {
  contentTypeFromFileName,
  sniffImageContentType,
} from "@/lib/product-image";

export async function POST(request: Request) {
  try {
    const authError = await ensureStaffOrPosApiKey(request);
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffImageContentType(buffer);
    const fromName = contentTypeFromFileName(file.name);
    const contentType = sniffed || fromName || file.type || "";

    if (contentType === "image/heic" || contentType === "image/heif") {
      return NextResponse.json(
        {
          error:
            "HEIC photos are not supported on the website. Please upload a JPG, PNG, or WebP.",
        },
        { status: 400 }
      );
    }

    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "File is not a supported image (JPG, PNG, WebP, GIF)" },
        { status: 400 }
      );
    }

    const ext =
      contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : contentType === "image/gif"
            ? "gif"
            : "jpg";

    const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.[^.]+$/, "");
    const key = `${Date.now()}-${crypto.randomUUID()}-${safeBase}.${ext}`;

    const upstream = new FormData();
    upstream.append(
      "file",
      new Blob([buffer], { type: contentType }),
      `${safeBase}.${ext}`
    );
    upstream.append("key", key);
    upstream.append("contentType", contentType);

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
