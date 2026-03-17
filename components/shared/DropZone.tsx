'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropZoneProps {
  onDrop: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

export default function DropZone({
  onDrop,
  accept = { 'image/png': ['.png'] },
  maxFiles = 1,
  label = 'Drop PNG files here',
  sublabel = 'or click to browse',
  className,
}: DropZoneProps) {
  const onDropAccepted = useCallback(
    (files: File[]) => {
      onDrop(files);
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted,
    accept,
    maxFiles,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
        isDragActive
          ? 'border-digi-green bg-digi-green/10'
          : 'border-digi-border hover:border-digi-green/50 hover:bg-white/[0.02]',
        className
      )}
    >
      <input {...getInputProps()} />
      <Upload size={32} className="mx-auto mb-3 text-digi-muted" />
      <p className="text-sm text-digi-text">{label}</p>
      <p className="text-xs text-digi-muted mt-1">{sublabel}</p>
    </div>
  );
}
