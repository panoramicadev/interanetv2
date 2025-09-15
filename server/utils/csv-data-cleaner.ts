/**
 * Robust CSV Data Cleaning Engine
 * Handles common real-world CSV data issues
 */

export interface DataCleaningOptions {
  // Numeric field options
  treatEmptyAsNull?: boolean;
  convertCommaDecimals?: boolean;
  allowNegativeNumbers?: boolean;
  
  // String field options
  trimWhitespace?: boolean;
  convertEmptyStringToNull?: boolean;
  
  // Special value handling
  nullValues?: string[];
  defaultValues?: Record<string, any>;
}

export interface CleaningResult {
  value: any;
  warnings: string[];
  transformed: boolean;
  originalValue: any;
}

export class CSVDataCleaner {
  private options: Required<DataCleaningOptions>;
  
  constructor(options: DataCleaningOptions = {}) {
    this.options = {
      treatEmptyAsNull: true,
      convertCommaDecimals: true,
      allowNegativeNumbers: true,
      trimWhitespace: true,
      convertEmptyStringToNull: true,
      nullValues: ['', 'N/A', 'NULL', 'null', '-', '--', 'n/a', 'N/a', 'N.A.', 'NA', 'na'],
      defaultValues: {},
      ...options
    };
  }

  /**
   * Clean a single value based on expected type
   */
  cleanValue(value: any, expectedType: 'string' | 'number' | 'boolean' | 'date', fieldName?: string): CleaningResult {
    const result: CleaningResult = {
      value,
      warnings: [],
      transformed: false,
      originalValue: value
    };

    // Step 1: Handle null/undefined
    if (value === null || value === undefined) {
      result.value = null;
      return result;
    }

    // Step 2: Convert to string for processing
    let stringValue = String(value);
    
    // Step 3: Trim whitespace
    if (this.options.trimWhitespace) {
      const trimmed = stringValue.trim();
      if (trimmed !== stringValue) {
        result.transformed = true;
        result.warnings.push(`Trimmed whitespace from "${stringValue}" to "${trimmed}"`);
        stringValue = trimmed;
      }
    }

    // Step 4: Check for null values
    if (this.options.nullValues.includes(stringValue.toLowerCase()) || 
        (this.options.convertEmptyStringToNull && stringValue === '')) {
      result.value = null;
      result.transformed = true;
      result.warnings.push(`Converted "${result.originalValue}" to null`);
      return result;
    }

    // Step 5: Type-specific cleaning
    switch (expectedType) {
      case 'string':
        result.value = stringValue;
        break;
        
      case 'number':
        result.value = this.cleanNumericValue(stringValue, result);
        break;
        
      case 'boolean':
        result.value = this.cleanBooleanValue(stringValue, result);
        break;
        
      case 'date':
        result.value = this.cleanDateValue(stringValue, result);
        break;
        
      default:
        result.value = stringValue;
    }

    // Step 6: Apply default values if needed
    if ((result.value === null || result.value === undefined) && 
        fieldName && this.options.defaultValues[fieldName] !== undefined) {
      result.value = this.options.defaultValues[fieldName];
      result.transformed = true;
      result.warnings.push(`Applied default value: ${result.value}`);
    }

    return result;
  }

