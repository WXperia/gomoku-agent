import type { AIConfig, ModelProvider } from './gomokuAgent'

function isOpenAIReasoningModel(modelName = '') {
  const model = modelName.toLowerCase()
  return model.startsWith('gpt-5') || /^o\d/.test(model)
}

function isDeepSeekThinkingModel(modelName = '') {
  const model = modelName.toLowerCase()
  return model.includes('reasoner') || model.includes('v4-pro')
}

function defaultTemperature(provider: ModelProvider, modelName?: string) {
  if (provider === 'anthropic') return undefined
  if (provider === 'openai' && isOpenAIReasoningModel(modelName)) return undefined
  if (provider === 'deepseek' && isDeepSeekThinkingModel(modelName)) return undefined
  return 0.1
}

export function createAIConfig(input: {
  provider: ModelProvider
  apiKey: string
  baseUrl?: string
  modelName?: string
}): AIConfig {
  const temperature = defaultTemperature(input.provider, input.modelName)

  return {
    provider: input.provider,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
    modelName: input.modelName,
    ...(temperature == null ? {} : { temperature }),
  }
}
