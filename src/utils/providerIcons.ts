// Import SVG icons as URLs for proper Vite bundling
import openaiIcon from "@/assets/icons/providers/openai.svg";
import anthropicIcon from "@/assets/icons/providers/anthropic.svg";
import geminiIcon from "@/assets/icons/providers/gemini.svg";
import llamaIcon from "@/assets/icons/providers/llama.svg";
import mistralIcon from "@/assets/icons/providers/mistral.svg";
import qwenIcon from "@/assets/icons/providers/qwen.svg";
import groqIcon from "@/assets/icons/providers/groq.svg";
import nvidiaIcon from "@/assets/icons/providers/nvidia.svg";
import openaiOssIcon from "@/assets/icons/providers/openai-oss.svg";

export const PROVIDER_ICONS: Record<string, string> = {
  openai: openaiIcon,
  whisper: openaiIcon,
  anthropic: anthropicIcon,
  gemini: geminiIcon,
  llama: llamaIcon,
  mistral: mistralIcon,
  qwen: qwenIcon,
  groq: groqIcon,
  nvidia: nvidiaIcon,
  "openai-oss": openaiOssIcon,
};

// These SVGs ship without a fill (rendered black), so they vanish on dark surfaces
// unless inverted. The others carry their own brand colors.
const MONOCHROME_ICON_URLS = new Set([
  openaiIcon,
  anthropicIcon,
  qwenIcon,
  nvidiaIcon,
  openaiOssIcon,
]);

export function getProviderIcon(provider: string): string | undefined {
  return PROVIDER_ICONS[provider];
}

export function isMonochromeProviderIcon(iconUrl: string | undefined): boolean {
  return Boolean(iconUrl && MONOCHROME_ICON_URLS.has(iconUrl));
}

/** Tailwind classes to keep a provider icon visible in both color schemes. */
export function providerIconClassName(iconUrl: string | undefined): string {
  return isMonochromeProviderIcon(iconUrl) ? "dark:invert" : "";
}
