/**
 * 摘要质量验证服务
 * 验证AI生成摘要的质量、长度和相关性
 */

import type { SummaryOptions, SummaryResult } from '../types';

export interface QualityValidationResult {
  isValid: boolean;
  score: number; // 0-1 质量评分
  issues: QualityIssue[];
  adjustedConfidence: number;
}

export interface QualityIssue {
  type: 'LENGTH' | 'LANGUAGE' | 'RELEVANCE' | 'COHERENCE' | 'COMPLETENESS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
}

export class SummaryQualityValidator {
  /**
   * 验证摘要质量
   */
  async validate(
    originalContent: string,
    summaryResult: SummaryResult,
    options: SummaryOptions
  ): Promise<QualityValidationResult> {
    const issues: QualityIssue[] = [];
    let score = 1.0; // 开始满分

    // 1. 长度验证
    const lengthValidation = this.validateLength(
      summaryResult.summary,
      options
    );
    if (!lengthValidation.isValid) {
      issues.push(...lengthValidation.issues);
      score *= 0.8; // 长度问题减分20%
    }

    // 2. 语言一致性验证
    const languageValidation = this.validateLanguage(
      summaryResult,
      options.language
    );
    if (!languageValidation.isValid) {
      issues.push(...languageValidation.issues);
      score *= 0.9; // 语言问题减分10%
    }

    // 3. 相关性验证
    const relevanceValidation = this.validateRelevance(
      originalContent,
      summaryResult.summary
    );
    if (!relevanceValidation.isValid) {
      issues.push(...relevanceValidation.issues);
      score *= 0.7; // 相关性问题减分30%
    }

    // 4. 连贯性验证
    const coherenceValidation = this.validateCoherence(summaryResult.summary);
    if (!coherenceValidation.isValid) {
      issues.push(...coherenceValidation.issues);
      score *= 0.85; // 连贯性问题减分15%
    }

    // 5. 完整性验证
    const completenessValidation = this.validateCompleteness(
      summaryResult.summary,
      options.summaryLength
    );
    if (!completenessValidation.isValid) {
      issues.push(...completenessValidation.issues);
      score *= 0.9; // 完整性问题减分10%
    }

    // 调整置信度
    const adjustedConfidence = Math.min(summaryResult.confidence * score, 1.0);

    return {
      isValid: issues.filter((i) => i.severity === 'HIGH').length === 0,
      score: Math.round(score * 100) / 100,
      issues,
      adjustedConfidence: Math.round(adjustedConfidence * 100) / 100,
    };
  }