  /**
   * Clean numeric values
   */
  private cleanNumericValue(value: string, result: CleaningResult): number | null {
    if (!value || value === '') return null;

    let numericString = value;

    // Handle common numeric formats
    // Replace comma with dot for decimal separator
    if (this.options.convertCommaDecimals && numericString.includes(',')) {
      // Check if it's likely a decimal comma (not thousands separator)
      const commaIndex = numericString.lastIndexOf(',');
      const afterComma = numericString.slice(commaIndex + 1);
      
      // If there are 1-3 digits after comma, treat as decimal
      if (afterComma.length <= 3 && /^\d+$/.test(afterComma)) {
        numericString = numericString.replace(',', '.');
        result.transformed = true;
        result.warnings.push(`Converted comma decimal: "${value}" to "${numericString}"`);
      }
    }

    // Remove thousands separators (dots in Chilean format)
    const thousandsSeparatorPattern = /(\d)\.(\d{3})/g;
    if (thousandsSeparatorPattern.test(numericString)) {
      const cleaned = numericString.replace(/\./g, '');
      // But keep the last dot if it looks like decimal
      const lastDot = cleaned.lastIndexOf('.');
      if (lastDot > -1 && cleaned.length - lastDot <= 4) {
        // This was likely a decimal point, not thousands separator
        numericString = cleaned;
      } else {
        numericString = cleaned;
      }
      result.transformed = true;
      result.warnings.push(`Removed thousands separators: "${value}" to "${numericString}"`);
    }

    // Remove currency symbols and spaces
    numericString = numericString.replace(/[$\s]/g, '');
    
    // Parse as number
    const parsed = parseFloat(numericString);
    
    if (isNaN(parsed)) {
      result.warnings.push(`Could not parse "${value}" as number, setting to null`);
      return null;
    }

    if (!this.options.allowNegativeNumbers && parsed < 0) {
      result.warnings.push(`Negative number "${parsed}" converted to positive`);
      return Math.abs(parsed);
    }

    return parsed;
  }

  /**
   * Clean boolean values
   */
  private cleanBooleanValue(value: string, result: CleaningResult): boolean | null {
    const lowerValue = value.toLowerCase();
    
    const trueValues = ['true', 'yes', 'y', '1', 'si', 'sí', 'verdadero'];
    const falseValues = ['false', 'no', 'n', '0', 'falso'];
    
    if (trueValues.includes(lowerValue)) {
      if (value !== 'true') {
        result.transformed = true;
        result.warnings.push(`Converted "${value}" to boolean true`);
      }
      return true;
    }
    
    if (falseValues.includes(lowerValue)) {
      if (value !== 'false') {
        result.transformed = true;
        result.warnings.push(`Converted "${value}" to boolean false`);
      }
      return false;
    }

    result.warnings.push(`Could not parse "${value}" as boolean, setting to null`);
    return null;
  }

  /**
   * Clean date values
   */
  private cleanDateValue(value: string, result: CleaningResult): string | null {
    // Basic date cleaning - can be extended
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(value)) {
      return value;
    }

