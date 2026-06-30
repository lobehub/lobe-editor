export const AI_COLLABORATION_SYSTEM_PROMPT = [
  'You are an AI collaborator inside a shared rich-text editor.',
  'You must behave like a real collaboration participant, not like a background database patch.',
  'Always use tools to act in the document.',
  'First call set_ai_selection so humans can see where you intend to edit.',
  'If the task includes selected text, call replace_selection with a concise rewrite of only that selected region.',
  'If there is no selected text, call append_paragraph with concise, task-focused content. The runtime streams this paragraph into the shared editor in small chunks.',
  'Finally call finish_task with a short summary.',
  'Do not replace the whole document. Prefer small, reviewable edits.',
].join('\n');

export const aiToolDefinitions = [
  {
    description: 'Move the AI collaborator cursor to a visible location before editing.',
    input_schema: {
      additionalProperties: false,
      properties: {
        target: {
          enum: ['document_end', 'selected_range'],
          type: 'string',
        },
      },
      required: ['target'],
      type: 'object',
    },
    name: 'set_ai_selection',
  },
  {
    description: 'Replace the currently selected text through the AI collaborator Y.Doc.',
    input_schema: {
      additionalProperties: false,
      properties: {
        text: {
          minLength: 1,
          type: 'string',
        },
      },
      required: ['text'],
      type: 'object',
    },
    name: 'replace_selection',
  },
  {
    description: 'Append one paragraph through the AI collaborator Y.Doc.',
    input_schema: {
      additionalProperties: false,
      properties: {
        text: {
          minLength: 1,
          type: 'string',
        },
      },
      required: ['text'],
      type: 'object',
    },
    name: 'append_paragraph',
  },
  {
    description: 'Mark the AI task as complete and leave the final cursor visible.',
    input_schema: {
      additionalProperties: false,
      properties: {
        summary: {
          minLength: 1,
          type: 'string',
        },
      },
      required: ['summary'],
      type: 'object',
    },
    name: 'finish_task',
  },
] as const;

export type AiToolName = (typeof aiToolDefinitions)[number]['name'];

export type AiToolCall =
  | {
      input: {
        target: 'document_end' | 'selected_range';
      };
      name: 'set_ai_selection';
    }
  | {
      input: {
        text: string;
      };
      name: 'append_paragraph';
    }
  | {
      input: {
        text: string;
      };
      name: 'replace_selection';
    }
  | {
      input: {
        summary: string;
      };
      name: 'finish_task';
    };

const createParagraphText = (prompt: string) => {
  const trimmedPrompt = prompt.trim().replaceAll(/\s+/g, ' ');
  const task = trimmedPrompt || 'continue the document';

  return `AI draft for "${task}": this paragraph was inserted by a Node-side collaboration actor. The actor selected the document end, wrote through its own Y.Doc, and published the result as a normal collaboration update.`;
};

const createReplacementText = (prompt: string, selectedText: string) => {
  const task = prompt.trim().replaceAll(/\s+/g, ' ') || 'improve this text';
  const compactSelection = selectedText.trim().replaceAll(/\s+/g, ' ');

  return `${compactSelection} [AI revised: ${task}]`;
};

export const runMockModel = (prompt: string, selectedText?: string): AiToolCall[] => {
  if (selectedText) {
    return [
      {
        input: {
          target: 'selected_range',
        },
        name: 'set_ai_selection',
      },
      {
        input: {
          text: createReplacementText(prompt, selectedText),
        },
        name: 'replace_selection',
      },
      {
        input: {
          summary: 'Rewrote the selected text as the AI collaboration actor.',
        },
        name: 'finish_task',
      },
    ];
  }

  const paragraph = createParagraphText(prompt);

  return [
    {
      input: {
        target: 'document_end',
      },
      name: 'set_ai_selection',
    },
    {
      input: {
        text: paragraph,
      },
      name: 'append_paragraph',
    },
    {
      input: {
        summary: 'Inserted one paragraph as the AI collaboration actor.',
      },
      name: 'finish_task',
    },
  ];
};

interface AnthropicToolUseBlock {
  id?: string;
  input?: unknown;
  name?: string;
  type: 'tool_use';
}

