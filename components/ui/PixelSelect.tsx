'use client';

import { forwardRef } from 'react';

interface Option {
  value: string;
  label: string;
}

interface PixelSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

const PixelSelect = forwardRef<HTMLSelectElement, PixelSelectProps>(
  ({ label, error, options, placeholder, id, name, className = '', ...props }, ref) => {
    const selectId = id || name;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={selectId}
            className="text-[10px] text-accent-glow opacity-70"
            style={{ fontFamily: "'Silkscreen', cursive" }}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          name={name}
          className={`w-full px-3 py-2.5 bg-digi-darker border-2 text-sm text-digi-text focus:border-accent focus:outline-none transition-colors appearance-none cursor-pointer ${
            error ? 'border-red-500/60' : 'border-digi-border'
          } ${className}`}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            paddingRight: '36px',
          }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="text-[10px] text-red-400" style={{ fontFamily: "'Silkscreen', cursive" }}>
            {error}
          </span>
        )}
      </div>
    );
  }
);

PixelSelect.displayName = 'PixelSelect';
export default PixelSelect;
