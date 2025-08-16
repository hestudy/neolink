// AI service types
export interface AIProvider {
  name: string;
  apiKey: string;
  baseUrl?: string;
}

export interface SummaryRequest {
  content: string;
  maxLength?: number;
}

export interface SummaryResponse {
  summary: string;
  confidence: number;
}

export interface TagsRequest {
  content: string;
  maxTags?: number;
}

export interface TagsResponse {
  tags: string[];
  confidence: number;
}
