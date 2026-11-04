import { isMaydiAppreciation, maydiResponseMood } from './maydiReactions';
import { AssistantIntent, type AssistantResponseDto } from '../../types/api/generated';

const response = (type: string): AssistantResponseDto => ({
  conversationId: 'conversation', messageId: 'message', text: 'Yanıt', type,
  data: null, actions: [], suggestions: [], intent: AssistantIntent.SmallTalk,
});

it.each(['Teşekkür ederim', 'ÇOK TEŞEKKÜRLER!', 'Maydi, sağ ol ❤️', 'Sağol', 'Eline sağlık', 'Seni seviyorum Maydi', 'Thank you!'])(
  'recognizes standalone appreciation: %s', (text) => {
    expect(isMaydiAppreciation(text)).toBe(true);
    expect(maydiResponseMood(response('text'), text)).toBe('love');
  },
);

it.each(['Teşekkür etmedim', 'İşe yaramadı', 'Teşekkür mesajı nasıl gönderilir?', 'Teşekkürler ama yoklama nasıl alınır?', 'Merhaba'])(
  'does not treat a complaint or a help request as appreciation: %s', (text) => {
    expect(isMaydiAppreciation(text)).toBe(false);
    expect(maydiResponseMood(response('text'), text)).toBe('speaking');
  },
);

it('keeps error and guidance reactions when appropriate', () => {
  expect(maydiResponseMood(response('permission_denied'), 'Teşekkürler')).toBe('speaking');
  expect(maydiResponseMood(response('error'), 'Teşekkürler')).toBe('speaking');
  expect(maydiResponseMood(response('how_to'), 'Şifremi nasıl değiştiririm?')).toBe('guiding');
  expect(maydiResponseMood(response('action_result'))).toBe('happy');
});