interface AnthropicMessageResponse {
  content?: Array<AnthropicToolUseBlock | { text?: string; type: string }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeToolCall = (block: AnthropicToolUseBlock): AiToolCall | null => {
  if (!isRecord(block.input)) return null;

  if (
    block.name === 'set_ai_selection' &&
    (block.input.target === 'document_end' || block.input.target === 'selected_range')
  ) {
    return {
      input: {
        target: block.input.target,
      },
      name: 'set_ai_selection',
    };
  }

  if (block.name === 'append_paragraph' && typeof block.input.text === 'string') {
    return {
      input: {
        text: block.input.text,
      },
      name: 'append_paragraph',
    };
  }

  if (block.name === 'replace_selection' && typeof block.input.text === 'string') {
    return {
      input: {
        text: block.input.text,
      },
      name: 'replace_selection',
    };
  }

  if (block.name === 'finish_task' && typeof block.input.summary === 'string') {
    return {
      input: {
        summary: block.input.summary,
      },
      name: 'finish_task',
    };
  }

  return null;
};

export const runAnthropicModel = async (
  prompt: string,
  selectedText?: string,
): Promise<AiToolCall[]> => {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const token = process.env.ANTHROPIC_AUTH_TOKEN;

  if (!baseUrl || !token) {
    return runMockModel(prompt, selectedText);
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const messagesUrl = normalizedBaseUrl.endsWith('/v1')
    ? `${normalizedBaseUrl}/messages`
    : `${normalizedBaseUrl}/v1/messages`;

  const response = await fetch(messagesUrl, {
    body: JSON.stringify({
      max_tokens: 1200,
      messages: [
        {
          content: selectedText
            ? [`Instruction: ${prompt}`, '', 'Selected text to rewrite:', selectedText].join('\n')
            : prompt,
          role: 'user',
        },
      ],
      model: 'deepseek-v4-pro',
      system: AI_COLLABORATION_SYSTEM_PROMPT,
      tools: aiToolDefinitions,
    }),
    headers: {
      'anthropic-version': '2023-06-01',
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
      'x-api-key': token,
    },
    method: 'POST',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI model request failed: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as AnthropicMessageResponse;
  const textContent =
    result.content
      ?.filter((block): block is { text: string; type: string } => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim() ?? '';
  const toolCalls =
    result.content
      ?.filter((block): block is AnthropicToolUseBlock => block.type === 'tool_use')
      .map(normalizeToolCall)
      .filter(Boolean) ?? [];

  if (toolCalls.length === 0) {
    if (selectedText) {
      return [
        {
          input: {
            target: 'selected_range',
          },
          name: 'set_ai_selection',
        },
        {
          input: {
            text: textContent || createReplacementText(prompt, selectedText),
          },
          name: 'replace_selection',
        },
        {
          input: {
            summary: 'Rewrote the selected text as the AI collaboration actor.',
          },
          name: 'finish_task',
        },
      ];
    }

    return [
      {
        input: {
          target: 'document_end',
        },
        name: 'set_ai_selection',
      },
      {
        input: {
          text: textContent || createParagraphText(prompt),
        },
        name: 'append_paragraph',
      },
      {
        input: {
          summary: 'Inserted one paragraph as the AI collaboration actor.',
        },
        name: 'finish_task',
      },
    ];
  }

  const hasAppend = toolCalls.some((toolCall) => toolCall.name === 'append_paragraph');
  const hasReplacement = toolCalls.some((toolCall) => toolCall.name === 'replace_selection');
  const hasFinish = toolCalls.some((toolCall) => toolCall.name === 'finish_task');
  const fallbackEdit = selectedText
    ? ({
        input: {
          text: textContent || createReplacementText(prompt, selectedText),
        },
        name: 'replace_selection' as const,
      } satisfies AiToolCall)
    : ({
        input: {
          text: textContent || createParagraphText(prompt),
        },
        name: 'append_paragraph' as const,
      } satisfies AiToolCall);

  return [
    toolCalls[0].name === 'set_ai_selection'
      ? toolCalls[0]
      : {
          input: {
            target: selectedText ? 'selected_range' : 'document_end',
          },
          name: 'set_ai_selection',
        },
    ...toolCalls.filter((toolCall) => toolCall.name !== 'set_ai_selection'),
    ...(hasAppend || hasReplacement ? [] : [fallbackEdit]),
    ...(hasFinish
      ? []
      : [
          {
            input: {
              summary: 'Inserted one paragraph as the AI collaboration actor.',
            },
            name: 'finish_task' as const,
          },
        ]),
  ];
};
