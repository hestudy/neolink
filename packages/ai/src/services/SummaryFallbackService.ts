/**
 * 摘要降级服务
 * 当 AI 摘要生成失败时提供基于内容的简化摘要
 */

import type { SummaryResult } from '../types';

export interface FallbackSummaryOptions {
  title?: string;
  description?: string;
  content: string;
  language?: string;
  maxLength?: number;
}

export class SummaryFallbackService {
  /**
   * 生成降级摘要
   */
  async generateFallbackSummary(
    options: FallbackSummaryOptions
  ): Promise<SummaryResult> {
    const {
      title,
      description,
      content,
      language = 'en',
      maxLength = 200,
    } = options;

    try {
      // 1. 尝试基于标题和描述生成摘要
      if (title || description) {
        const titleBasedSummary = this.createTitleBasedSummary(
          title,
          description,
          language,
          maxLength
        );
        if (titleBasedSummary) {
          return {
            summary: titleBasedSummary,
            confidence: 0.6, // 中等置信度
            language: language,
            tokensUsed: { input: 0, output: 0 },
          };
        }
      }

      // 2. 尝试从内容中提取关键信息
      const contentBasedSummary = this.createContentBasedSummary(
        content,
        language,
        maxLength
      );
      if (contentBasedSummary) {
        return {
          summary: contentBasedSummary,
          confidence: 0.4, // 较低置信度
          language: language,
          tokensUsed: { input: 0, output: 0 },
        };
      }

      // 3. 最后的降级：返回内容截断
      const truncatedSummary = this.createTruncatedSummary(
        content,
        language,
        maxLength
      );
      return {
        summary: truncatedSummary,
        confidence: 0.2, // 很低置信度
        language: language,
        tokensUsed: { input: 0, output: 0 },
      };
    } catch {
      // 如果所有方法都失败，返回通用消息
      return this.createGenericSummary(language);
    }
  }

  /**
   * 基于标题和描述创建摘要
   */
  private createTitleBasedSummary(
    title?: string,
    description?: string,
    language: string = 'en',
    maxLength: number = 200
  ): string | null {
    if (!title && !description) return null;

    const templates = {
      zh: {
        titleOnly: '本文主要讨论：{title}',
        descOnly: '内容概述：{description}',
        titleAndDesc: '《{title}》- {description}',
      },
      en: {
        titleOnly: 'This content focuses on: {title}',
        descOnly: 'Content overview: {description}',
        titleAndDesc: '{title} - {description}',
      },
      ja: {
        titleOnly: 'このコンテンツは次に焦点を当てています：{title}',
        descOnly: 'コンテンツの概要：{description}',
        titleAndDesc: '{title} - {description}',
      },
    };

    const template =
      templates[language as keyof typeof templates] || templates.en;

    let summary: string;
    if (title && description) {
      summary = template.titleAndDesc
        .replace('{title}', title)
        .replace('{description}', description);
    } else if (title) {
      summary = template.titleOnly.replace('{title}', title);
    } else if (description) {
      summary = template.descOnly.replace('{description}', description!);
    } else {
      return null;
    }

    // 限制长度
    if (summary.length > maxLength) {
      summary = summary.substring(0, maxLength - 3) + '...';
    }

    return summary;
  }

  /**
   * 基于内容创建摘要
   */
  private createContentBasedSummary(
    content: string,
    _language: string = 'en',
    maxLength: number = 200
  ): string | null {
    if (!content || content.trim().length < 50) return null;

    try {
      // 提取第一段或前几句
      const paragraphs = content
        .split(/\n\s*\n/)
        .filter((p) => p.trim().length > 20);

      if (paragraphs.length === 0) {
        // 如果没有段落，尝试提取前几句
        const sentences = this.extractSentences(content);
        if (sentences.length > 0) {
          const firstSentences = sentences.slice(0, 3).join(' ');
          return this.truncateToLength(firstSentences, maxLength);
        }
        return null;
      }

      // 使用第一段作为摘要基础
      let summary = paragraphs[0].trim();

      // 如果第一段太短，添加第二段
      if (summary.length < 100 && paragraphs.length > 1) {
        summary += ' ' + paragraphs[1].trim();
      }

      // 清理和格式化
      summary = this.cleanText(summary);

      return this.truncateToLength(summary, maxLength);
    } catch {
      return null;
    }
  }

  /**
   * 创建截断摘要
   */
  private createTruncatedSummary(
    content: string,
    language: string = 'en',
    maxLength: number = 200
  ): string {
    if (!content || content.trim().length === 0) {
      return this.getNoContentMessage(language);
    }

    // 清理内容
    const cleanedContent = this.cleanText(content);

    if (cleanedContent.length <= maxLength) {
      return cleanedContent;
    }

    // 智能截断：尝试在句子边界截断
    const truncated = cleanedContent.substring(0, maxLength - 3);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('！'),
      truncated.lastIndexOf('?'),
      truncated.lastIndexOf('？')
    );

