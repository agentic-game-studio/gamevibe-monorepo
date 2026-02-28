import { GameTemplate } from '@gamevibe/shared';

export interface AssetInjectionOptions {
  assets: Record<string, string>;
  template: GameTemplate;
  usePlaceholders?: boolean;
}

export class AssetInjector {
  /**
   * Injects asset URLs into a game template
   */
  static injectAssets(
    template: GameTemplate,
    assets: Record<string, string>
  ): GameTemplate {
    // Create a copy of the template
    const injectedTemplate = { ...template };
    
    // Update the ASSET_LOADING section with actual asset URLs
    if (injectedTemplate.sections.ASSET_LOADING) {
      injectedTemplate.sections.ASSET_LOADING = this.generateAssetLoadingCode(assets);
    }
    
    // Update any asset references in other sections
    Object.keys(injectedTemplate.sections).forEach(sectionKey => {
      if (sectionKey !== 'ASSET_LOADING') {
        injectedTemplate.sections[sectionKey] = this.replaceAssetReferences(
          injectedTemplate.sections[sectionKey],
          assets
        );
      }
    });
    
    return injectedTemplate;
  }
  
  /**
   * Generates Phaser asset loading code from asset URLs
   */
  private static generateAssetLoadingCode(assets: Record<string, string>): string {
    const lines: string[] = ['    // Load game assets'];
    
    // Map asset keys to Phaser load commands
    Object.entries(assets).forEach(([key, url]) => {
      // Determine asset type from key
      if (key.includes('sprite_') || key.includes('player') || key.includes('enemy') || key.includes('collectible')) {
        lines.push(`    this.load.image('${key.replace('sprite_', '')}', '${url}');`);
      } else if (key.includes('background_')) {
        lines.push(`    this.load.image('${key.replace('background_', '')}', '${url}');`);
      } else if (key.includes('ui_')) {
        lines.push(`    this.load.image('${key.replace('ui_', '')}', '${url}');`);
      } else if (key.includes('effect_')) {
        lines.push(`    this.load.image('${key.replace('effect_', '')}', '${url}');`);
      } else if (!key.includes('_thumb') && !key.includes('_2x')) {
        // Generic asset
        lines.push(`    this.load.image('${key}', '${url}');`);
      }
    });
    
    // Add fallback placeholder assets if some are missing
    const requiredAssets = ['player', 'ground', 'enemy', 'star', 'collectible'];
    requiredAssets.forEach(assetKey => {
      if (!assets[assetKey] && !assets[`sprite_${assetKey}`]) {
        lines.push(`    // Fallback for missing ${assetKey}`);
        lines.push(`    this.load.image('${assetKey}', '${this.getPlaceholderDataUrl(assetKey)}');`);
      }
    });
    
    return lines.join('\n');
  }
  
  /**
   * Replaces asset references in code sections
   */
  private static replaceAssetReferences(
    code: string,
    assets: Record<string, string>
  ): string {
    let updatedCode = code;
    
    // Replace background references
    if (assets.background_main) {
      updatedCode = updatedCode.replace(
        /this\.add\.rectangle\(400, 300, 800, 600, 0x87CEEB\);/g,
        `this.add.image(400, 300, 'main').setDisplaySize(800, 600);`
      );
    }
    
    // Replace sprite scale references if we have actual sprites
    if (assets.sprite_player) {
      updatedCode = updatedCode.replace(
        /\.setScale\(32, 32\)/g,
        '.setScale(1)'
      );
    }
    
    // Update tint calls to work with actual images
    updatedCode = updatedCode.replace(
      /\.setTint\(0x[0-9a-fA-F]+\)/g,
      ''
    );
    
    return updatedCode;
  }
  
