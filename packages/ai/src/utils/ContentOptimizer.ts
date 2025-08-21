import {
  OptimizedContent,
  ReadableContent,
  Heading,
} from '@neolink/shared/types/content';

/**
 * Content optimizer for AI processing with cost control
 */
export class ContentOptimizer {
  private readonly DEFAULT_MAX_TOKENS = 3000;
  private readonly CHARS_PER_TOKEN = 4; // Approximate

  /**
   * Optimize content for AI processing
   */
  async optimizeForAI(
    content: ReadableContent,
    maxTokens: number = this.DEFAULT_MAX_TOKENS
  ): Promise<OptimizedContent> {
    // 1. Estimate current content tokens
    const estimatedTokens = this.estimateTokens(content.textContent);

    if (estimatedTokens <= maxTokens) {
      // Even if content fits, we should still format it properly with title
      let formattedContent = '';
      if (content.title && content.title.trim()) {
        formattedContent += content.title + '\n\n';
      }
      formattedContent += content.textContent;

      return {
        content: formattedContent,
        truncated: false,
        originalLength: estimatedTokens,
        optimizedLength: this.estimateTokens(formattedContent),
        preservedElements: {
          title: content.title,
          headings: content.structuredData?.headings || [],
          importantParagraphs: [],
        },
      };
    }

    // 2. Intelligent truncation to preserve semantic integrity
    const optimizedContent = this.intelligentTruncate(content, maxTokens);
    const optimizedTokens = this.estimateTokens(optimizedContent.content);

    return {
      content: optimizedContent.content,
      truncated: true,
      originalLength: estimatedTokens,
      optimizedLength: optimizedTokens,
      preservedElements: optimizedContent.preservedElements,
      truncationRatio:
        optimizedContent.content.length / content.textContent.length,
    };
  }

  /**
   * Intelligent content truncation that preserves semantic structure
   */
  private intelligentTruncate(
    content: ReadableContent,
    maxTokens: number
  ): {
    content: string;
    preservedElements: OptimizedContent['preservedElements'];
  } {
    const maxChars = maxTokens * this.CHARS_PER_TOKEN;
    const text = content.textContent;
    const headings = content.structuredData?.headings || [];

    // Priority order for content preservation:
    // 1. Title and important headings
    // 2. First few paragraphs (introduction)
    // 3. Last paragraph (conclusion)
    // 4. Middle content (as space allows)

    let result = '';
    const preservedElements = {
      title: content.title,
      headings: [] as Heading[],
      importantParagraphs: [] as string[],
    };

    // Always prioritize title inclusion
    let titleIncluded = false;
    if (content.title && content.title.trim()) {
      const titleLength = content.title.length + 2; // + 2 for \n\n
      if (titleLength < maxChars * 0.5) {
        // Use more lenient check for title
        result += content.title + '\n\n';
        titleIncluded = true;
      }
    }

    // Split content into paragraphs
    const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 20);

    if (paragraphs.length === 0) {
      // Fallback to simple truncation, ensuring title is included
      const fallbackContent = titleIncluded
        ? result
        : content.title
          ? content.title +
            '\n\n' +
            text.substring(
              0,
              Math.max(0, maxChars - content.title.length - 5)
            ) +
            '...'
          : text.substring(0, maxChars - 3) + '...';
      return {
        content: fallbackContent,
        preservedElements,
      };
    }

    // Reserve space for additional content and ellipsis
    let remainingChars = maxChars - result.length - 10;

    // If very little space remaining, ensure we have at least title
    if (remainingChars < 30 && titleIncluded) {
      return {
        content: result.trim(),
        preservedElements,
      };
    } else if (remainingChars < 30 && !titleIncluded) {
      // Force include title even in small space
      const forcedContent = content.title
        ? content.title +
          '\n\n' +
          text.substring(0, Math.max(0, maxChars - content.title.length - 5)) +
          '...'
        : text.substring(0, maxChars - 3) + '...';
      return {
        content: forcedContent,
        preservedElements: {
          title: content.title,
          headings: [],
          importantParagraphs: [],
        },
      };
    }

    // 1. Add important headings (H1, H2)
    const importantHeadings = headings.filter((h) => h.level <= 2);
    for (const heading of importantHeadings.slice(0, 3)) {
      if (remainingChars > heading.text.length + 10) {
        result += `${heading.text}\n\n`;
        remainingChars -= heading.text.length + 2;
        preservedElements.headings.push(heading);
      }
    }

