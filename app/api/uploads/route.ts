import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentUser } from "@/lib/auth";

/** 5 MB — comfortably more than a product photo needs, small enough to stay cheap. */
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export interface UploadResult {
  url: string;
}

/**
 * POST /api/uploads — stores one product image in Vercel Blob and returns its public URL,
 * which the caller writes into the form's existing `imageUrl` field. The product server
 * actions still only ever see a URL string, so pasting an externally hosted URL keeps
 * working exactly as before (see ProductImageField.tsx).
 *
 * Not gated on a specific role beyond "signed in": the DEMO account is already blocked
 * from every non-GET request at the proxy layer (see proxy.ts), which is where this app
 * enforces read-only rather than per-route.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Missing token means the Blob store was never connected — say so plainly rather than
  // letting the SDK throw an opaque error into the client's catch block.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Image storage is not configured (BLOB_READ_WRITE_TOKEN is missing)" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file received" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type — use JPEG, PNG, WebP, GIF, or AVIF" },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 5 MB" }, { status: 413 });
  }

  try {
    // addRandomSuffix keeps two products named "photo.jpg" from overwriting each other,
    // and stops a guessable pathname from exposing one product's image via another's name.
    const blob = await put(`products/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url } satisfies UploadResult);
  } catch {
    return NextResponse.json({ error: "Upload failed — try again" }, { status: 502 });
  }
}
