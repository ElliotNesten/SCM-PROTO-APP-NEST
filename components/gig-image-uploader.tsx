"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function GigImageUploader({
  gigId,
  artist,
  initialImageUrl,
}: {
  gigId: string;
  artist: string;
  initialImageUrl?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialImageUrl);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function uploadImage(file: File) {
    setIsUploading(true);
    setFeedbackMessage(null);

    const formData = new FormData();
    formData.set("image", file);

    const response = await fetch(`/api/gigs/${gigId}/image`, {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; profileImageUrl?: string }
      | null;

    if (!response.ok) {
      setFeedbackMessage(payload?.error ?? "Could not upload the gig image.");
      setIsUploading(false);
      return;
    }

    setImageUrl(payload?.profileImageUrl);
    setFeedbackMessage(null);
    setIsUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="gig-image-uploader compact">
      <div className="gig-image-preview compact">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${artist} gig image`}
            fill
            sizes="88px"
            className="gig-image-preview-media"
          />
        ) : (
          <span>{artist.charAt(0)}</span>
        )}
      </div>

      <label className="gig-image-trigger compact" htmlFor={`gig-image-${gigId}`}>
        {isUploading || isPending ? "Uploading..." : "Change image"}
      </label>

      <input
        id={`gig-image-${gigId}`}
        ref={fileInputRef}
        className="gig-image-input"
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const nextFile = event.currentTarget.files?.[0] ?? null;
          if (!nextFile) {
            return;
          }

          void uploadImage(nextFile);
        }}
      />

      {feedbackMessage ? <p className="small-text gig-image-feedback">{feedbackMessage}</p> : null}
    </div>
  );
}
