"use client";

import { useEffect, useState } from "react";

function getDisplayInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileImage({
  fullName,
  imageUrl,
  alt,
  className,
  fallbackClassName,
  fallbackText,
  loading = "lazy",
}: {
  fullName: string;
  imageUrl?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackText?: string;
  loading?: "eager" | "lazy";
}) {
  const normalizedImageUrl = imageUrl?.trim() ?? "";
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [normalizedImageUrl]);

  if (normalizedImageUrl.length > 0 && !hasImageError) {
    return (
      <img
        src={normalizedImageUrl}
        alt={alt}
        className={className}
        loading={loading}
        decoding="async"
        onError={() => setHasImageError(true)}
      />
    );
  }

  const initials = fallbackText ?? getDisplayInitials(fullName);

  if (fallbackClassName) {
    return <span className={fallbackClassName}>{initials}</span>;
  }

  return initials;
}
