import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export type ClaudeError = { error: string; raw: string };

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
const anthropic = new Anthropic({ apiKey });

const BASE_SYSTEM_PROMPT =
  'You are a JSON API. Always respond with valid JSON that exactly matches ' +
  'the requested schema. Do not include markdown, code fences, or explanation.';

interface AskClaudeOptions {
  model?: string;
  maxTokens?: number;
  systemSuffix?: string;
}

async function callClaude(
  prompt: string,
  systemPrompt: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== 'text') {
    throw { error: 'Unexpected response type from Claude', raw: JSON.stringify(response.content) } satisfies ClaudeError;
  }
  return block.text;
}

function tryParse<T>(raw: string, schema: z.ZodType<T>): z.SafeParseReturnType<unknown, T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      success: false,
      error: new z.ZodError([{
        code: z.ZodIssueCode.custom,
        path: [],
        message: `JSON syntax error: ${(err as SyntaxError).message}`,
      }]),
    } as z.SafeParseReturnType<unknown, T>;
  }
  return schema.safeParse(parsed);
}

export async function askClaude<T>(
  prompt: string,
  schema: z.ZodType<T>,
  options?: AskClaudeOptions,
): Promise<T> {
  const model = options?.model ?? 'claude-opus-4-6';
  const maxTokens = options?.maxTokens ?? 1024;
  const systemPrompt = options?.systemSuffix
    ? `${BASE_SYSTEM_PROMPT}\n${options.systemSuffix}`
    : BASE_SYSTEM_PROMPT;

  const raw1 = await callClaude(prompt, systemPrompt, model, maxTokens);
  const result1 = tryParse(raw1, schema);
  if (result1.success) return result1.data;

  const retryPrompt =
    `${prompt}\n\n` +
    `Your previous response was invalid or did not match the schema.\n` +
    `Error: ${result1.error.message}\n` +
    `Raw response: ${raw1}\n` +
    `Please return only valid JSON matching the schema.`;

  const raw2 = await callClaude(retryPrompt, systemPrompt, model, maxTokens);
  const result2 = tryParse(raw2, schema);
  if (result2.success) return result2.data;

  throw { error: result2.error.message, raw: raw2 } satisfies ClaudeError;
}
