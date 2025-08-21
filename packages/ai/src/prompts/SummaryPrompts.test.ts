import { describe, it, expect, beforeEach } from 'vitest';
import { SummaryPrompts } from './SummaryPrompts';
import type { SummaryOptions } from '../types';

describe('SummaryPrompts', () => {
  let prompts: SummaryPrompts;

  beforeEach(() => {
    prompts = new SummaryPrompts();
  });

  describe('getSummarySystemPrompt', () => {
    it('应该生成中文系统提示词', () => {
      const options: SummaryOptions = {
        language: 'zh',
        summaryLength: 'medium'
      };

      const prompt = prompts.getSummarySystemPrompt(options);

      expect(prompt).toContain('中文内容摘要生成器');
      expect(prompt).toContain('中等长度摘要');
      expect(prompt).toContain('准确反映原文主要内容');
      expect(prompt).toContain('使用清晰简洁的语言表达');
    });

    it('应该生成英文系统提示词', () => {
      const options: SummaryOptions = {
        language: 'en',
        summaryLength: 'short'
      };

      const prompt = prompts.getSummarySystemPrompt(options);

      expect(prompt).toContain('professional content summarizer');
      expect(prompt).toContain('accurate and concise');
      expect(prompt).toContain('Uses clear and concise language');
    });

    it('应该生成日文系统提示词', () => {
      const options: SummaryOptions = {
        language: 'ja',
        summaryLength: 'long'
      };

      const prompt = prompts.getSummarySystemPrompt(options);

      expect(prompt).toContain('専門的なコンテンツ要約生成器');
      expect(prompt).toContain('正確で簡潔な要約を生成してください');
    });

    it('应该为未知语言回退到英文', () => {
      const options: SummaryOptions = {
        language: 'unknown',
        summaryLength: 'medium'
      };

      const prompt = prompts.getSummarySystemPrompt(options);

      expect(prompt).toContain('professional content summarizer');
      expect(prompt).toContain('accurate and concise');
    });

    it('应该包含长度指引', () => {
      const shortOptions: SummaryOptions = {
        language: 'zh',
        summaryLength: 'short'
      };

      const mediumOptions: SummaryOptions = {
        language: 'zh',
        summaryLength: 'medium'
      };

      const longOptions: SummaryOptions = {
        language: 'zh',
        summaryLength: 'long'
      };

      const shortPrompt = prompts.getSummarySystemPrompt(shortOptions);
      const mediumPrompt = prompts.getSummarySystemPrompt(mediumOptions);
      const longPrompt = prompts.getSummarySystemPrompt(longOptions);

      expect(shortPrompt).toContain('简短摘要');
      expect(mediumPrompt).toContain('中等长度摘要');
      expect(longPrompt).toContain('详细摘要');
    });
  });

  describe('getLanguageSpecificPrompt', () => {
    it('应该返回支持语言的特定提示词', () => {
      const languages = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'ar', 'hi', 'it'];

      languages.forEach(lang => {
        const prompt = (prompts as any).getLanguageSpecificPrompt(lang);
        expect(prompt).toBeTruthy();
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(10);
      });
    });

    it('应该为不支持的语言返回英文提示词', () => {
      const unsupportedLang = 'xyz';
      const prompt = (prompts as any).getLanguageSpecificPrompt(unsupportedLang);
      const englishPrompt = (prompts as any).getLanguageSpecificPrompt('en');

      expect(prompt).toBe(englishPrompt);
    });
  });

  describe('getLengthGuideline', () => {
    it('应该返回中文长度指引', () => {
      const shortGuideline = (prompts as any).getLengthGuideline('short', 'zh');
      const mediumGuideline = (prompts as any).getLengthGuideline('medium', 'zh');
      const longGuideline = (prompts as any).getLengthGuideline('long', 'zh');

      expect(shortGuideline).toContain('简短摘要');
      expect(shortGuideline).toContain('50-150字');

      expect(mediumGuideline).toContain('中等长度摘要');
      expect(mediumGuideline).toContain('100-350字');

      expect(longGuideline).toContain('详细摘要');
      expect(longGuideline).toContain('200-500字');
    });

    it('应该返回英文长度指引', () => {
      const shortGuideline = (prompts as any).getLengthGuideline('short', 'en');
      const mediumGuideline = (prompts as any).getLengthGuideline('medium', 'en');
      const longGuideline = (prompts as any).getLengthGuideline('long', 'en');

      expect(shortGuideline).toContain('brief summary');
      expect(shortGuideline).toContain('50-150 characters');

      expect(mediumGuideline).toContain('medium-length summary');
      expect(mediumGuideline).toContain('100-350 characters');

      expect(longGuideline).toContain('detailed summary');
      expect(longGuideline).toContain('200-500 characters');
    });

    it('应该处理未知长度类型', () => {
      const guideline = (prompts as any).getLengthGuideline('unknown', 'zh');
      const mediumGuideline = (prompts as any).getLengthGuideline('medium', 'zh');

      expect(guideline).toBe(mediumGuideline);
    });
  });

  describe('getQualityRequirements', () => {
    it('应该返回中文质量要求', () => {
      const requirements = (prompts as any).getQualityRequirements('zh');

      expect(requirements).toContain('准确反映原文主要内容');
      expect(requirements).toContain('使用清晰简洁的语言表达');
      expect(requirements).toContain('保持客观中性的语调');
    });

    it('应该返回英文质量要求', () => {
      const requirements = (prompts as any).getQualityRequirements('en');

      expect(requirements).toContain('Accurately reflects the main content');
      expect(requirements).toContain('Uses clear and concise language');
      expect(requirements).toContain('Maintains an objective and neutral tone');
    });

    it('应该处理未知语言', () => {
      const requirements = (prompts as any).getQualityRequirements('unknown');
      const englishRequirements = (prompts as any).getQualityRequirements('en');

      expect(requirements).toBe(englishRequirements);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空选项', () => {
      const prompt = prompts.getSummarySystemPrompt({} as SummaryOptions);

      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(50);
    });

    it('应该处理部分选项', () => {
      const prompt = prompts.getSummarySystemPrompt({
        language: 'zh'
      } as SummaryOptions);

      expect(prompt).toContain('中文内容摘要生成器');
      expect(prompt).toContain('中等长度摘要'); // 默认为 medium
    });

    it('应该生成一致的提示词', () => {
      const options: SummaryOptions = {
        language: 'zh',
        summaryLength: 'medium'
      };

      const prompt1 = prompts.getSummarySystemPrompt(options);
      const prompt2 = prompts.getSummarySystemPrompt(options);

      expect(prompt1).toBe(prompt2);
    });
  });

  describe('多语言覆盖测试', () => {
    const languages = [
      'zh', 'en', 'ja', 'ko', 'fr', 
      'de', 'es', 'pt', 'ru', 'ar', 'hi', 'it'
    ];

    languages.forEach(lang => {
      it(`应该支持${lang}语言`, () => {
        const options: SummaryOptions = {
          language: lang,
          summaryLength: 'medium'
        };

        const prompt = prompts.getSummarySystemPrompt(options);

        expect(prompt).toBeTruthy();
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(50);
      });
    });
  });
});