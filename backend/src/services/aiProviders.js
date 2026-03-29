const logger = require('../utils/logger');

let Anthropic;
try { Anthropic = require('@anthropic-ai/sdk'); } catch {}

let OpenAI;
try { OpenAI = require('openai'); } catch {}

class AnthropicProvider {
  constructor(apiKey) {
    if (!Anthropic) throw new Error('@anthropic-ai/sdk no instalado');
    this.client = new Anthropic({ apiKey });
  }

  async createMessage({ model, maxTokens, system, messages }) {
    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    });

    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    return {
      text,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
      },
    };
  }
}

class OpenAIProvider {
  constructor(apiKey) {
    if (!OpenAI) throw new Error('openai SDK no instalado');
    this.client = new OpenAI({ apiKey });
  }

  async createMessage({ model, maxTokens, system, messages }) {
    const openaiMessages = [
      { role: 'system', content: system },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: openaiMessages,
    });

    const text = response.choices?.[0]?.message?.content || '';

    return {
      text,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
    };
  }
}

/**
 * Get an AI provider instance.
 * @param {'anthropic'|'openai'} provider
 * @param {string} apiKey
 */
function getProvider(provider, apiKey) {
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    default:
      throw new Error(`Provider desconocido: ${provider}`);
  }
}

module.exports = { getProvider };
