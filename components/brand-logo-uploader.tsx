"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function BrandLogoUploader({
  initialLogoUrl,
  canUpload = false,
}: {
  initialLogoUrl: string;
  canUpload?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function uploadLogo(file: File) {
    setIsUploading(true);
    setFeedbackMessage(null);

    const formData = new FormData();
    formData.set("image", file);

    const response = await fetch("/api/brand/logo", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; logoUrl?: string }
      | null;

    if (!response.ok) {
      setFeedbackMessage(payload?.error ?? "Could not upload the logo image.");
      setIsUploading(false);
      return;
    }

    if (payload?.logoUrl) {
      setLogoUrl(payload.logoUrl);
    }

    setIsUploading(false);
    setFeedbackMessage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="brand-logo-uploader">
      {canUpload ? (
        <button
          type="button"
          className="brand-logo-button brand-link-top"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Change SCM logo"
          title="Change logo"
        >
          <span className="brand-logo-frame">
            <Image
              src={logoUrl}
              alt="SCM logo"
              className="brand-logo-svg"
              fill
              sizes="152px"
              unoptimized
              priority
            />
          </span>
        </button>
      ) : (
        <span className="brand-logo-static">
          <span className="brand-logo-frame">
            <Image
              src={logoUrl}
              alt="SCM logo"
              className="brand-logo-svg"
              fill
              sizes="152px"
              unoptimized
              priority
            />
          </span>
        </span>
      )}

      {canUpload ? (
        <input
          ref={fileInputRef}
          className="gig-image-input"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(event) => {
            const nextFile = event.currentTarget.files?.[0] ?? null;
            if (!nextFile) {
              return;
            }

            void uploadLogo(nextFile);
          }}
        />
      ) : null}

      {canUpload && feedbackMessage ? (
        <p className="brand-logo-feedback">{feedbackMessage}</p>
      ) : null}
      {canUpload && (isUploading || isPending) ? (
        <p className="brand-logo-feedback">Uploading...</p>
      ) : null}
    </div>
  );
}
