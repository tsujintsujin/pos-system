"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import { apiPath } from "@/lib/base-path";
import type { UploadResult } from "@/app/api/uploads/route";

/**
 * Product image: upload a file, or paste a URL.
 *
 * The upload posts to /api/uploads (Vercel Blob) and writes the resulting public URL into
 * the same `imageUrl` text input the form always had. That's deliberate — the product
 * server actions still receive nothing but a URL string, so createProduct/updateProduct
 * needed no changes, and an externally hosted URL keeps working exactly as before.
 */
export default function ProductImageField({
  defaultValue = "",
  productName,
}: {
  defaultValue?: string;
  productName?: string;
}) {
  const [url, setUrl] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(apiPath("/api/uploads"), { method: "POST", body });
      const data = (await res.json()) as UploadResult & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("Upload failed — check your connection and try again");
    } finally {
      setUploading(false);
      // Let the same file be re-picked after an error.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-text-muted">Product image</span>

      <div className="flex flex-wrap items-start gap-4">
        {url ? (
          <Image
            src={url}
            alt={productName ? `${productName} preview` : "Product image preview"}
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 rounded-md border border-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs text-text-muted">
            None
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="sr-only"
              id="product-image-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploading}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload image"}
            </Button>
            {url && !uploading && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setUrl("")}>
                Remove
              </Button>
            )}
            <span className="text-xs text-text-muted">JPEG, PNG, WebP, GIF or AVIF · max 5 MB</span>
          </div>

          <label htmlFor="imageUrl" className="text-xs font-medium text-text-muted">
            Image URL
          </label>
          <Input
            id="imageUrl"
            name="imageUrl"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/product-photo.jpg"
          />
          <p className="text-xs text-text-muted">
            Uploading fills this in for you. You can still paste the URL of an image hosted
            somewhere else instead.
          </p>

          {error && (
            <p role="alert" className="text-xs font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
