import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

export function generateHookConfig(agentId: string, agentName: string, serverUrl = 'http://localhost:4321') {
  const hookUrl = `${serverUrl}/api/hooks/claude-code?agent=${agentId}&name=${encodeURIComponent(agentName)}`;
  const hookEntry = [{ hooks: [{ type: 'http', url: hookUrl }] }];
  return {
    hooks: {
      SessionStart: hookEntry,
      UserPromptSubmit: hookEntry,
      PreToolUse: hookEntry,
      PostToolUse: hookEntry,
      PostToolUseFailure: hookEntry,
      Stop: hookEntry,
      SessionEnd: hookEntry,
    },
  };
}
