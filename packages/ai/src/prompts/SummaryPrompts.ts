/**
 * 摘要生成提示词管理器
 * 提供多语言、多长度的专业摘要提示词
 */

import type { SummaryOptions } from '../types';

export class SummaryPrompts {
  /**
   * 获取摘要系统提示词
   */
  getSummarySystemPrompt(options: SummaryOptions = {}): string {
    const language = options.language || 'en';
    const length = options.summaryLength || 'medium';

    const basePrompt = this.getLanguageSpecificPrompt(language);
    const lengthGuideline = this.getLengthGuideline(length, language);
    const qualityRequirements = this.getQualityRequirements(language);

    return `${basePrompt}

${lengthGuideline}

${qualityRequirements}`;
  }

  /**
   * 获取语言特定的基础提示词
   */
  private getLanguageSpecificPrompt(language: string): string {
    const prompts = {
      zh: `你是一个专业的中文内容摘要生成器。请为以下网页内容生成一个准确、简洁的中文摘要。
你的任务是提取主要观点、关键信息和核心见解，帮助读者快速理解内容的精髓。`,

      en: `You are a professional content summarizer. Please generate an accurate and concise summary of the following web content.
Your task is to extract the main points, key information, and core insights to help readers quickly understand the essence of the content.`,

      ja: `あなたは専門的なコンテンツ要約生成器です。以下のウェブコンテンツの正確で簡潔な要約を生成してください。
あなたの任務は、主要なポイント、重要な情報、核心となる洞察を抽出し、読者がコンテンツの本質を素早く理解できるよう支援することです。`,

      ko: `당신은 전문적인 콘텐츠 요약 생성기입니다. 다음 웹 콘텐츠의 정확하고 간결한 요약을 생성해 주세요.
당신의 임무는 주요 포인트, 핵심 정보, 핵심 통찰력을 추출하여 독자가 콘텐츠의 본질을 빠르게 이해할 수 있도록 돕는 것입니다.`,

      fr: `Vous êtes un générateur professionnel de résumés de contenu. Veuillez générer un résumé précis et concis du contenu web suivant.
Votre tâche est d'extraire les points principaux, les informations clés et les perspectives fondamentales pour aider les lecteurs à comprendre rapidement l'essence du contenu.`,

      de: `Sie sind ein professioneller Content-Zusammenfasser. Bitte erstellen Sie eine präzise und prägnante Zusammenfassung des folgenden Webinhalts.
Ihre Aufgabe ist es, die Hauptpunkte, wichtige Informationen und Kernerkenntnisse zu extrahieren, um den Lesern zu helfen, das Wesentliche des Inhalts schnell zu verstehen.`,

      es: `Eres un generador profesional de resúmenes de contenido. Por favor, genera un resumen preciso y conciso del siguiente contenido web.
Tu tarea es extraer los puntos principales, información clave y perspectivas fundamentales para ayudar a los lectores a comprender rápidamente la esencia del contenido.`,

      it: `Sei un generatore professionale di riassunti di contenuti. Per favore, genera un riassunto accurato e conciso del seguente contenuto web.
Il tuo compito è estrarre i punti principali, le informazioni chiave e le intuizioni fondamentali per aiutare i lettori a comprendere rapidamente l'essenza del contenuto.`,

      pt: `Você é um gerador profissional de resumos de conteúdo. Por favor, gere um resumo preciso e conciso do seguinte conteúdo web.
Sua tarefa é extrair os pontos principais, informações-chave e insights fundamentais para ajudar os leitores a entender rapidamente a essência do conteúdo.`,

      ru: `Вы профессиональный генератор резюме контента. Пожалуйста, создайте точное и краткое резюме следующего веб-контента.
Ваша задача - извлечь основные моменты, ключевую информацию и основные выводы, чтобы помочь читателям быстро понять суть контента.`,

      ar: `أنت مولد محترف لملخصات المحتوى. يرجى إنشاء ملخص دقيق وموجز للمحتوى التالي على الويب.
مهمتك هي استخراج النقاط الرئيسية والمعلومات الأساسية والرؤى الجوهرية لمساعدة القراء على فهم جوهر المحتوى بسرعة.`,

      hi: `आप एक पेशेवर सामग्री सारांश जेनरेटर हैं। कृपया निम्नलिखित वेब सामग्री का एक सटीक और संक्षिप्त सारांश उत्पन्न करें।
आपका कार्य मुख्य बिंदुओं, महत्वपूर्ण जानकारी और मूल अंतर्दृष्टि को निकालना है ताकि पाठकों को सामग्री के सार को जल्दी समझने में मदद मिल सके।`,
    };

    return prompts[language as keyof typeof prompts] || prompts['en'];
  }

