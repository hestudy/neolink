import { franc } from 'franc';
import { LanguageInfo } from '@neolink/shared/types/content';

/**
 * Language detection utility using franc
 */
export class LanguageDetector {
  private static readonly LANGUAGE_NAMES: Record<string, string> = {
    // ISO 639-3 codes
    cmn: 'Chinese (Mandarin)',
    eng: 'English',
    jpn: 'Japanese',
    kor: 'Korean',
    fra: 'French',
    deu: 'German',
    spa: 'Spanish',
    por: 'Portuguese',
    rus: 'Russian',
    ara: 'Arabic',
    hin: 'Hindi',
    ita: 'Italian',
    nld: 'Dutch',
    pol: 'Polish',
    tur: 'Turkish',
    tha: 'Thai',
    vie: 'Vietnamese',
    ind: 'Indonesian',
    msa: 'Malay',
    tgl: 'Tagalog',
    // ISO 639-1 codes
    zh: 'Chinese (Mandarin)',
    en: 'English',
    ja: 'Japanese',
    ko: 'Korean',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic',
    hi: 'Hindi',
    it: 'Italian',
    nl: 'Dutch',
    pl: 'Polish',
    tr: 'Turkish',
    th: 'Thai',
    vi: 'Vietnamese',
    id: 'Indonesian',
    ms: 'Malay',
    tl: 'Tagalog',
  };

  /**
   * Detect language of given text
   */
  async detectLanguage(text: string): Promise<LanguageInfo> {
    try {
      // Clean text for better detection
      const cleanText = this.cleanTextForDetection(text);

      if (cleanText.length < 50) {
        // Text too short for reliable detection
        return this.getDefaultLanguage();
      }

      // Use franc for language detection
      const detected = franc(cleanText, { minLength: 50 });

      if (detected === 'und') {
        // Undetermined language
        return this.getDefaultLanguage();
      }

      const confidence = this.calculateConfidence(cleanText, detected);

      const iso639_1 = this.convertToISO639_1(detected);
      return {
        code: iso639_1,
        name: this.getLanguageName(iso639_1) || this.getLanguageName(detected),
        confidence,
      };
    } catch (error) {
      console.warn('Language detection failed:', error);
      return this.getDefaultLanguage();
    }
  }

  /**
   * Clean text for better language detection
   */
  private cleanTextForDetection(text: string): string {
    return (
      text
        // Remove URLs
        .replace(/https?:\/\/[^\s]+/g, '')
        // Remove email addresses
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
        // Remove numbers and special characters
        .replace(/[0-9]+/g, '')
        .replace(/[^\p{L}\s]/gu, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  /**
   * Calculate confidence based on text characteristics and detection result
   */
  private calculateConfidence(text: string, detectedLang: string): number {
    let confidence = 0.6; // Base confidence

    // Adjust based on text length
    if (text.length > 1000) {
      confidence += 0.3;
    } else if (text.length > 500) {
      confidence += 0.2;
    } else if (text.length > 100) {
      confidence += 0.1;
    } else if (text.length < 50) {
      confidence -= 0.3;
    }

    // Adjust based on language characteristics
    if (this.hasLanguageSpecificCharacters(text, detectedLang)) {
      confidence += 0.2;
    }

    // Ensure confidence is within bounds
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Check if text has language-specific characters
   */
  private hasLanguageSpecificCharacters(text: string, lang: string): boolean {
    switch (lang) {
      case 'cmn':
      case 'zh': // Chinese
        return /[\u4e00-\u9fff]/.test(text);
      case 'jpn':
      case 'ja': // Japanese
        return /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(text);
      case 'kor':
      case 'ko': // Korean
        return /[\uac00-\ud7af]/.test(text);
      case 'ara':
      case 'ar': // Arabic
        return /[\u0600-\u06ff]/.test(text);
      case 'rus':
      case 'ru': // Russian
        return /[\u0400-\u04ff]/.test(text);
      case 'tha':
      case 'th': // Thai
        return /[\u0e00-\u0e7f]/.test(text);
      case 'eng':
      case 'en': // English
        return /[a-zA-Z]/.test(text);
      default:
        return false;
    }
  }

  /**
   * Convert ISO 639-3 code to ISO 639-1 code
   */
  private convertToISO639_1(iso639_3: string): string {
    const mapping: Record<string, string> = {
      cmn: 'zh',
      eng: 'en',
      jpn: 'ja',
      kor: 'ko',
      fra: 'fr',
      deu: 'de',
      spa: 'es',
      por: 'pt',
      rus: 'ru',
      ara: 'ar',
      hin: 'hi',
      ita: 'it',
      nld: 'nl',
      pol: 'pl',
      tur: 'tr',
      tha: 'th',
      vie: 'vi',
      ind: 'id',
      msa: 'ms',
      tgl: 'tl',
    };

    return mapping[iso639_3] || iso639_3;
  }

  /**
   * Get language name from ISO 639-3 code
   */
  private getLanguageName(code: string): string {
    return LanguageDetector.LANGUAGE_NAMES[code] || 'Unknown';
  }

  /**
   * Get default language info for fallback
   */
  private getDefaultLanguage(): LanguageInfo {
    return {
      code: 'en',
      name: 'English',
      confidence: 0.3,
    };
  }

  /**
   * Detect if text contains multiple languages
   */
  async detectMultipleLanguages(text: string): Promise<LanguageInfo[]> {
    const sentences = text.split(/[.!?]+\s+/);
    const languages = new Map<string, { count: number; confidence: number }>();

    for (const sentence of sentences) {
      if (sentence.trim().length > 20) {
        const lang = await this.detectLanguage(sentence.trim());
        if (lang.confidence > 0.5) {
          const existing = languages.get(lang.code);
          if (existing) {
            existing.count++;
            existing.confidence = Math.max(
              existing.confidence,
              lang.confidence
            );
          } else {
            languages.set(lang.code, { count: 1, confidence: lang.confidence });
          }
        }
      }
    }

    // Convert to array and sort by count and confidence
    return Array.from(languages.entries())
      .map(([code, data]) => ({
        code,
        name: this.getLanguageName(code),
        confidence: data.confidence,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Return top 3 languages
  }
}