    if (lastSentenceEnd > maxLength * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1);
    } else {
      return truncated + '...';
    }
  }

  /**
   * 创建通用摘要消息
   */
  private createGenericSummary(language: string = 'en'): SummaryResult {
    const messages = {
      zh: '无法生成摘要，请稍后重试。',
      en: 'Unable to generate summary, please try again later.',
      ja: '要約を生成できません。後でもう一度お試しください。',
      ko: '요약을 생성할 수 없습니다. 나중에 다시 시도해 주세요.',
      fr: 'Impossible de générer un résumé, veuillez réessayer plus tard.',
      de: 'Zusammenfassung kann nicht erstellt werden, bitte versuchen Sie es später erneut.',
      es: 'No se puede generar el resumen, inténtalo de nuevo más tarde.',
    };

    const message = messages[language as keyof typeof messages] || messages.en;

    return {
      summary: message,
      confidence: 0.1, // 极低置信度
      language: language,
      tokensUsed: { input: 0, output: 0 },
    };
  }

  /**
   * 获取无内容消息
   */
  private getNoContentMessage(language: string): string {
    const messages = {
      zh: '内容为空，无法生成摘要。',
      en: 'No content available for summary generation.',
      ja: 'コンテンツが空で、要約を生成できません。',
      ko: '콘텐츠가 비어있어 요약을 생성할 수 없습니다.',
    };

    return messages[language as keyof typeof messages] || messages.en;
  }

  /**
   * 提取句子
   */
  private extractSentences(text: string): string[] {
    // 支持多语言的句子分割
    const sentenceEnders = /[.!?。！？]/g;
    const sentences = text
      .split(sentenceEnders)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    return sentences;
  }

  /**
   * 清理文本
   */
  private cleanText(text: string): string {
    return (
      text
        // 移除多余的空白
        .replace(/\s+/g, ' ')
        // 移除 HTML 标签
        .replace(/<[^>]*>/g, '')
        // 移除特殊字符
        .replace(/[^\w\s\u4e00-\u9fff.,!?;:"'()[\]{}\\-]/g, '')
        .trim()
    );
  }

  /**
   * 截断到指定长度
   */
  private truncateToLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength - 3);
    return truncated + '...';
  }

  /**
   * 检测内容类型并优化摘要策略
   */
  private detectContentType(
    content: string
  ): 'article' | 'list' | 'code' | 'data' | 'unknown' {
    if (!content) return 'unknown';

    const codePatterns = [
      /```/g,
      /function\s+\w+/g,
      /class\s+\w+/g,
      /import\s+.*from/g,
      /<\w+[^>]*>/g,
    ];

    const listPatterns = [
      /^\s*[-*•]\s/gm,
      /^\s*\d+\.\s/gm,
      /^\s*[a-zA-Z]\.\s/gm,
    ];

    const dataPatterns = [/\d+%/g, /\$[\d,]+/g, /\d{4}-\d{2}-\d{2}/g];

    if (codePatterns.some((pattern) => pattern.test(content))) {
      return 'code';
    }

    if (listPatterns.some((pattern) => pattern.test(content))) {
      return 'list';
    }

    if (dataPatterns.some((pattern) => pattern.test(content))) {
      return 'data';
    }

    // 检查文章特征
    const paragraphs = content.split(/\n\s*\n/);
    if (paragraphs.length >= 3) {
      return 'article';
    }

    return 'unknown';
  }

  /**
   * 验证降级摘要质量
   */
  validateFallbackSummary(
    summary: string,
    _originalContent: string
  ): {
    isValid: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 1.0;

    // 检查长度
    if (summary.length < 20) {
      issues.push('摘要过短');
      score *= 0.5;
    }

    if (summary.length > 500) {
      issues.push('摘要过长');
      score *= 0.8;
    }

    // 检查是否包含错误消息
    const errorPatterns = [
      /无法生成摘要/i,
      /unable to generate/i,
      /error/i,
      /failed/i,
    ];

    if (errorPatterns.some((pattern) => pattern.test(summary))) {
      issues.push('包含错误消息');
      score *= 0.3;
    }

    // 检查是否过于通用
    if (summary.includes('...') && summary.length < 50) {
      issues.push('摘要过于简单');
      score *= 0.7;
    }

    return {
      isValid: score > 0.3,
      score: Math.round(score * 100) / 100,
      issues,
    };
  }
}
