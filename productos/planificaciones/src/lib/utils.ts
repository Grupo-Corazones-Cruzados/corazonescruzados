import { twMerge } from 'tailwind-merge';
import clsx, { type ClassValue } from 'clsx';

export function cn(...clases: ClassValue[]) {
  return twMerge(clsx(clases));
}
