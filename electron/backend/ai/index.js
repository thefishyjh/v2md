import { AnthropicProvider } from './anthropic.js';
import { MinimaxProvider } from './minimax.js';
import { DeepSeekProvider } from './deepseek.js';

export class AIService {
  constructor() {
    this.providers = {};
  }

  init(settings) {
    if (settings.anthropicApiKey) {
      this.providers.anthropic = new AnthropicProvider(settings.anthropicApiKey);
    }
    if (settings.minimaxApiKey) {
      this.providers.minimax = new MinimaxProvider(settings.minimaxApiKey, settings.minimaxBaseUrl);
    }
    if (settings.deepseekApiKey) {
      this.providers.deepseek = new DeepSeekProvider(settings.deepseekApiKey);
    }
  }

  async analyze(subtitle, numPoints, model = 'anthropic') {
    const provider = this.providers[model];
    if (!provider) throw new Error(`Unknown model: ${model}`);
    return provider.generate(subtitle, numPoints);
  }

  getAvailableModels() {
    return Object.keys(this.providers);
  }
}

export const aiService = new AIService();