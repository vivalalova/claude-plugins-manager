import { getFlatFieldSchema } from '../../../shared/claude-settings-schema';
import type { ValueSchema } from '../../../shared/claude-settings-schema';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateValue(value: unknown, schema: ValueSchema, path: string): string | null {
  switch (schema.kind) {
    case 'string':
      if (typeof value !== 'string') return `${path} must be a string`;
      if (schema.enum && !schema.enum.includes(value)) {
        return `${path} must be one of: ${schema.enum.join(', ')}`;
      }
      return null;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return `${path} must be a number`;
      if (schema.min !== undefined && value < schema.min) return `${path} must be >= ${schema.min}`;
      if (schema.max !== undefined && value > schema.max) return `${path} must be <= ${schema.max}`;
      if (schema.step !== undefined && !isStepAligned(value, schema.step, schema.min ?? 0)) {
        return `${path} must match step ${schema.step}`;
      }
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : `${path} must be a boolean`;
    case 'literal':
      return Object.is(value, schema.value) ? null : `${path} must be ${JSON.stringify(schema.value)}`;
    case 'array':
      if (!Array.isArray(value)) return `${path} must be an array`;
      for (let index = 0; index < value.length; index += 1) {
        const error = validateValue(value[index], schema.item, `${path}[${index}]`);
        if (error) return error;
      }
      return null;
    case 'record':
      if (!isPlainObject(value)) return `${path} must be an object`;
      for (const [key, entry] of Object.entries(value)) {
        const error = validateValue(entry, schema.value, `${path}.${key}`);
        if (error) return error;
      }
      return null;
    case 'object': {
      if (!isPlainObject(value)) return `${path} must be an object`;
      for (const key of Object.keys(value)) {
        if (!(key in schema.properties)) {
          return `${path}.${key} is not allowed`;
        }
      }
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (!(key in value)) {
          if (!prop.optional) return `${path}.${key} is required`;
          continue;
        }
        const error = validateValue(value[key], prop.schema, `${path}.${key}`);
        if (error) return error;
      }
      return null;
    }
    case 'union': {
      const errors = schema.anyOf
        .map((member) => validateValue(value, member, path))
        .filter((error): error is string => Boolean(error));
      return errors.length === schema.anyOf.length
        ? `${path} does not match any allowed shape`
        : null;
    }
  }
}

function isStepAligned(value: number, step: number, base: number): boolean {
  const quotient = (value - base) / step;
  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}

export function validateJsonSettingValue(settingKey: string, parsed: unknown): void {
  const field = getFlatFieldSchema(settingKey);
  if (!field) {
    throw new Error(`Unknown settings key "${settingKey}"`);
  }
  const error = validateValue(parsed, field.valueSchema, settingKey);
  if (error) {
    throw new Error(error);
  }
}

export function parseJsonSettingValue(settingKey: string, rawValue: string): unknown {
  const parsed = JSON.parse(rawValue);
  validateJsonSettingValue(settingKey, parsed);
  return parsed;
}
