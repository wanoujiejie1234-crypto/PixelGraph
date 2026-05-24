import type { AiProviderConfig } from './types';

/**
 * AI Provider 配置
 * 修改此处 endpoint / apiKey / model 即可切换模型
 */
export const AI_CONFIG: AiProviderConfig = {
  endpoint: 'https://api.deepseek.com/v1',
  apiKey: 'sk-0fcb54e1d2dd4c98bfdf440e6265ede3',
  model: 'deepseek-chat',
};
