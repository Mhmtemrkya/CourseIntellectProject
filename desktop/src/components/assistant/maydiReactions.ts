import { foldTr } from '../../lib/foldTr';
import type { AssistantResponseDto } from '../../types/api/generated';
import type { MaydiResponseMood } from './MaydiMascot';

/** Only standalone appreciation: a question that mentions thanks stays a question. */
export function isMaydiAppreciation(message: string): boolean {
  const words = foldTr(message)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\bmaydi\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /^(?:cok )?(?:tesekkur(?:ler| ederim| ediyorum| ederiz| ediyoruz)?|sag ?ol(?:un)?|eline saglik|emegine saglik|seni seviyorum|harikasin|supersin|thanks(?: a lot)?|thank you(?: very much)?|thx)(?: cok yardimci oldun)?$/.test(words);
}

export function maydiResponseMood(response?: AssistantResponseDto, requestText = ''): MaydiResponseMood {
  if (response?.type === 'permission_denied' || response?.type === 'error') return 'speaking';
  if (isMaydiAppreciation(requestText)) return 'love';
  if (response?.type === 'action_result') return 'happy';
  if (response?.type === 'how_to' || response?.actions.some((action) => action.type === 'navigate')) return 'guiding';
  return 'speaking';
}
