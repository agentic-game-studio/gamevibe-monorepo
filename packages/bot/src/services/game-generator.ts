import { injectable, inject } from 'inversify';
import { nanoid } from 'nanoid';
import { 
  GameGenerationRequest, 
  GeneratedGame, 
  GameSpec,
  generateGameId,
  GameVibeError,
  GameTemplate
} from '@gamevibe/shared';
import { AIService } from '@gamevibe/ai-service';
import { GameEngine } from '@gamevibe/game-engine';
import { DatabaseService } from './database.js';
import { CacheService } from './cache.js';
import { AssetService } from './asset.js';
import { AssetGeneratorServiceWrapper } from './asset-generator-service.js';
import { IntelligentCacheService } from './intelligent-cache.js';
import { AIServiceWrapper } from './ai-service-wrapper.js';
import { GameTemplateCacheService, TemplateSearchCriteria } from './game-template-cache.js';
import { AssetTemplateLibraryService, AssetSearchCriteria } from './asset-template-library.js';
import { TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';

@injectable()
export class GameGeneratorService {
  private logger = new Logger('GameGeneratorService');
  private assetGeneratorService?: AssetGeneratorServiceWrapper;
  
  constructor(
    @inject(TYPES.DatabaseService) private db: DatabaseService,
    @inject(TYPES.CacheService) private cache: CacheService,
    @inject(TYPES.IntelligentCacheService) private intelligentCache: IntelligentCacheService,
    @inject(TYPES.GameTemplateCacheService) private templateCache: GameTemplateCacheService,
    @inject(TYPES.AssetTemplateLibraryService) private assetLibrary: AssetTemplateLibraryService,
    @inject(TYPES.AssetService) private assets: AssetService,
    @inject(TYPES.GameEngine) private engine: GameEngine,
    @inject(TYPES.AIServiceWrapper) private ai: AIServiceWrapper,
    @inject(TYPES.Config) private config: any
  ) {
    // Initialize asset generator if configured
    if (config.enableAssetGeneration) {
      try {
        this.assetGeneratorService = new AssetGeneratorServiceWrapper(logger, cache, config);
      } catch (error) {
        logger.warn('Asset generation service not available:', error);
      }
    }
  }
  
  async generateGame(request: GameGenerationRequest): Promise<GeneratedGame> {
    try {
      // Check intelligent cache first
      const intelligentCacheKey = this.intelligentCache.generateIntelligentKey(
        'game',
        {
          description: request.description,
          type: request.type,
          playerCount: request.playerCount,
          context: request.context
        },
        {
          gameType: request.type || 'OTHER',
          playerCount: request.playerCount || '1'
        }
      );
      
      const cached = await this.intelligentCache.getIntelligent<GeneratedGame>(intelligentCacheKey);
      if (cached) {
        this.logger.info('Returning cached game generation via intelligent cache', {
          gameType: request.type,
          complexity: 'detected'
        });
        return cached;
      }
      
      // Analyze the game request with AI using cost-optimized model selection
      const userTier = (request as any).userTier || 'FREE';
      const gameSpec = await this.ai.analyzeGameRequest(
        request.description,
        request.userId,
        request.serverId,
        request.context,
        userTier
      );
      
      // Add missing properties to the spec
      const completeSpec: GameSpec = {
        ...gameSpec,
        originalDescription: request.description,
        playerCount: request.playerCount || gameSpec.playerCount || '1'
      };
      
      // Try to get cached template first for faster generation
      const searchCriteria: TemplateSearchCriteria = {
        type: completeSpec.type,
        complexity: this.intelligentCache.analyzeComplexity(request.description),
        features: completeSpec.features || [],
        playerCount: parseInt(completeSpec.playerCount) || 1
      };
      
      let template = await this.templateCache.getTemplate(searchCriteria);
      let usingCachedTemplate = false;
      
      if (template) {
        this.logger.info('Using cached template for faster generation', {
          templateId: template.id,
          type: template.type,
          complexity: template.complexity
        });
        usingCachedTemplate = true;
      } else {
        // Fall back to engine template selection
        template = await this.engine.selectTemplate(completeSpec);
        
        // Cache the new template for future use
        if (template) {
          await this.templateCache.cacheTemplate(template, {
            enableVariations: true,
            maxVariations: 3,
            complexityLevels: [searchCriteria.complexity || 'medium'],
            includePremiumFeatures: userTier !== 'FREE'
          });
          
          this.logger.info('Cached new template for future use', {
            type: template.type,
            userTier
          });
        }
      }
      
      // Get game assets from library or generate new ones
      let gameAssets: Record<string, string> = {};
      let generatedThumbnailUrl: string | undefined;
      let assetCostSavings = 0;
      
      // Try to get asset package from library first
      const assetPackage = await this.assetLibrary.getAssetPackage(
        completeSpec.type,
        this.extractTheme(request.description),
        this.extractStyle(request.description)
      );
      
      if (assetPackage) {
        // Use assets from library
        for (const asset of assetPackage.assets) {
          const assetKey = `${asset.category}_${asset.type}`;
          gameAssets[assetKey] = asset.url;
        }
        
        assetCostSavings = assetPackage.totalCost;
        this.logger.info(`Using ${assetPackage.assets.length} assets from library`, {
          packageId: assetPackage.id,
          costSavings: assetCostSavings
        });
        
        // Try to find thumbnail from package
        const thumbnailAsset = assetPackage.assets.find(a => 
          a.category === 'background' || a.category === 'sprite'
        );
        if (thumbnailAsset) {
          generatedThumbnailUrl = thumbnailAsset.thumbnail || thumbnailAsset.url;
        }
      } else if (this.assetGeneratorService) {
        // Fall back to generating new assets
        try {
          const assetResult = await this.assetGeneratorService.generateGameAssets(
            await generateGameId(), // Temporary ID for asset generation
            completeSpec
          );
          gameAssets = assetResult.assets;
          generatedThumbnailUrl = assetResult.thumbnailUrl;
          this.logger.info(`Generated ${Object.keys(gameAssets).length} new assets for game`);
        } catch (error) {
          this.logger.warn('Asset generation failed, using placeholders:', error);
        }
      }
      
      // Generate game code with AI using cost-optimized model selection
      // Use baseCode from cached template if available
      const templateForGeneration = usingCachedTemplate ? {
        ...template,
        code: (template as any).baseCode || template.code,
        assets: gameAssets
      } : {
        ...template,
        assets: gameAssets
      };
      
      const codeGeneration = await this.ai.generateGameCode(
        completeSpec, 
        templateForGeneration, 
        request.userId, 
        request.serverId, 
        userTier
      );
      
      const generatedCode = codeGeneration.content;
      
      // Log cost optimization results with credit information
      this.logger.info('AI model selection for game code generation', {
        selectedModel: codeGeneration.model,
        estimatedCost: codeGeneration.estimatedCostCents,
        actualCost: codeGeneration.actualCostCents,
        creditsDeducted: codeGeneration.creditsDeducted,
        wasFallback: codeGeneration.wasFallback,
        originalModel: codeGeneration.originalModel,
        creditBalance: codeGeneration.creditBalance,
        gameType: completeSpec.type,
        complexity: this.intelligentCache.analyzeComplexity(request.description),
        userTier,
        userId: request.userId,
        serverId: request.serverId
      });
      
      // Validate the generated code
      const validation = await this.engine.validateCode(generatedCode);
      
      let finalCode = generatedCode;
      if (!validation.valid && validation.error) {
        console.warn('Generated code has issues:', validation.error);
        // Attempt to fix the code
        finalCode = await this.engine.fixGeneratedCode(generatedCode, [validation.error]);
      }
      
      // Compile the game
      const compiled = await this.engine.compile(finalCode, {
        includePhaserCDN: true,
        metadata: {
          name: completeSpec.name,
          description: completeSpec.description
        }
      });
      
      // Generate IDs
      const gameId = await generateGameId();
      const shortId = nanoid(8);
      
      // Use generated thumbnail or fallback to placeholder
      const thumbnailUrl = generatedThumbnailUrl || await this.assets.generateThumbnail(completeSpec.type);
      
      // Create game object
      const game: GeneratedGame = {
        id: gameId,
        shortId,
        name: completeSpec.name,
        description: completeSpec.description,
        type: completeSpec.type,
        code: compiled.code,
        playUrl: `https://gamevibe.ai/play/${shortId}`,
        thumbnailUrl,
        assets: gameAssets // Include generated assets
      };
      
      // Save to database
      await this.saveGame({
        ...game,
        serverId: request.serverId,
        creatorId: request.userId
      });
      
      // Cache result with intelligent caching using actual generation cost
      const complexity = this.intelligentCache.analyzeComplexity(request.description);
      const actualCost = codeGeneration.actualCostCents || codeGeneration.estimatedCostCents;
      const totalCostSavings = actualCost + assetCostSavings;
      
      await this.intelligentCache.setIntelligent(intelligentCacheKey, game, {
        priority: complexity === 'complex' ? 'high' : 'medium',
        costWeight: actualCost,
        tags: [
          completeSpec.type, 
          `complexity:${complexity}`, 
          `players:${completeSpec.playerCount}`, 
          `model:${codeGeneration.model}`,
          `assetSavings:${assetCostSavings}`
        ]
      });
      
      // Also cache in basic cache for fallback
      await this.cache.set(this.getCacheKey(request), game, 3600);
      
      this.logger.info('Game generated and cached', {
        gameId: game.id,
        type: game.type,
        complexity,
        actualCost,
        assetCostSavings,
        totalCostSavings,
        selectedModel: codeGeneration.model,
        creditsDeducted: codeGeneration.creditsDeducted,
        wasFallback: codeGeneration.wasFallback,
        originalModel: codeGeneration.originalModel,
        creditBalance: codeGeneration.creditBalance,
        assetsGenerated: Object.keys(gameAssets).length,
        userTier,
        userId: request.userId,
        serverId: request.serverId,
        usedCachedTemplate: usingCachedTemplate,
        templateId: usingCachedTemplate ? (template as any).id : 'new',
        usedAssetLibrary: assetPackage !== null
      });
      
      return game;
      
    } catch (error) {
      console.error('Game generation error:', error);
      throw new GameVibeError(
        'Failed to generate game',
        'GENERATION_FAILED',
        500,
        { originalError: error }
      );
    }
  }
  
  private async saveGame(gameData: any): Promise<void> {
    try {
      // Ensure server and creator exist in database
      await this.db.upsertServer({
        discordId: gameData.serverId,
        name: 'Unknown Server',
        memberCount: 1
      });
      
      await this.db.upsertUser({
        discordId: gameData.creatorId,
        username: 'Unknown User',
        premiumTier: 0
      });
      
      // Save the game
      await this.db.createGame({
        shortId: gameData.shortId,
        serverId: gameData.serverId,
        creatorId: gameData.creatorId,
        name: gameData.name,
        description: gameData.description,
        type: gameData.type,
        code: gameData.code,
        assets: gameData.assets || {},
        metadata: { playUrl: gameData.playUrl, thumbnailUrl: gameData.thumbnailUrl },
        isPublic: true
      });
      
      console.log('Game saved to database:', gameData.shortId);
    } catch (error) {
      console.error('Failed to save game to database:', error);
      // Don't throw here to avoid breaking game generation
    }
  }
  
  private getCacheKey(request: GameGenerationRequest): string {
    const parts = [
      'game',
      request.type || 'any',
      request.playerCount || '1',
      this.hashDescription(request.description)
    ];
    
    return parts.join(':');
  }
  
  private hashDescription(description: string): string {
    // Simple hash for caching
    let hash = 0;
    for (let i = 0; i < description.length; i++) {
      const char = description.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
  
  private estimateGenerationCost(complexity: string, gameType: string): number {
    // Base cost estimates in cents based on AI model usage
    const baseCosts = {
      simple: 2,   // Haiku model
      medium: 8,   // Sonnet model  
      complex: 25  // Opus model
    };
    
    const gameTypeMultipliers = {
      'PUZZLE': 0.8,
      'ENDLESS_RUNNER': 0.9,
      'PLATFORMER': 1.0,
      'SHOOTER': 1.2,
      'RPG': 1.5,
      'OTHER': 1.0
    };
    
    const baseCost = baseCosts[complexity as keyof typeof baseCosts] || baseCosts.medium;
    const multiplier = gameTypeMultipliers[gameType as keyof typeof gameTypeMultipliers] || 1.0;
    
    return Math.ceil(baseCost * multiplier);
  }
  
  /**
   * Initialize and warm the template cache with popular patterns
   */
  async initializeTemplateCache(): Promise<void> {
    this.logger.info('Initializing template cache');
    
    try {
      await this.templateCache.warmCache();
      this.logger.info('Template cache warmed successfully');
    } catch (error) {
      this.logger.error('Failed to warm template cache', { error });
    }
  }
  
  /**
   * Get template cache analytics
   */
  async getTemplateCacheAnalytics() {
    return this.templateCache.getAnalytics();
  }
  
  /**
   * Clean up old cached templates
   */
  async cleanupTemplateCache(maxAge?: number): Promise<number> {
    return this.templateCache.cleanup(maxAge);
  }
  
  /**
   * Initialize and warm the asset library with default packages
   */
  async initializeAssetLibrary(): Promise<void> {
    this.logger.info('Initializing asset library');
    
    try {
      await this.assetLibrary.initializeLibrary();
      this.logger.info('Asset library initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize asset library', { error });
    }
  }
  
  /**
   * Get asset library analytics
   */
  async getAssetLibraryAnalytics() {
    return this.assetLibrary.getAnalytics();
  }
  
  /**
   * Clean up old cached assets
   */
  async cleanupAssetLibrary(maxAge?: number): Promise<number> {
    return this.assetLibrary.cleanup(maxAge);
  }
  
  /**
   * Extract theme from game description
   */
  private extractTheme(description: string): 'space' | 'fantasy' | 'modern' | 'nature' | 'underwater' | 
                                           'cyberpunk' | 'medieval' | 'abstract' | 'classic' {
    const lower = description.toLowerCase();
    
    if (lower.includes('space') || lower.includes('alien') || lower.includes('galaxy')) {
      return 'space';
    } else if (lower.includes('fantasy') || lower.includes('magic') || lower.includes('dragon')) {
      return 'fantasy';
    } else if (lower.includes('underwater') || lower.includes('ocean') || lower.includes('sea')) {
      return 'underwater';
    } else if (lower.includes('cyber') || lower.includes('neon') || lower.includes('futuristic')) {
      return 'cyberpunk';
    } else if (lower.includes('medieval') || lower.includes('knight') || lower.includes('castle')) {
      return 'medieval';
    } else if (lower.includes('nature') || lower.includes('forest') || lower.includes('jungle')) {
      return 'nature';
    } else if (lower.includes('modern') || lower.includes('city') || lower.includes('urban')) {
      return 'modern';
    } else if (lower.includes('abstract') || lower.includes('geometric')) {
      return 'abstract';
    }
    
    return 'classic';
  }
  
  /**
   * Extract style from game description
   */
  private extractStyle(description: string): 'pixel' | 'vector' | 'realistic' | 'cartoon' | 'minimal' | 'retro' {
    const lower = description.toLowerCase();
    
    if (lower.includes('pixel') || lower.includes('8-bit') || lower.includes('16-bit')) {
      return 'pixel';
    } else if (lower.includes('retro') || lower.includes('vintage') || lower.includes('classic')) {
      return 'retro';
    } else if (lower.includes('cartoon') || lower.includes('cute') || lower.includes('colorful')) {
      return 'cartoon';
    } else if (lower.includes('realistic') || lower.includes('detailed')) {
      return 'realistic';
    } else if (lower.includes('minimal') || lower.includes('simple') || lower.includes('clean')) {
      return 'minimal';
    }
    
    return 'vector';
  }
}