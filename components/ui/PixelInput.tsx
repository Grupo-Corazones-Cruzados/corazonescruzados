'use client';

import { forwardRef } from 'react';

interface PixelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const PixelInput = forwardRef<HTMLInputElement, PixelInputProps>(
  ({ label, error, id, name, className = '', ...props }, ref) => {
    const inputId = id || name;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[10px] text-accent-glow opacity-70"
            style={{ fontFamily: "'Silkscreen', cursive" }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          name={name}
          className={`w-full px-3 py-2.5 bg-digi-darker border-2 text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none transition-colors ${
            error ? 'border-red-500/60' : 'border-digi-border'
          } ${className}`}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          {...props}
        />
        {error && (
          <span className="text-[10px] text-red-400" style={{ fontFamily: "'Silkscreen', cursive" }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

PixelInput.displayName = 'PixelInput';
export default PixelInput;
