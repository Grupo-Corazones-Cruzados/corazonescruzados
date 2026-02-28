"use client";

import { cn } from "@/lib/utils";
import styles from "./Badge.module.css";

type Variant = "default" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

export default function Badge({
  variant = "default",
  children,
  className,
}: BadgeProps) {
  return (
    <span className={cn(styles.badge, styles[variant], className)}>
      {children}
    </span>
  );
}