  /**
   * 获取长度指导原则
   */
  private getLengthGuideline(length: string, language: string): string {
    const guidelines = {
      zh: {
        short:
          '生成一个简短摘要（50-150字）：\n- 专注于最核心的1-2个要点\n- 使用简洁明了的语言\n- 适合快速浏览',
        medium:
          '生成一个中等长度摘要（100-350字）：\n- 涵盖3-5个主要观点\n- 保持平衡的详细程度\n- 适合深度理解',
        long: '生成一个详细摘要（200-500字）：\n- 全面覆盖所有重要内容\n- 包含支持细节和示例\n- 适合全面了解',
      },
      en: {
        short:
          'Generate a brief summary (50-150 characters):\n- Focus on the most essential 1-2 points\n- Use clear and concise language\n- Suitable for quick scanning',
        medium:
          'Generate a medium-length summary (100-350 characters):\n- Cover 3-5 main points\n- Maintain balanced detail level\n- Suitable for in-depth understanding',
        long: 'Generate a detailed summary (200-500 characters):\n- Comprehensively cover all important content\n- Include supporting details and examples\n- Suitable for comprehensive understanding',
      },
    };

    const langGuidelines =
      guidelines[language as keyof typeof guidelines] || guidelines['en'];
    return (
      langGuidelines[length as keyof typeof langGuidelines] ||
      langGuidelines['medium']
    );
  }

  /**
   * 获取质量要求
   */
  private getQualityRequirements(language: string): string {
    const requirements = {
      zh: `请确保摘要：
1. 准确反映原文主要内容和观点
2. 使用清晰简洁的语言表达
3. 保持客观中性的语调
4. 避免引入原文中没有的信息
5. 符合指定的长度要求
6. 保持逻辑连贯性
7. 如果原文是技术内容，保留关键技术术语
8. 如果原文包含数据或统计信息，保留重要数字`,

      en: `Please ensure the summary:
1. Accurately reflects the main content and viewpoints of the original text
2. Uses clear and concise language
3. Maintains an objective and neutral tone
4. Avoids introducing information not present in the original text
5. Meets the specified length requirements
6. Maintains logical coherence
7. If the original is technical content, preserve key technical terms
8. If the original contains data or statistics, retain important numbers`,
    };

    return (
      requirements[language as keyof typeof requirements] || requirements['en']
    );
  }

  /**
   * 获取特定主题的摘要提示词
   */
  getTopicSpecificPrompt(topic: string, language: string = 'en'): string {
    const topicPrompts = {
      zh: {
        news: '这是一篇新闻文章。请重点关注：事件的核心信息（何时、何地、何人、何事）、背景context、影响和意义。',
        tech: '这是一篇技术文章。请重点关注：核心技术概念、实现方法、优势特点、应用场景和局限性。',
        academic:
          '这是一篇学术论文。请重点关注：研究问题、方法论、主要发现、结论和研究意义。',
        business:
          '这是一篇商业文章。请重点关注：商业模式、市场分析、关键策略、财务表现和未来展望。',
        tutorial:
          '这是一篇教程指南。请重点关注：学习目标、关键步骤、重要概念和实践要点。',
      },
      en: {
        news: 'This is a news article. Please focus on: core event information (when, where, who, what), background context, impact and significance.',
        tech: 'This is a technical article. Please focus on: core technical concepts, implementation methods, advantages, use cases, and limitations.',
        academic:
          'This is an academic paper. Please focus on: research question, methodology, main findings, conclusions, and research significance.',
        business:
          'This is a business article. Please focus on: business model, market analysis, key strategies, financial performance, and future outlook.',
        tutorial:
          'This is a tutorial guide. Please focus on: learning objectives, key steps, important concepts, and practical points.',
      },
    };

    const langPrompts =
      topicPrompts[language as keyof typeof topicPrompts] || topicPrompts['en'];
    return langPrompts[topic as keyof typeof langPrompts] || '';
  }

  /**
   * 获取内容预处理提示词
   */
  getPreprocessingPrompt(language: string = 'en'): string {
    const prompts = {
      zh: `在开始摘要之前，请：
1. 识别内容的主要结构和逻辑流程
2. 区分主要信息和支持细节
3. 注意文章的核心论点或主题
4. 考虑内容的目标受众和写作目的`,

      en: `Before starting the summary, please:
1. Identify the main structure and logical flow of the content
2. Distinguish between main information and supporting details
3. Note the core arguments or themes of the article
4. Consider the target audience and writing purpose of the content`,
    };

    return prompts[language as keyof typeof prompts] || prompts['en'];
  }

  /**
   * 获取后处理验证提示词
   */
  getValidationPrompt(language: string = 'en'): string {
    const prompts = {
      zh: `请检查你的摘要：
1. 是否遗漏了任何关键信息？
2. 是否包含了原文中没有的内容？
3. 语言是否清晰易懂？
4. 长度是否符合要求？
5. 逻辑是否连贯？`,

      en: `Please check your summary:
1. Are any key pieces of information missing?
2. Does it contain content not present in the original?
3. Is the language clear and understandable?
4. Does the length meet the requirements?
5. Is the logic coherent?`,
    };

    return prompts[language as keyof typeof prompts] || prompts['en'];
  }
}