  /**
   * Returns a placeholder data URL for missing assets
   */
  private static getPlaceholderDataUrl(assetType: string): string {
    const placeholders: Record<string, string> = {
      player: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAAA4klEQVRYhe2XMQ6CMBSGv0YHE+PqYLyAB3Bz8gDewMnRG3gBD+DmAi6OJg4mxvgMtEBLKS1FCPEl/0Jf+977+tqXAgEBAQH/igKwAc5ADVgCisc9KmAL3IAHUM7LuAaUTCJ6lPKwrcKvgQ7QABaZ2PfAaAAboCJj30IhY9MCCsAZmI5pI0AReLqw9yIGJEALeJnI+8CVAJ1EXkoSYDNF3gYbkgCNSF4HQ5IAOyN5DYaSAOspAnrNpL7/Afqj9oK1zjYRsHZh11XAUaO0BpaSgJNiUAaWkoAAn28Yn28Y3y/5N98LU0kzQ+GC0wAAAABJRU5ErkJggg==',
      enemy: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAAA5ElEQVRYhe2WMQ7CMAxFn6sOILF1YOIETJyAiYkTcAImRk7ABVhYGJgQEgMSSN9VqE1dO3WaAuKPnjiO/+s7dhwQEBAQ8K8UABs4A1VgCRQ8HlQBW+AO3IFyVsY1oJQjwkUp81oqtAY6QANYZMK+B0YD2AAVJ+xbqDhhU7MElIAzcJ6SiTz+AqCT0N8LJkACfMgQdyGAJpE3sxJgMyHehjFJgKYkX4chScDOJK/DQBJAtyH/Afzb8AIs1XcaAWuXfq4CTgr/DixNDzgBB2CneSMAJcOXoGSQNz2g8jvq+gX44u/4BgozOyX5LPxeAAAAAElFTkSuQmCC',
      ground: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      star: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAAA7klEQVRYhe2WsQ3CMBBFn6MOKCgpqJiAERiBERiBEaiYgAWoKCkoKCiQQjwXwbGxz+dEIuUr7M939+7b/gcEBAQE/CsFYAOcgTKwBEoe96iALXAHHkA5K+MaUHLEalHKvJYKrYEO0AAWmbDvgdEANkDFCfsWKk7Y1CwBJeAMnKdkIo+/AOgk9PeCDJAAHzLEXQigSeTNrATYTIi3YUwSoCnJ12FIErAzyeswkATQbch/AP82vABL9Z1GwNqln6uAk8K/A0vTA07AAdhtPPb4C4BO4d+BRQ8IpQek5kJUcVUvgAgjD6gVJcNLMJNyL5NRPgG9GEMqJJBvMgAAAABJRU5ErkJggg==',
      collectible: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABmJLR0QA/wD/AP+gvaeTAAAA+ElEQVRYhe2WsQ3CMBCFP0cdUFBSMQEjMAIjMAIjUDEBC1BRUlBQUCCFeC7CwfH5nFhIfMVd7Pu/e3d+B/gZ0gA2QA5UgCWQ9rhHBWyBO1ABljkZ14AnC2vxZnkvFVoDElgDi0zY98BoABugZMO+hZIN+zZLQBk4A+dJmZjGnwfoJPT3ghRoAR9kxL0QIJDQG1gJ0J8h70OfJEBLyRswJAnQnSFvwEASQDeDMRz/r8F/gItBXwWshuQ5A5ykgCtw7JuBOjCp41Kc6DeDdSBo4NoBN6AYmuGuBeiC4hVoaQmuGuA7MCfhgtJhsIAT8JryBOcfXrx+gDcQc0jUfyNRpAAAAABJRU5ErkJggg=='
    };
    
    return placeholders[assetType] || placeholders.player;
  }
  
  /**
   * Creates a mapping of standard asset keys to provided asset URLs
   */
  static mapAssetsToTemplate(
    assets: Record<string, string>,
    templateType: string
  ): Record<string, string> {
    const mapping: Record<string, string> = {};
    
    // Direct mappings
    const directMappings: Record<string, string> = {
      sprite_player: 'player',
      sprite_enemy: 'enemy',
      sprite_collectible: 'collectible',
      background_main: 'background',
      background_main_background: 'main',
      ui_health_bar: 'healthbar',
      ui_score_display: 'score'
    };
    
    Object.entries(assets).forEach(([key, url]) => {
      // Check for direct mapping
      if (directMappings[key]) {
        mapping[directMappings[key]] = url;
      }
      
      // Also keep original key
      mapping[key] = url;
    });
    
    // Add type-specific mappings
    switch (templateType) {
      case 'platformer':
        mapping['ground'] = assets.background_main || assets.sprite_ground || this.getPlaceholderDataUrl('ground');
        mapping['star'] = assets.sprite_collectible || assets.sprite_star || this.getPlaceholderDataUrl('star');
        break;
        
      case 'shooter':
        mapping['bullet'] = assets.sprite_projectile || this.getPlaceholderDataUrl('star');
        mapping['ship'] = assets.sprite_player || this.getPlaceholderDataUrl('player');
        break;
    }
    
    return mapping;
  }
}