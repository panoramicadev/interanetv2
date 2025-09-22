import { db } from './db';
import { comunaRegionMapping, type ComunaRegionMapping, type InsertComunaRegionMapping } from '@shared/schema';
import { eq, sql, ilike, or } from 'drizzle-orm';
import { readFileSync } from 'fs';
import Papa from 'papaparse';

export interface RegionMatchResult {
  region: string;
  confidence: number;
  matchType: 'exact' | 'partial' | 'fuzzy' | 'unknown';
  originalComuna: string;
  normalizedComuna: string;
}

export class ComunaRegionService {
  private static instance: ComunaRegionService;
  private initialized = false;

  // Singleton pattern to ensure only one instance
  static getInstance(): ComunaRegionService {
    if (!ComunaRegionService.instance) {
      ComunaRegionService.instance = new ComunaRegionService();
    }
    return ComunaRegionService.instance;
  }

  private constructor() {}

  /**
   * Initialize the service by ensuring the mapping table is populated
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if table has data
      const [count] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(comunaRegionMapping);

      if (Number(count.count) === 0) {
        console.log('🗺️ Comuna-Region mapping table is empty, loading from CSV...');
        await this.loadMappingFromCSV();
      } else {
        console.log(`🗺️ Comuna-Region mapping table initialized with ${count.count} entries`);
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize ComunaRegionService:', error);
      throw error;
    }
  }

  /**
   * Load mapping data from the CSV file
   */
  async loadMappingFromCSV(): Promise<void> {
    try {
      const csvPath = 'attached_assets/regiones por comunas - Hoja 2_1758560241633.csv';
      const csvContent = readFileSync(csvPath, 'utf-8');
      
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
      });

      if (parseResult.errors.length > 0) {
        console.error('❌ CSV parsing errors:', parseResult.errors);
        throw new Error('Failed to parse CSV file');
      }

      const mappings: InsertComunaRegionMapping[] = [];
      
      for (const row of parseResult.data as any[]) {
        if (!row.Comuna || !row.Región) {
          console.warn('⚠️ Skipping row with missing data:', row);
          continue;
        }

        const comuna = String(row.Comuna).trim();
        const region = String(row.Región).trim();

        mappings.push({
          comuna,
          region,
          comunaNormalized: this.normalizeComuna(comuna),
          regionNormalized: this.normalizeRegion(region),
          isActive: true,
          matchingStrategy: 'exact',
        });
      }

      // Insert in batches for better performance
      console.log(`📊 Inserting ${mappings.length} comuna-region mappings...`);
      
      // Clear existing data first
      await db.delete(comunaRegionMapping);
      
      // Insert new data in batches of 50
      const batchSize = 50;
      for (let i = 0; i < mappings.length; i += batchSize) {
        const batch = mappings.slice(i, i + batchSize);
        await db.insert(comunaRegionMapping).values(batch);
      }

