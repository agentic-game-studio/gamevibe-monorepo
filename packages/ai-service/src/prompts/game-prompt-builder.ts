import { GameSpec, GameTemplate } from '@gamevibe/shared';
import { 
  STANDARDIZED_GAME_TEMPLATE, 
  GAME_STRUCTURE_GUIDELINES,
  GAME_TYPE_TEMPLATES,
  UI_LAYOUT_GUIDELINES,
  DEFAULT_UI_TEMPLATES
} from './templates.js';

export class GamePromptBuilder {
  buildGameGenerationPrompt(spec: GameSpec, template: GameTemplate & { assets?: Record<string, string> }): string {
    const hasAssets = template.assets && Object.keys(template.assets).length > 0;
    
    // Get game-type-specific templates
    const gameType = spec.type.toLowerCase().replace('-', '');
    const typeTemplates = GAME_TYPE_TEMPLATES[gameType as keyof typeof GAME_TYPE_TEMPLATES] || GAME_TYPE_TEMPLATES.shooter;
    
    // Build the enhanced template with game-specific sections
    const enhancedTemplate = STANDARDIZED_GAME_TEMPLATE
      .replace('[GLOBAL_VARIABLES]', typeTemplates.globalVariables)
      .replace('[STORE_POSITIONS]', typeTemplates.storePositions)
      .replace('[RESET_OBJECTS]', typeTemplates.resetObjects)
      .replace('[GAME_OVER_SCREEN]', typeTemplates.gameOverScreen)
      .replace('[UPDATE_UI]', typeTemplates.updateUI)
      .replace('[PAUSE_SCREEN]', DEFAULT_UI_TEMPLATES.pauseScreen);
    
    return `You are an expert game developer specializing in creating fun, engaging browser games using Phaser.js.

${GAME_STRUCTURE_GUIDELINES}

Your task is to generate a complete, playable game based on the following requirements:

## Game Requirements:
- **Type**: ${spec.type}
- **Name**: ${spec.name}
- **Description**: ${spec.originalDescription}
- **Player Count**: ${spec.playerCount}
- **Core Mechanics**: ${spec.coreMechanics.join(', ')}
- **Key Features**: ${spec.features.join(', ')}
${spec.difficulty ? `- **Difficulty**: ${spec.difficulty}` : ''}

## Template Structure:
You MUST use this EXACT template structure and fill in the remaining placeholders:
\`\`\`javascript
${enhancedTemplate}
\`\`\`

## Game-Type-Specific Requirements for ${spec.type}:
${gameType === 'shooter' ? `
- Player should respawn at original position after death
- Bullets and enemies must be cleared on restart
- Include enemy spawn system with increasing difficulty
- Lives system with proper game over when lives = 0` : ''}
${gameType === 'platformer' ? `
- Player respawns at start position with all coins reset
- Enemies return to patrol routes
- Collectibles regenerate in original positions
- Fall detection for instant death` : ''}
${gameType === 'puzzle' ? `
- Grid resets with new random configuration
- Move counter resets
- Target score and combo tracking
- No position storage needed, just grid state` : ''}

## Template Sections to Complete:
${Object.entries(template.sections).map(([key, value]) => `### ${key}:\n${value}`).join('\n\n')}

${hasAssets ? `## Available Assets:
You have the following professionally generated assets available. Use these EXACT asset keys and URLs in your game:

${Object.entries(template.assets!).map(([key, url]) => `- ${key}: "${url}"`).join('\n')}

**IMPORTANT**: You MUST use these provided asset URLs instead of placeholder data URIs or shapes. Update the ASSET_LOADING section to load these assets properly.
` : ''}

## Critical Implementation Requirements:
1. MUST implement complete game state management (game over, restart, pause)
2. MUST store initial positions and reset objects properly on restart
3. MUST include proper UI with score, lives, and game over screen
4. MUST handle ESC for pause and R for restart when game over
5. MUST stop update logic when game is over or paused
6. MUST show clear game over screen with restart button
7. MUST reset player/objects to initial positions on restart

## Important Rules:
1. The game MUST be immediately playable - no placeholder functionality
2. Use proper Phaser.js APIs and best practices
3. Include collision detection and physics where appropriate
4. Add visual feedback (particles, tweens, etc.) for good game feel
5. Implement score tracking and win/lose conditions
6. Balance difficulty appropriately - easy to learn, satisfying to master
7. Make the game FUN and engaging
8. Include clear visual indicators for game state
9. Add smooth animations and transitions
10. Follow the UI layout guidelines exactly

## Code Requirements:
- Use ES6+ JavaScript syntax
- Keep code clean and well-organized
- Add helpful comments for complex logic
- Use meaningful variable names
- Implement ALL required functions (resetGameState, gameOver, restartGame, etc.)
- Handle edge cases gracefully

## DO NOT:
${hasAssets ? '- Use placeholder assets - use ONLY the provided asset URLs above' : '- Include external asset URLs (loader will generate placeholders)'}
- Add complex networking code
- Create overly complicated mechanics
- Include any placeholder or "TODO" comments
- Generate incomplete features
- Skip any of the required game state management functions
- Forget to implement restart functionality

Generate ONLY the complete game code. Do not include explanations, markdown formatting, or any text outside the JavaScript code.

Remember: This game will be played by real users, so make it polished, complete, and enjoyable!`;
  }
  
  buildAnalysisPrompt(description: string, context?: { serverName?: string; memberCount?: number }): string {
    return `Analyze this game request and extract structured information to guide game generation.

## Game Description:
"${description}"

${context ? `## Additional Context:
- Server Name: ${context.serverName || 'Unknown'}
- Member Count: ${context.memberCount || 'Unknown'}
` : ''}

## Your Task:
Analyze the description and determine:

1. **Game Type**: Choose the most appropriate type from: platformer, puzzle, rpg, shooter, endless-runner, tower-defense, other
2. **Core Mechanics**: List 3-5 core gameplay mechanics
3. **Player Count**: Determine if it's single-player, 2-player, or multiplayer
4. **Key Features**: List 3-5 key features that should be included
5. **Suggested Name**: Create a catchy, appropriate game name
6. **Difficulty**: Suggest difficulty level (easy, medium, hard)
7. **Visual Style**: Brief description of the visual theme
8. **Unique Elements**: Any special or unique features mentioned

## Output Format:
Return a JSON object with this structure:
{
  "type": "game_type",
  "name": "Suggested Game Name",
  "description": "Enhanced 1-2 sentence description",
  "coreMechanics": ["mechanic1", "mechanic2", "mechanic3"],
  "features": ["feature1", "feature2", "feature3"],
  "playerCount": "1",
  "difficulty": "medium",
  "visualStyle": "Brief visual description",
  "uniqueElements": ["element1", "element2"]
}

## Guidelines:
- If the description is vague, make reasonable assumptions
- Default to single-player unless multiplayer is explicitly mentioned
- Choose mechanics that fit the game type
- Keep names fun and memorable
- Prioritize fun and engaging gameplay

Respond ONLY with the JSON object, no additional text.`;
  }
  
  buildCodeValidationPrompt(code: string): string {
    return `Review this Phaser.js game code for potential issues:

\`\`\`javascript
${code}
\`\`\`

Check for:
1. Syntax errors
2. Phaser API usage errors
3. Missing game states or methods
4. Potential runtime errors
5. Security concerns

If the code is valid, respond with:
{"valid": true}

If there are issues, respond with:
{
  "valid": false,
  "errors": ["error1", "error2"],
  "suggestions": ["suggestion1", "suggestion2"]
}

Respond ONLY with the JSON object.`;
  }
  
  buildEnhancementPrompt(code: string, enhancementType: string): string {
    const enhancementPrompts: Record<string, string> = {
      polish: 'Add visual polish like particles, screen shake, and juice',
      difficulty: 'Adjust difficulty balancing and progression',
      features: 'Add additional features and mechanics',
      multiplayer: 'Add basic multiplayer support',
      mobile: 'Optimize for mobile devices with touch controls'
    };
    
    return `Enhance this Phaser.js game code:

\`\`\`javascript
${code}
\`\`\`

Enhancement requested: ${enhancementPrompts[enhancementType] || enhancementType}

Rules:
1. Maintain all existing functionality
2. Keep the same game structure
3. Add enhancements smoothly
4. Don't break existing code
5. Keep performance in mind

Return ONLY the enhanced game code, no explanations.`;
  }
}