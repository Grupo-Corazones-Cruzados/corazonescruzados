"use client";

import { getInitials } from "@/lib/utils";
import styles from "./Avatar.module.css";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: Size;
  className?: string;
}

export default function Avatar({
  src,
  name,
  size = "md",
  className,
}: AvatarProps) {
  const initials = getInitials(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${styles.avatar} ${styles[size]} ${className || ""}`}
      />
    );
  }

  return (
    <div className={`${styles.avatar} ${styles.fallback} ${styles[size]} ${className || ""}`}>
      {initials}
    </div>
  );
}
