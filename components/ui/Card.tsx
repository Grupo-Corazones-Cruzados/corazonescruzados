"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Card.module.css";

type Variant = "flat" | "elevated" | "glass";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
}

export default function Card({
  variant = "elevated",
  hover = false,
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        styles.card,
        styles[variant],
        styles[`pad-${padding}`],
        hover && styles.hover,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
