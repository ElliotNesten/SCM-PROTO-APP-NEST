"use client";

import { useState } from "react";

function getDisplayInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function StaffApplicationAvatar({
  fullName,
  imageUrl,
}: {
  fullName: string;
  imageUrl: string;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const normalizedImageUrl = imageUrl.trim();
  const shouldRenderImage = normalizedImageUrl.length > 0 && !hasImageError;

  return (
    <div className="staff-application-avatar" aria-hidden="true">
      {shouldRenderImage ? (
        <img
          src={normalizedImageUrl}
          alt=""
          className="staff-application-avatar-image"
          loading="lazy"
          decoding="async"
          onError={() => setHasImageError(true)}
        />
      ) : (
        <span className="staff-application-avatar-fallback">
          {getDisplayInitials(fullName)}
        </span>
      )}
    </div>
  );
}
