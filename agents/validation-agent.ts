export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationAgent {
  name: string;
  description: string;
  version: string;
  run(data: any): Promise<ValidationResult>;
  parseJSON<T>(raw: string, fallback: T): T;
}

export const ValidationAgent: ValidationAgent = {
  name: 'ValidationAgent',
  description: 'Validates AI-generated content and provides error/warning feedback',
  version: '1.0.0',

  async run(data: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate email data structure
    if (!data) {
      errors.push('No data provided');
      return { isValid: false, errors, warnings };
    }

    // Check for required fields
    if (data.subject && typeof data.subject !== 'string') {
      errors.push('Subject must be a string');
    }

    if (data.body && typeof data.body !== 'string') {
      errors.push('Body must be a string');
    }

    // Check for common AI hallucination patterns
    if (data.body) {
      if (data.body.includes('[Company Name]') || data.body.includes('[Job Title]')) {
        warnings.push('Detected placeholder text in body');
      }
      if (data.body.length < 10) {
        warnings.push('Body is suspiciously short');
      }
    }

    // Validate priority scores
    if (data.priorityScore !== undefined) {
      if (typeof data.priorityScore !== 'number') {
        errors.push('Priority score must be a number');
      }
      if (data.priorityScore < 0 || data.priorityScore > 100) {
        errors.push('Priority score must be between 0 and 100');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  },

  parseJSON<T>(raw: string, fallback: T): T {
    try {
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as T;
    } catch {
      return fallback;
    }
  }
};