    // 2. Add first paragraph (introduction)
    if (paragraphs.length > 0 && remainingChars > paragraphs[0].length + 10) {
      result += paragraphs[0] + '\n\n';
      remainingChars -= paragraphs[0].length + 2;
      preservedElements.importantParagraphs.push(paragraphs[0]);
    }

    // 3. Add last paragraph if it's different from first (conclusion)
    if (
      paragraphs.length > 1 &&
      paragraphs[paragraphs.length - 1] !== paragraphs[0] &&
      remainingChars > paragraphs[paragraphs.length - 1].length + 10
    ) {
      const lastParagraph = paragraphs[paragraphs.length - 1];
      result += lastParagraph + '\n\n';
      remainingChars -= lastParagraph.length + 2;
      preservedElements.importantParagraphs.push(lastParagraph);
    }

    // 4. Fill remaining space with middle content
    const usedParagraphs = new Set([0, paragraphs.length - 1]);
    for (let i = 1; i < paragraphs.length - 1; i++) {
      if (usedParagraphs.has(i)) continue;

      const paragraph = paragraphs[i];
      if (remainingChars > paragraph.length + 10) {
        result += paragraph + '\n\n';
        remainingChars -= paragraph.length + 2;
        preservedElements.importantParagraphs.push(paragraph);
      } else {
        // Try to fit a partial paragraph at sentence boundaries
        const sentences = paragraph.split(/[.!?]+\s+/);
        let partialParagraph = '';

        for (const sentence of sentences) {
          if (remainingChars > partialParagraph.length + sentence.length + 20) {
            partialParagraph += (partialParagraph ? '. ' : '') + sentence;
          } else {
            break;
          }
        }

        if (partialParagraph) {
          result += partialParagraph + '...\n\n';
          preservedElements.importantParagraphs.push(partialParagraph + '...');
        }
        break;
      }
    }

    return {
      content: result.trim(),
      preservedElements,
    };
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    if (!text) return 0;

    // Simple estimation: roughly 4 characters per token
    // This is approximate and can be refined with actual tokenizer
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Extract key sentences from content
   */
  private extractKeySentences(
    text: string,
    maxSentences: number = 5
  ): string[] {
    const sentences = text
      .split(/[.!?]+\s+/)
      .filter((s) => s.trim().length > 10);

    if (sentences.length <= maxSentences) {
      return sentences;
    }

    // Simple heuristic: take first 2, last 1, and middle sentences
    const keySentences = [];

    // First sentences (introduction)
    keySentences.push(...sentences.slice(0, 2));

    // Middle sentences
    const middleStart = Math.floor(sentences.length / 3);
    keySentences.push(...sentences.slice(middleStart, middleStart + 1));

    // Last sentence (conclusion)
    if (sentences.length > 1) {
      keySentences.push(sentences[sentences.length - 1]);
    }

    return keySentences.slice(0, maxSentences);
  }

  /**
   * Calculate content importance score
   */
  private calculateImportanceScore(paragraph: string): number {
    let score = 0;

    // Length factor (not too short, not too long)
    const length = paragraph.length;
    if (length > 50 && length < 500) {
      score += 1;
    }

    // Keyword indicators
    const importantWords = [
      'important',
      'key',
      'main',
      'primary',
      'essential',
      'crucial',
      'significant',
      'notable',
      'summary',
      'conclusion',
      'result',
    ];

    const lowerText = paragraph.toLowerCase();
    for (const word of importantWords) {
      if (lowerText.includes(word)) {
        score += 0.5;
      }
    }

    // Position bonus (first and last paragraphs are often important)
    // This would need additional context to implement properly

    return score;
  }

  /**
   * Validate optimized content quality
   */
  validateOptimization(
    original: ReadableContent,
    optimized: OptimizedContent
  ): boolean {
    // Basic quality checks
    if (!optimized.content || optimized.content.length < 50) {
      return false;
    }

    // Check if title is preserved
    if (original.title && !optimized.content.includes(original.title)) {
      return false;
    }

    // Check token limit compliance
    const tokenCount = this.estimateTokens(optimized.content);
    if (tokenCount > this.DEFAULT_MAX_TOKENS) {
      return false;
    }

    return true;
  }
}
