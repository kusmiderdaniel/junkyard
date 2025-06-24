import DOMPurify from 'dompurify';

/**
 * Input sanitization utility to prevent XSS attacks
 * Uses DOMPurify to clean user input while preserving legitimate content
 */

export interface SanitizationOptions {
  allowBasicHTML?: boolean;
  preserveWhitespace?: boolean;
  maxLength?: number;
}

/**
 * Sanitize text input to prevent XSS attacks
 * @param input - The input string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string safe for use in React components
 */
export const sanitizeInput = (
  input: string | undefined | null,
  options: SanitizationOptions = {}
): string => {
  // Handle null/undefined inputs
  if (!input) return '';

  const {
    allowBasicHTML = false,
    preserveWhitespace = true,
    maxLength = 10000,
  } = options;

  // Trim input if it exceeds max length
  let cleanInput =
    input.length > maxLength ? input.substring(0, maxLength) : input;

  if (allowBasicHTML) {
    // Allow basic HTML tags for rich text inputs (very restrictive)
    cleanInput = DOMPurify.sanitize(cleanInput, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      USE_PROFILES: { html: true },
    });
  } else {
    // For regular text inputs, strip all HTML but keep content
    cleanInput = DOMPurify.sanitize(cleanInput, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  }

  // Preserve or normalize whitespace
  if (!preserveWhitespace) {
    cleanInput = cleanInput.replace(/\s+/g, ' ').trim();
  }

  return cleanInput;
};

/**
 * Sanitize form data object
 * @param formData - Object containing form field values
 * @param fieldOptions - Per-field sanitization options
 * @returns Sanitized form data object
 */
export const sanitizeFormData = <T extends Record<string, any>>(
  formData: T,
  fieldOptions: Partial<Record<keyof T, SanitizationOptions>> = {}
): T => {
  const sanitizedData = { ...formData };

  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      const options = fieldOptions[key as keyof T] || {};
      sanitizedData[key as keyof T] = sanitizeInput(
        value,
        options
      ) as T[keyof T];
    }
  }

  return sanitizedData;
};

/**
 * Sanitize client data specifically
 * @param clientData - Client form data
 * @returns Sanitized client data
 */
export const sanitizeClientData = (clientData: {
  name: string;
  address: string;
  documentNumber: string;
  postalCode: string;
  city: string;
  [key: string]: any;
}) => {
  return sanitizeFormData(clientData, {
    name: { maxLength: 200 },
    address: { maxLength: 500 },
    documentNumber: { maxLength: 50 },
    postalCode: { maxLength: 20, preserveWhitespace: false },
    city: { maxLength: 100 },
  });
};

/**
 * Sanitize company details data
 * @param companyData - Company details form data
 * @returns Sanitized company data
 */
export const sanitizeCompanyData = (companyData: {
  companyName: string;
  numberNIP: string;
  numberREGON: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  phoneNumber: string;
  [key: string]: any;
}) => {
  return sanitizeFormData(companyData, {
    companyName: { maxLength: 200 },
    numberNIP: { maxLength: 20, preserveWhitespace: false },
    numberREGON: { maxLength: 20, preserveWhitespace: false },
    address: { maxLength: 500 },
    postalCode: { maxLength: 20, preserveWhitespace: false },
    city: { maxLength: 100 },
    email: { maxLength: 200, preserveWhitespace: false },
    phoneNumber: { maxLength: 50, preserveWhitespace: false },
  });
};

/**
 * Sanitize search input with special handling for search queries
 * @param searchInput - Search query string
 * @returns Sanitized search string
 */
export const sanitizeSearchInput = (searchInput: string): string => {
  return sanitizeInput(searchInput, {
    maxLength: 500,
    preserveWhitespace: false,
  });
};

/**
 * Create a sanitized event handler for input changes
 * @param setter - State setter function
 * @param options - Sanitization options
 * @returns Event handler function
 */
export const createSanitizedInputHandler = (
  setter: (value: string) => void,
  options: SanitizationOptions = {}
) => {
  return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const sanitizedValue = sanitizeInput(e.target.value, options);
    setter(sanitizedValue);
  };
};

/**
 * Validate that input doesn't contain potential XSS patterns
 * @param input - Input to validate
 * @returns true if input appears safe, false if suspicious
 */
export const validateInputSafety = (input: string): boolean => {
  // Check for common XSS patterns
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  return !xssPatterns.some(pattern => pattern.test(input));
};

const inputSanitizer = {
  sanitizeInput,
  sanitizeFormData,
  sanitizeClientData,
  sanitizeCompanyData,
  sanitizeSearchInput,
  createSanitizedInputHandler,
  validateInputSafety,
};

export default inputSanitizer;
