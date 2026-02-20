import { type SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const sizeProps = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24' });

function OpenAIIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M22.28 9.37a5.93 5.93 0 0 0-.51-4.89A6.01 6.01 0 0 0 15.3 1.5a5.97 5.97 0 0 0-4.52 2.07A5.93 5.93 0 0 0 6.82 2.2a6.01 6.01 0 0 0-4.01 2.92 5.97 5.97 0 0 0 .74 7.01 5.93 5.93 0 0 0 .51 4.89A6.01 6.01 0 0 0 10.53 20a5.98 5.98 0 0 0 .69 2.5 6.01 6.01 0 0 0 6.47 2.98 5.97 5.97 0 0 0 4.52-2.07 5.93 5.93 0 0 0 3.96 1.37 6.01 6.01 0 0 0 4.01-2.92 5.97 5.97 0 0 0-.74-7.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="scale(0.75) translate(4, 4)"/>
    </svg>
  );
}

function AnthropicIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M13.83 3h-3.16L5 21h3.16l1.41-4.51h5.36L16.34 21h3.16L13.83 3Zm-3.16 10.96L12.25 8.6l1.58 5.36h-3.16Z"/>
    </svg>
  );
}

function GoogleIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M21.81 10.26H12.18v3.72h5.51a4.77 4.77 0 0 1-2.05 3.08 6.14 6.14 0 0 1-3.46.96 6.36 6.36 0 0 1-6-4.14 6.29 6.29 0 0 1 0-3.76 6.36 6.36 0 0 1 6-4.14c1.56 0 2.97.56 4.08 1.49l2.79-2.79A10.53 10.53 0 0 0 12.18 2a10.26 10.26 0 0 0-9.19 5.66 10.06 10.06 0 0 0 0 8.68A10.26 10.26 0 0 0 12.18 22c5.2 0 9.87-3.46 9.87-10.26 0-.65-.08-1.31-.24-1.48Z" fill="currentColor"/>
    </svg>
  );
}

function GroqIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">G</text>
    </svg>
  );
}

function DeepSeekIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c1.85 0 3.55.63 4.9 1.69L7.69 16.9A7.96 7.96 0 0 1 4 12c0-4.42 3.58-8 8-8zm0 16c-1.85 0-3.55-.63-4.9-1.69L16.31 7.1A7.96 7.96 0 0 1 20 12c0 4.42-3.58 8-8 8z"/>
    </svg>
  );
}

function OllamaIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 3a7 7 0 0 0-7 7v3.5c0 1.93 1.57 3.5 3.5 3.5h1a1.5 1.5 0 0 0 0-3H8.5a.5.5 0 0 1-.5-.5V10a4 4 0 0 1 8 0v3.5a.5.5 0 0 1-.5.5H14.5a1.5 1.5 0 0 0 0 3h1c1.93 0 3.5-1.57 3.5-3.5V10a7 7 0 0 0-7-7z"/>
      <circle cx="9.5" cy="10.5" r="1"/>
      <circle cx="14.5" cy="10.5" r="1"/>
    </svg>
  );
}

function GrokIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3 3l7.07 10.61L3 21h1.59l6.19-6.47L15.61 21H21l-7.46-11.18L20.1 3h-1.59l-5.76 6.02L8.39 3H3zm2.29 1.25h2.54l10.88 15.5h-2.54L5.29 4.25z"/>
    </svg>
  );
}

function MiniMaxIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3" y="8" width="4" height="8" rx="1"/>
      <rect x="10" y="4" width="4" height="16" rx="1"/>
      <rect x="17" y="8" width="4" height="8" rx="1"/>
    </svg>
  );
}

function KimiIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="currentColor" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z"/>
    </svg>
  );
}

function DefaultIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...sizeProps(size)} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3"/>
      <path d="M9 9h6M9 12h6M9 15h4"/>
    </svg>
  );
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97757',
  claude: '#d97757',
  google: '#4285f4',
  gemini: '#4285f4',
  google_gemini: '#4285f4',
  groq: '#f55036',
  deepseek: '#4d6bfe',
  ollama: '#ffffff',
  grok: '#1d9bf0',
  xai: '#1d9bf0',
  minimax: '#6c5ce7',
  kimi: '#615eff',
};

const ICON_MAP: Record<string, (p: IconProps) => JSX.Element> = {
  openai: OpenAIIcon,
  anthropic: AnthropicIcon,
  claude: AnthropicIcon,
  google: GoogleIcon,
  gemini: GoogleIcon,
  google_gemini: GoogleIcon,
  groq: GroqIcon,
  deepseek: DeepSeekIcon,
  ollama: OllamaIcon,
  grok: GrokIcon,
  xai: GrokIcon,
  minimax: MiniMaxIcon,
  kimi: KimiIcon,
};

export function ProviderIcon({ provider, size = 20, className }: { provider: string; size?: number; className?: string }) {
  const key = (provider || '').toLowerCase().replace(/[\s-]/g, '_');
  const Icon = ICON_MAP[key] || DefaultIcon;
  const color = PROVIDER_COLORS[key] || 'currentColor';
  return <Icon size={size} className={className} style={{ color }} />;
}

export function getProviderColor(provider: string): string {
  const key = (provider || '').toLowerCase().replace(/[\s-]/g, '_');
  return PROVIDER_COLORS[key] || 'var(--gm-accent-primary)';
}