    // Try to parse and reformat common date formats
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const isoDate = date.toISOString().split('T')[0];
      if (value !== isoDate) {
        result.transformed = true;
        result.warnings.push(`Converted date "${value}" to ISO format "${isoDate}"`);
      }
      return isoDate;
    }

    result.warnings.push(`Could not parse "${value}" as date, setting to null`);
    return null;
  }

  /**
   * Clean an entire row of CSV data
   */
  cleanRow(row: Record<string, any>, fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'date'>): {
    cleanedRow: Record<string, any>;
    warnings: Array<{field: string, warnings: string[]}>;
    transformations: number;
  } {
    const cleanedRow: Record<string, any> = {};
    const warnings: Array<{field: string, warnings: string[]}> = [];
    let transformations = 0;

    for (const [field, value] of Object.entries(row)) {
      const expectedType = fieldTypes[field] || 'string';
      const cleaningResult = this.cleanValue(value, expectedType, field);
      
      cleanedRow[field] = cleaningResult.value;
      
      if (cleaningResult.warnings.length > 0) {
        warnings.push({
          field,
          warnings: cleaningResult.warnings
        });
      }
      
      if (cleaningResult.transformed) {
        transformations++;
      }
    }

    return { cleanedRow, warnings, transformations };
  }

  /**
   * Remove accents and normalize Spanish characters
   */
  private static normalizeSpanishText(text: string): string {
    return text
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Auto-detect column mappings from CSV headers with exact matching and Spanish accent support
   */
  static detectColumnMapping(csvHeaders: string[]): Record<string, string> {
    const mappings: Record<string, string[]> = {
      codigo: ['codigo', 'código', 'cod', 'code', 'sku', 'id', 'kopr', 'item_code'],
      producto: ['producto', 'nombre', 'name', 'description', 'descripcion', 'descripción', 'nokopr', 'product_name'],
      unidad: ['unidad', 'unit', 'medida', 'ud', 'measure'],
      lista: ['lista', 'list_price', 'precio_lista', 'list', 'precio', 'price'],
      desc10: ['desc10', 'descuento10', 'discount10', '10%', 'desc_10'],
      desc10_5: ['desc10_5', 'desc10+5', 'descuento10+5', 'desc105', 'desc_10_5'],
      desc10_5_3: ['desc10_5_3', 'desc10+5+3', 'descuento10+5+3', 'desc1053', 'desc_10_5_3'],
      minimo: ['minimo', 'mínimo', 'minimum', 'min', 'precio_minimo', 'min_price'],
      canalDigital: ['canaldigital', 'canal_digital', 'digital', 'online', 'channel_digital'],
      esPersonalizado: ['espersonalizado', 'es_personalizado', 'personalizado', 'custom', 'is_custom'],
      costoProduccion: ['costoproduccion', 'costo_produccion', 'costo', 'producción', 'produccion', 'cost', 'production_cost'],
      porcentajeUtilidad: ['porcentajeutilidad', 'porcentaje_utilidad', 'utilidad', 'margen', 'margin', 'profit_margin'],
      modoPrecio: ['modoprecio', 'modo_precio', 'price_mode', 'modo', 'pricing_mode']
    };

    const columnMapping: Record<string, string> = {};
    const usedMappings = new Set<string>();
    
    // Normalize headers for comparison with Spanish accent support
    const normalizedHeaders = csvHeaders.map(header => ({
      original: header,
      normalized: this.normalizeSpanishText(header.trim())
    }));
    
    // First pass: exact matches with priority (most specific first)
    for (const { original, normalized } of normalizedHeaders) {
      let bestMatch: string | null = null;
      let bestMatchLength = 0;
      
      for (const [schemaField, possibleNames] of Object.entries(mappings)) {
        if (usedMappings.has(schemaField)) continue;
        
        for (const possibleName of possibleNames) {
          const normalizedPossibleName = this.normalizeSpanishText(possibleName);
          
          // Exact match
          if (normalized === normalizedPossibleName) {
            if (normalizedPossibleName.length > bestMatchLength) {
              bestMatch = schemaField;
              bestMatchLength = normalizedPossibleName.length;
            }
          }
        }
      }
      
      if (bestMatch) {
        columnMapping[original] = bestMatch;
        usedMappings.add(bestMatch);
      }
    }
    
    // Second pass: partial matches for unmapped headers
    for (const { original, normalized } of normalizedHeaders) {
      if (columnMapping[original]) continue; // Already mapped
      
      let bestMatch: string | null = null;
      let bestScore = 0;
      
      for (const [schemaField, possibleNames] of Object.entries(mappings)) {
        if (usedMappings.has(schemaField)) continue;
        
        for (const possibleName of possibleNames) {
          const normalizedPossibleName = this.normalizeSpanishText(possibleName);
          
          // Calculate similarity score
          let score = 0;
          if (normalized.includes(normalizedPossibleName)) {
            score = normalizedPossibleName.length / normalized.length;
          } else if (normalizedPossibleName.includes(normalized)) {
            score = normalized.length / normalizedPossibleName.length;
          }
          
          if (score > bestScore && score > 0.7) { // Minimum 70% similarity
            bestMatch = schemaField;
            bestScore = score;
          }
        }
      }
      
      if (bestMatch) {
        columnMapping[original] = bestMatch;
        usedMappings.add(bestMatch);
      } else {
        // If no mapping found, use a safe version of the original name
        columnMapping[original] = normalized || 'unknown_field';
      }
    }
    
    return columnMapping;
  }
}

/**
 * Default data cleaner instance for price list imports
 */
export const priceListDataCleaner = new CSVDataCleaner({
  treatEmptyAsNull: true,
  convertCommaDecimals: true,
  allowNegativeNumbers: false, // Prices should not be negative
  trimWhitespace: true,
  convertEmptyStringToNull: true,
  defaultValues: {
    esPersonalizado: 'No'
  }
});