      console.log(`✅ Successfully loaded ${mappings.length} comuna-region mappings`);
    } catch (error) {
      console.error('❌ Failed to load CSV mapping:', error);
      throw error;
    }
  }

  /**
   * Normalize comuna name for consistent matching
   */
  private normalizeComuna(comuna: string): string {
    if (!comuna) return '';
    
    return comuna
      .trim()
      .toUpperCase()
      .normalize('NFKD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics/accents
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\b(COMUNA|DE|DEL|LA|LAS|LOS|EL)\b/g, '') // Remove common words
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Normalize region name for consistent matching
   */
  private normalizeRegion(region: string): string {
    if (!region) return '';
    
    return region
      .trim()
      .toUpperCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find region for a given comuna using intelligent matching
   */
  async findRegion(comunaInput: string): Promise<RegionMatchResult> {
    await this.initialize();

    if (!comunaInput) {
      return {
        region: 'Sin región',
        confidence: 0,
        matchType: 'unknown',
        originalComuna: comunaInput,
        normalizedComuna: '',
      };
    }

    const normalized = this.normalizeComuna(comunaInput);
    
    // Strategy 1: Exact match
    const exactMatch = await this.findExactMatch(normalized);
    if (exactMatch) {
      return {
        region: exactMatch.region,
        confidence: 1.0,
        matchType: 'exact',
        originalComuna: comunaInput,
        normalizedComuna: normalized,
      };
    }

    // Strategy 2: Partial match (contains)
    const partialMatch = await this.findPartialMatch(normalized);
    if (partialMatch) {
      return {
        region: partialMatch.region,
        confidence: 0.8,
        matchType: 'partial',
        originalComuna: comunaInput,
        normalizedComuna: normalized,
      };
    }

    // Strategy 3: Fuzzy match (similar strings)
    const fuzzyMatch = await this.findFuzzyMatch(normalized);
    if (fuzzyMatch && fuzzyMatch.confidence > 0.6) {
      return fuzzyMatch;
    }

    // No match found
    console.log(`🔍 No region found for comuna: "${comunaInput}" (normalized: "${normalized}")`);
    return {
      region: 'Sin región',
      confidence: 0,
      matchType: 'unknown',
      originalComuna: comunaInput,
      normalizedComuna: normalized,
    };
  }

  /**
   * Find exact match by normalized comuna
   */
  private async findExactMatch(normalizedComuna: string): Promise<ComunaRegionMapping | null> {
    try {
      const results = await db
        .select()
        .from(comunaRegionMapping)
        .where(eq(comunaRegionMapping.comunaNormalized, normalizedComuna))
        .limit(1);

      return results[0] || null;
    } catch (error) {
      console.error('❌ Error in exact match:', error);
      return null;
    }
  }

  /**
   * Find partial match (comuna contains or is contained by normalized input)
   */
  private async findPartialMatch(normalizedComuna: string): Promise<ComunaRegionMapping | null> {
    try {
      const results = await db
        .select()
        .from(comunaRegionMapping)
        .where(
          or(
            ilike(comunaRegionMapping.comunaNormalized, `%${normalizedComuna}%`),
            ilike(sql`${normalizedComuna}`, `%${comunaRegionMapping.comunaNormalized}%`)
          )
        )
        .limit(1);

      return results[0] || null;
    } catch (error) {
      console.error('❌ Error in partial match:', error);
      return null;
    }
  }

  /**
   * Find fuzzy match using string similarity
   */
  private async findFuzzyMatch(normalizedComuna: string): Promise<RegionMatchResult | null> {
    try {
      // Get all comunas for fuzzy matching
      const allComunas = await db
        .select()
        .from(comunaRegionMapping)
        .where(eq(comunaRegionMapping.isActive, true));

      let bestMatch: ComunaRegionMapping | null = null;
      let bestSimilarity = 0;

      for (const mapping of allComunas) {
        const similarity = this.calculateStringSimilarity(normalizedComuna, mapping.comunaNormalized);
        if (similarity > bestSimilarity && similarity > 0.6) {
          bestSimilarity = similarity;
          bestMatch = mapping;
        }
      }

      if (bestMatch) {
        return {
          region: bestMatch.region,
          confidence: bestSimilarity,
          matchType: 'fuzzy',
          originalComuna: normalizedComuna,
          normalizedComuna: bestMatch.comunaNormalized,
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error in fuzzy match:', error);
      return null;
    }
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;

    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get mapping statistics for diagnostics
   */
  async getMappingStats(): Promise<{
    totalMappings: number;
    activeRegions: string[];
    lastUpdated: Date | null;
  }> {
    await this.initialize();

    try {
      const [countResult] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(comunaRegionMapping)
        .where(eq(comunaRegionMapping.isActive, true));

      const regionsResult = await db
        .select({ region: comunaRegionMapping.region })
        .from(comunaRegionMapping)
        .where(eq(comunaRegionMapping.isActive, true))
        .groupBy(comunaRegionMapping.region)
        .orderBy(comunaRegionMapping.region);

      const [lastUpdatedResult] = await db
        .select({ updatedAt: comunaRegionMapping.updatedAt })
        .from(comunaRegionMapping)
        .orderBy(sql`${comunaRegionMapping.updatedAt} DESC`)
        .limit(1);

      return {
        totalMappings: Number(countResult.count),
        activeRegions: regionsResult.map((r: { region: string }) => r.region),
        lastUpdated: lastUpdatedResult?.updatedAt || null,
      };
    } catch (error) {
      console.error('❌ Error getting mapping stats:', error);
      return {
        totalMappings: 0,
        activeRegions: [],
        lastUpdated: null,
      };
    }
  }

  /**
   * Reload mapping data from CSV (for updates)
   */
  async reloadMapping(): Promise<void> {
    console.log('🔄 Reloading comuna-region mapping from CSV...');
    this.initialized = false;
    await this.loadMappingFromCSV();
    this.initialized = true;
    console.log('✅ Comuna-region mapping reloaded successfully');
  }
}

// Export singleton instance
export const comunaRegionService = ComunaRegionService.getInstance();