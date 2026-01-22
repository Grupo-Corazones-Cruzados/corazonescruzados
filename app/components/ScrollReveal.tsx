"use client";

import React from "react";
import { useScrollReveal } from "app/hooks/useScrollReveal";
import styles from "app/styles/ScrollReveal.module.css";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // delay in ms
  direction?: "up" | "down" | "left" | "right" | "fade";
}

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold: 0.1,
    rootMargin: "0px 0px -30px 0px",
  });

  const directionClass = styles[direction] || styles.up;

  return (
    <div
      ref={ref}
      className={`${styles.wrapper} ${directionClass} ${isVisible ? styles.visible : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
