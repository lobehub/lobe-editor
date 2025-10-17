/**
 * Language detection utility for code snippets
 * Uses pattern matching and heuristics to identify programming languages
 */

interface LanguagePattern {
  /**
   * Patterns that indicate this is NOT the language
   */
  exclude?: RegExp[];
  /**
   * Optional patterns that increase confidence
   */
  optional?: RegExp[];
  /**
   * Required patterns that must be present
   */
  required?: RegExp[];
  /**
   * Weight/confidence score (higher = more confident)
   */
  weight?: number;
}

interface LanguageDetectionResult {
  confidence: number;
  language: string;
}

const LANGUAGE_PATTERNS: Record<string, LanguagePattern> = {
  // Shell/Config
  bash: {
    optional: [/\|\||&&/, /echo\s+/, /if\s+\[/],
    required: [/^#!\/bin\/(ba)?sh/, /\${?\w+}?/],
    weight: 7,
  },

  csharp: {
    optional: [/\[.*]/, /async\s+Task/, /var\s+\w+\s*=/],
    required: [/(public|private|protected)\s+(class|interface|namespace)/, /using\s+\w+/],
    weight: 8,
  },

  css: {
    optional: [/@media|@import|@keyframes/, /!important/],
    required: [/[#.]?[\w-]+\s*{/, /:\s*[\w#%-]+;/],
    weight: 8,
  },

  dockerfile: {
    required: [/^FROM\s+/, /^(RUN|CMD|COPY|ADD|WORKDIR|ENV|EXPOSE)\s+/m],
    weight: 10,
  },

  go: {
    optional: [/import\s+\(/, /:=/, /defer|goroutine/],
    required: [/package\s+\w+/, /func\s+\w+/],
    weight: 8,
  },

  graphql: {
    optional: [/fragment\s+/, /on\s+\w+/],
    required: [/(query|mutation|subscription)\s+/, /{[\S\s]*}/],
    weight: 8,
  },

  // Web languages
  html: {
    optional: [/<\/\w+>/, /class=|id=/],
    required: [/<(html|head|body|div|span|p|a|img|script|style|link|meta)/i],
    weight: 9,
  },

  ini: {
    exclude: [/^\s*</, /{.*}/],
    required: [/^\[.*]$/m, /\w+\s*=\s*/],
    weight: 6,
  },

  java: {
    optional: [/@Override|@Autowired/, /extends|implements/, /System\.out/],
    required: [
      /(public|private|protected)\s+(class|interface|static)/,
      /\w+\s+\w+\s*\([^)]*\)\s*{/,
    ],
    weight: 8,
  },

  // JavaScript family
  javascript: {
    exclude: [/^\s*</, /interface\s+\w+/, /:\s*\w+\s*[;=]/],
    optional: [/=>\s*{/, /console\.(log|error|warn)/, /\.then\(/, /require\(/],
    required: [/(function|const|let|var|class|import|export|async|await)\s/],
    weight: 7,
  },

  // Data formats
  json: {
    optional: [/"[^"]*"\s*:/, /:\s*["'[{]/],
    required: [/^\s*[[{]/, /[\]}]\s*$/],
    weight: 10,
  },

  jsx: {
    exclude: [/^\s*<!DOCTYPE/, /^\s*<html/],
    optional: [/className=/, /{.*}/, /import.*from/],
    required: [/<\w+[^>]*>/, /(const|function|class)\s+\w+/],
    weight: 8,
  },

  makefile: {
    optional: [/\$\(.*\)/, /\.PHONY/],
    required: [/^[\w-]+:\s*/, /^\t/m],
    weight: 7,
  },

  // Other common languages
  markdown: {
    optional: [/```/, /\*\*.*\*\*/, /^\s*[*+-]\s+/m],
    required: [/^#{1,6}\s+/, /\[.*]\(.*\)/],
    weight: 6,
  },

  php: {
    optional: [/function\s+\w+/, /class\s+\w+/, /echo|print/],
    required: [/<\?php/, /\$\w+/],
    weight: 10,
  },

  powershell: {
    optional: [/\|\s*Where/, /\|\s*Select/, /param\(/],
    required: [/\$\w+/, /(Get|Set|New|Remove)-\w+/],
    weight: 8,
  },

  // Backend languages
  python: {
    optional: [/if __name__|print\(/, /self\.|lambda/, /@\w+\s*$/m],
    required: [/(def|class|import|from)\s+\w+/, /:\s*$/m],
    weight: 8,
  },

  ruby: {
    optional: [/do\s*\|.*\|/, /puts|require/, /:\w+\s*=>/],
    required: [/(def|class|module|end)\s/, /@\w+/],
    weight: 7,
  },

  rust: {
    optional: [/::\w+/, /&mut|&str/, /#\[derive\(/],
    required: [/(fn|struct|impl|trait|use)\s+/, /let\s+(mut\s+)?\w+/],
    weight: 8,
  },

  scss: {
    optional: [/@mixin|@include|@extend/, /#{.*}/],
    required: [/\$[\w-]+\s*:/, /[&@]\w+/],
    weight: 8,
  },

  // Database
  sql: {
    optional: [/from|where|join|group by|order by/i, /\*/],
    required: [/(select|insert|update|delete|create|alter|drop)\s+/i],
    weight: 9,
  },

  // Config formats
  toml: {
    optional: [/\[\[.*]]/, /"""[\S\s]*"""/],
    required: [/^\[.*]$/m, /\w+\s*=\s*[\w"']/],
    weight: 8,
  },

  tsx: {
    optional: [/:\s*React\./, /:\s*FC</, /useState|useEffect/],
    required: [/<\w+[^>]*>/, /interface|type\s+\w+/],
    weight: 9,
  },

  typescript: {
    optional: [/<\w+>/, /as\s+\w+/, /implements|extends/],
    required: [/(interface|type|enum)\s+\w+/, /:\s*\w+(\[]|<.+>)?\s*[);=]/],
    weight: 8,
  },

  xml: {
    optional: [/<\/\w+>/, /xmlns/],
    required: [/<\?xml|<\w+[^>]*>/],
    weight: 9,
  },

  yaml: {
    exclude: [/^\s*[[\]{]/],
    required: [/^[\s-]*\w+:\s*/, /^[\s-]*-\s+/m],
    weight: 8,
  },
};

/**
 * Detect the programming language of a code snippet
 * @param code - The code snippet to analyze
 * @returns Language detection result with confidence score
 */
export function detectLanguage(code: string): LanguageDetectionResult | null {
  if (!code || code.trim().length === 0) {
    return null;
  }

  const trimmed = code.trim();
  const scores: Record<string, number> = {};

  // Test each language pattern
  for (const [language, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    let score = 0;
    const baseWeight = pattern.weight || 5;

    // Check exclude patterns first
    if (pattern.exclude) {
      const hasExclude = pattern.exclude.some((regex) => regex.test(trimmed));
      if (hasExclude) {
        continue; // Skip this language
      }
    }

    // Check required patterns
    if (pattern.required) {
      const allRequired = pattern.required.every((regex) => regex.test(trimmed));
      if (!allRequired) {
        continue; // All required patterns must match
      }
      score += baseWeight * 2; // Strong indicator
    }

    // Check optional patterns
    if (pattern.optional) {
      const matchedOptional = pattern.optional.filter((regex) => regex.test(trimmed)).length;
      score += matchedOptional * baseWeight;
    }

    if (score > 0) {
      scores[language] = score;
    }
  }

  // Find language with highest score
  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return null;
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [topLanguage, topScore] = entries[0];

  // Calculate confidence (0-100)
  const maxPossibleScore = (LANGUAGE_PATTERNS[topLanguage].weight || 5) * 5;
  const confidence = Math.min(100, Math.round((topScore / maxPossibleScore) * 100));

  // Only return if confidence is high enough
  if (confidence < 30) {
    return null;
  }

  return {
    confidence,
    language: topLanguage,
  };
}

/**
 * Simple detection for common formats with high confidence
 * Falls back to detectLanguage for more complex detection
 */
export function detectCodeLanguage(code: string): string | null {
  const trimmed = code.trim();

  // Fast path for JSON
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }

  // Fast path for common patterns
  if (/^\s*(select|insert|update|delete|create|alter|drop)\s+/i.test(code)) {
    return 'sql';
  }

  if (/^<\?xml/i.test(code)) {
    return 'xml';
  }

  if (/^FROM\s+|^RUN\s+|^CMD\s+/m.test(code)) {
    return 'dockerfile';
  }

  if (/<\?php/.test(code)) {
    return 'php';
  }

  // Use pattern matching for complex detection
  const result = detectLanguage(code);
  return result && result.confidence > 50 ? result.language : null;
}