  /**
   * 验证摘要长度
   */
  private validateLength(
    summary: string,
    options: SummaryOptions
  ): { isValid: boolean; issues: QualityIssue[] } {
    const issues: QualityIssue[] = [];
    const summaryLength = summary.length;

    // 定义长度限制
    const lengthLimits = {
      short: { min: 50, max: 150, target: 100 },
      medium: { min: 100, max: 350, target: 200 },
      long: { min: 200, max: 500, target: 300 },
    };

    const expectedLength = options.summaryLength || 'medium';
    const limits = lengthLimits[expectedLength];

    if (summaryLength < limits.min) {
      issues.push({
        type: 'LENGTH',
        severity: 'HIGH',
        message: `摘要过短 (${summaryLength} 字符，期望最少 ${limits.min} 字符)`,
      });
    } else if (summaryLength > limits.max) {
      issues.push({
        type: 'LENGTH',
        severity: 'MEDIUM',
        message: `摘要过长 (${summaryLength} 字符，期望最多 ${limits.max} 字符)`,
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'HIGH').length === 0,
      issues,
    };
  }

  /**
   * 验证语言一致性
   */
  private validateLanguage(
    summaryResult: SummaryResult,
    expectedLanguage?: string
  ): { isValid: boolean; issues: QualityIssue[] } {
    const issues: QualityIssue[] = [];

    if (expectedLanguage && summaryResult.language !== expectedLanguage) {
      issues.push({
        type: 'LANGUAGE',
        severity: 'MEDIUM',
        message: `语言不匹配 (期望: ${expectedLanguage}, 实际: ${summaryResult.language})`,
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'HIGH').length === 0,
      issues,
    };
  }

  /**
   * 验证相关性（简单实现）
   */
  private validateRelevance(
    originalContent: string,
    summary: string
  ): { isValid: boolean; issues: QualityIssue[] } {
    const issues: QualityIssue[] = [];

    // 检查摘要是否为空或过于简单
    if (!summary.trim()) {
      issues.push({
        type: 'RELEVANCE',
        severity: 'HIGH',
        message: '摘要为空',
      });
      return { isValid: false, issues };
    }

    if (summary.trim().length < 10) {
      issues.push({
        type: 'RELEVANCE',
        severity: 'HIGH',
        message: '摘要过于简短，可能不够相关',
      });
    }

    // 检查是否包含明显的错误信息
    const errorPatterns = [
      /sorry.{0,20}can.{0,20}t/i,
      /unable.{0,20}to.{0,20}summarize/i,
      /insufficient.{0,20}content/i,
      /error.{0,20}generating/i,
      /failed.{0,20}to.{0,20}process/i,
      /无法.{0,10}生成/,
      /抱歉.{0,10}不能/,
      /错误/,
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(summary)) {
        issues.push({
          type: 'RELEVANCE',
          severity: 'HIGH',
          message: '摘要包含错误信息或处理失败的指示',
        });
        break;
      }
    }

    // 简单的关键词重叠检查
    const originalWords = this.extractKeywords(originalContent);
    const summaryWords = this.extractKeywords(summary);
    const overlap = this.calculateWordOverlap(originalWords, summaryWords);

    if (overlap < 0.1) {
      issues.push({
        type: 'RELEVANCE',
        severity: 'MEDIUM',
        message: '摘要与原文关键词重叠度过低，可能不够相关',
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'HIGH').length === 0,
      issues,
    };
  }

  /**
   * 验证连贯性
   */
  private validateCoherence(summary: string): {
    isValid: boolean;
    issues: QualityIssue[];
  } {
    const issues: QualityIssue[] = [];

    // 检查句子结构
    const sentences = summary.split(/[.!?。！？]/);
    const validSentences = sentences.filter((s) => s.trim().length > 5);

    if (validSentences.length === 0) {
      issues.push({
        type: 'COHERENCE',
        severity: 'HIGH',
        message: '摘要缺乏有效句子',
      });
    } else if (validSentences.length === 1 && summary.length > 100) {
      issues.push({
        type: 'COHERENCE',
        severity: 'MEDIUM',
        message: '摘要缺乏句子分割，可能影响可读性',
      });
    }

    // 检查重复内容
    const repetitionPattern = /(.{10,})\1/g;
    if (repetitionPattern.test(summary)) {
      issues.push({
        type: 'COHERENCE',
        severity: 'MEDIUM',
        message: '摘要包含重复内容',
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'HIGH').length === 0,
      issues,
    };
  }

  /**
   * 验证完整性
   */
  private validateCompleteness(
    summary: string,
    expectedLength?: string
  ): { isValid: boolean; issues: QualityIssue[] } {
    const issues: QualityIssue[] = [];

    // 检查是否截断
    if (summary.endsWith('...') || summary.endsWith('…')) {
      issues.push({
        type: 'COMPLETENESS',
        severity: 'MEDIUM',
        message: '摘要可能被截断',
      });
    }

    // 检查是否过于简单
    const wordCount = summary.split(/\s+/).length;
    const minWords =
      expectedLength === 'short' ? 15 : expectedLength === 'long' ? 40 : 25;

    if (wordCount < minWords) {
      issues.push({
        type: 'COMPLETENESS',
        severity: 'MEDIUM',
        message: `摘要词数过少 (${wordCount} 词，期望至少 ${minWords} 词)`,
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'HIGH').length === 0,
      issues,
    };
  }

  /**
   * 提取关键词（简单实现）
   */
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取
    const words = text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3);

    // 移除常见停用词
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'this',
      'that',
      'these',
      'those',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      '的',
      '了',
      '在',
      '是',
      '我',
      '有',
      '和',
      '就',
      '不',
      '人',
      '都',
      '一',
      '一个',
      '没有',
      '说',
      '来',
      '上',
      '也',
      '这',
      '要',
      '去',
      '下',
      '把',
    ]);

    return words.filter((word) => !stopWords.has(word));
  }

  /**
   * 计算词汇重叠度
   */
  private calculateWordOverlap(words1: string[], words2: string[]): number {
    if (words1.length === 0 || words2.length === 0) return 0;

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));

    return intersection.size / Math.min(set1.size, set2.size);
  }

  /**
   * 生成质量报告
   */
  generateQualityReport(validation: QualityValidationResult): string {
    const { score, issues, adjustedConfidence } = validation;

    let report = `摘要质量评分: ${(score * 100).toFixed(1)}%\n`;
    report += `调整后置信度: ${(adjustedConfidence * 100).toFixed(1)}%\n`;

    if (issues.length > 0) {
      report += '\n发现的问题:\n';
      issues.forEach((issue, index) => {
        report += `${index + 1}. [${issue.severity}] ${issue.message}\n`;
      });
    } else {
      report += '\n✅ 未发现质量问题';
    }

    return report;
  }
}
