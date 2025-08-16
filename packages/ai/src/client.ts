import type {
  AIProvider,
  SummaryRequest,
  SummaryResponse,
  TagsRequest,
  TagsResponse,
} from './types';

export class AIClient {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  async generateSummary(_request: SummaryRequest): Promise<SummaryResponse> {
    // TODO: Implement AI summary generation
    return {
      summary: 'AI summary generation not implemented yet',
      confidence: 0,
    };
  }

  async generateTags(_request: TagsRequest): Promise<TagsResponse> {
    // TODO: Implement AI tag generation
    return {
      tags: ['placeholder'],
      confidence: 0,
    };
  }
}
