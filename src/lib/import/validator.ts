import { z } from 'zod';
import type { ParsedDescriptor } from './excel-parser';

/**
 * Schema for a parsed descriptor before database insertion.
 */
export const parsedDescriptorSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  criterionName: z.string().min(2, 'Criterion name must be at least 2 characters'),
  excellent: z.string().default(''),
  good: z.string().default(''),
  pass: z.string().default(''),
  belowPass: z.string().default(''),
  category: z.string().optional(),
  skillName: z.string().min(1, 'Skill name is required'),
  warnings: z.array(z.string()).default([])
});

/**
 * Schema for descriptor ready for database insertion.
 */
export const descriptorImportSchema = z.object({
  code: z.string().min(1),
  criterionName: z.string().min(2),
  excellent: z.string().nullable(),
  good: z.string().nullable(),
  pass: z.string().nullable(),
  belowPass: z.string().nullable(),
  category: z.string().nullable(),
  skillName: z.string().min(1),
  sector: z.string().nullable(),
  source: z.literal('WSC2024'),
  version: z.number().int().positive().default(1),
  tags: z.array(z.string()).default([])
});

export type ParsedDescriptorInput = z.input<typeof parsedDescriptorSchema>;
export type DescriptorImport = z.infer<typeof descriptorImportSchema>;

export interface ValidationResult {
  valid: boolean;
  data?: DescriptorImport;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a parsed descriptor and prepares it for database insertion.
 */
export function validateDescriptor(descriptor: ParsedDescriptor): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [...descriptor.warnings];

  // Basic validation
  if (!descriptor.code || descriptor.code.trim().length === 0) {
    errors.push('Missing code');
  }

  if (!descriptor.criterionName || descriptor.criterionName.trim().length < 2) {
    errors.push('Criterion name too short or missing');
  }

  if (!descriptor.skillName || descriptor.skillName.trim().length === 0) {
    errors.push('Missing skill name');
  }

  // Check for minimum content (at least criterion name OR one performance level)
  const hasContent = descriptor.criterionName.length >= 5 ||
    descriptor.excellent.length > 0 ||
    descriptor.good.length > 0 ||
    descriptor.pass.length > 0 ||
    descriptor.belowPass.length > 0;

  if (!hasContent) {
    errors.push('Descriptor has no meaningful content');
  }

  // Quality warnings
  if (descriptor.excellent.length === 0 && descriptor.good.length === 0 &&
      descriptor.pass.length === 0 && descriptor.belowPass.length === 0) {
    warnings.push('No performance levels defined');
  }

  if (descriptor.criterionName.length > 500) {
    warnings.push('Criterion name is unusually long (>500 chars)');
  }

  const allLevels = [descriptor.excellent, descriptor.good, descriptor.pass, descriptor.belowPass];
  if (allLevels.some(l => l.length > 2000)) {
    warnings.push('Performance level text is unusually long (>2000 chars)');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Prepare for database
  const data: DescriptorImport = {
    code: descriptor.code.trim(),
    criterionName: descriptor.criterionName.trim(),
    excellent: descriptor.excellent || null,
    good: descriptor.good || null,
    pass: descriptor.pass || null,
    belowPass: descriptor.belowPass || null,
    category: descriptor.category || null,
    skillName: descriptor.skillName.trim(),
    sector: null, // Could be enriched from skill metadata
    source: 'WSC2024',
    version: 1,
    tags: []
  };

  return { valid: true, data, errors: [], warnings };
}

/**
 * Validates a batch of descriptors.
 */
export function validateDescriptorBatch(descriptors: ParsedDescriptor[]): {
  valid: DescriptorImport[];
  invalid: { descriptor: ParsedDescriptor; errors: string[] }[];
  allWarnings: { descriptor: ParsedDescriptor; warnings: string[] }[];
} {
  const valid: DescriptorImport[] = [];
  const invalid: { descriptor: ParsedDescriptor; errors: string[] }[] = [];
  const allWarnings: { descriptor: ParsedDescriptor; warnings: string[] }[] = [];

  for (const descriptor of descriptors) {
    const result = validateDescriptor(descriptor);

    if (result.valid && result.data) {
      valid.push(result.data);
    } else {
      invalid.push({ descriptor, errors: result.errors });
    }

    if (result.warnings.length > 0) {
      allWarnings.push({ descriptor, warnings: result.warnings });
    }
  }

  return { valid, invalid, allWarnings };
}
