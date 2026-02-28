// GameVibe AI Remix Interaction Handlers
// Handles Discord component interactions for game remixing

import { 
  Interaction, 
  StringSelectMenuInteraction, 
  ButtonInteraction,
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Container } from 'inversify';
import { GameRemixService, GameModification } from '../services/game-remix.js';
import { SubscriptionChecker } from '../middleware/subscription-check.js';
import { RemixTemplatesService } from '../services/remix-templates.js';
import { RemixType } from '../generated/prisma/index.js';
import { TYPES } from '../types.js';

export async function handleRemixInteractions(interaction: Interaction, container: Container): Promise<void> {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const remixService = container.get<GameRemixService>(TYPES.GameRemixService);
  const subscriptionChecker = container.get<SubscriptionChecker>(TYPES.SubscriptionChecker);

  try {
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction, remixService, subscriptionChecker);
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction, remixService, subscriptionChecker);
    }
  } catch (error) {
    console.error('Error handling remix interaction:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        content: `❌ ${errorMessage}`
      });
    } else {
      await interaction.reply({
        content: `❌ ${errorMessage}`,
        ephemeral: true
      });
    }
  }
}

async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
  remixService: GameRemixService,
  subscriptionChecker: SubscriptionChecker
): Promise<void> {
  const customId = interaction.customId;

  if (customId === 'select_game_to_remix') {
    await handleGameSelection(interaction, remixService);
  } else if (customId.startsWith('remix_modifications:')) {
    await handleModificationSelection(interaction, remixService, subscriptionChecker);
  } else if (customId.startsWith('remix_template:')) {
    await handleTemplateSelection(interaction, remixService, subscriptionChecker);
  } else if (customId === 'select_remix_template') {
    await handleTemplateInfo(interaction);
  } else if (customId === 'explore_trending_remix') {
    await handleTrendingRemixExplore(interaction, remixService);
  } else if (customId.startsWith('version_details:')) {
    await handleVersionDetails(interaction, remixService);
  }
}

async function handleButtonInteraction(
  interaction: ButtonInteraction,
  remixService: GameRemixService,
  subscriptionChecker: SubscriptionChecker
): Promise<void> {
  const customId = interaction.customId;

  if (customId === 'refresh_remix_browse') {
    await handleRefreshBrowse(interaction, remixService);
  } else if (customId.startsWith('create_remix:')) {
    await handleCreateRemix(interaction, remixService, subscriptionChecker);
  } else if (customId.startsWith('quick_remix:')) {
    await handleQuickRemix(interaction, remixService, subscriptionChecker);
  } else if (customId.startsWith('browse_templates:')) {
    await handleBrowseTemplates(interaction);
  } else if (customId.startsWith('start_remix:')) {
    await handleStartRemix(interaction, remixService);
  } else if (customId === 'cancel_remix') {
    await handleCancelRemix(interaction);
  } else if (customId === 'community_stats') {
    await handleCommunityStats(interaction, remixService);
  } else if (customId === 'remix_categories') {
    await handleRemixCategories(interaction, remixService);
  } else if (customId === 'my_remixes') {
    await handleMyRemixes(interaction, remixService);
  } else if (customId.startsWith('version_nav:')) {
    await handleVersionNavigation(interaction, remixService);
  }
}

/**
 * Handle game selection from browse menu
 */
async function handleGameSelection(
  interaction: StringSelectMenuInteraction,
  remixService: GameRemixService
): Promise<void> {
  const selectedGameId = interaction.values[0];

  await interaction.deferReply({ ephemeral: true });

  // Get game details
  const games = await remixService.browseGamesForRemix({ limit: 1000 });
  const selectedGame = games.find(g => g.id === selectedGameId);

  if (!selectedGame) {
    await interaction.editReply({
      content: '❌ Selected game not found.'
    });
    return;
  }

  // Show game details and remix options
  const embed = new EmbedBuilder()
    .setTitle(`🎮 ${selectedGame.name}`)
    .setDescription(selectedGame.description)
    .setColor(Colors.Blue)
    .addFields(
      { name: 'Type', value: selectedGame.type, inline: true },
      { name: 'Creator', value: selectedGame.creator ? `@${selectedGame.creator.username}` : 'Unknown', inline: true },
      { name: 'Plays', value: selectedGame.playCount.toString(), inline: true },
      { name: 'Game ID', value: `\`${selectedGame.shortId}\``, inline: true },
      { name: 'Remixes', value: (selectedGame._count?.originalGameRemixes || 0).toString(), inline: true },
      { name: 'Created', value: `<t:${Math.floor(selectedGame.createdAt.getTime() / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: 'Click "Start Remix" to begin customizing this game' });

  const startRemixButton = new ButtonBuilder()
    .setCustomId(`start_remix:${selectedGame.id}`)
    .setLabel('Start Remix')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🎨');

  const playGameButton = new ButtonBuilder()
    .setCustomId(`play_game:${selectedGame.shortId}`)
    .setLabel('Play Original')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🎮');

  await interaction.editReply({
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(startRemixButton, playGameButton)
    ]
  });
}

/**
 * Handle modification type selection
 */
async function handleModificationSelection(
  interaction: StringSelectMenuInteraction,
  remixService: GameRemixService,
  subscriptionChecker: SubscriptionChecker
): Promise<void> {
  const gameId = interaction.customId.split(':')[1];
  const selectedModifications = interaction.values;

  await interaction.deferReply({ ephemeral: true });

  // Get the game details
  const games = await remixService.browseGamesForRemix({ limit: 1000 });
  const game = games.find(g => g.id === gameId);

  if (!game) {
    await interaction.editReply({
      content: '❌ Game not found.'
    });
    return;
  }

  // Show detailed modification options
  const embed = new EmbedBuilder()
    .setTitle(`🎨 Customizing: ${game.name}`)
    .setDescription('Your selected modifications:')
    .setColor(Colors.Purple);

  const modificationDescriptions: Record<string, string> = {
    style: '🎨 **Visual Style**: Change colors, fonts, and visual effects',
    mechanics: '⚙️ **Game Mechanics**: Adjust movement speed, jump height, and gameplay parameters',
    theme: '🌍 **Theme**: Transform the game setting, story, and narrative elements',
    difficulty: '🎯 **Difficulty**: Make the game easier or more challenging',
    assets: '🖼️ **Assets**: Replace sprites, backgrounds, and audio elements'
  };

  selectedModifications.forEach(mod => {
    if (modificationDescriptions[mod]) {
      embed.addFields({
        name: modificationDescriptions[mod].split(':')[0],
        value: modificationDescriptions[mod].split(':')[1],
        inline: false
      });
    }
  });

  embed.addFields({
    name: '✨ Ready to Create',
    value: 'Your remix will be created with these modifications. This may take 30-60 seconds.',
    inline: false
  });

  const confirmButton = new ButtonBuilder()
    .setCustomId(`confirm_remix:${gameId}:${selectedModifications.join(',')}`)
    .setLabel('Create My Remix')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✨');

  const backButton = new ButtonBuilder()
    .setCustomId(`back_to_game:${gameId}`)
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⬅️');

  await interaction.editReply({
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, backButton)
    ]
  });
}

/**
 * Handle refresh browse button
 */
async function handleRefreshBrowse(
  interaction: ButtonInteraction,
  remixService: GameRemixService
): Promise<void> {
  await interaction.deferUpdate();

  // Get fresh games list
  const games = await remixService.browseGamesForRemix({
    sortBy: 'popularity',
    limit: 10
  });

  const embed = new EmbedBuilder()
    .setTitle('🎨 Games Available for Remixing (Refreshed)')
    .setDescription('Select a game below to create your own remix!')
    .setColor(Colors.Purple)
    .setFooter({ text: `Found ${games.length} games • Use buttons to remix` });

  // Add game fields
  games.slice(0, 5).forEach((game, index) => {
    const creator = game.creator ? `@${game.creator.username}` : 'Unknown';
    const remixCount = game._count?.originalGameRemixes || 0;
    
    embed.addFields({
      name: `${index + 1}. ${game.name} (${game.type})`,
      value: `**ID:** \`${game.shortId}\` | **Creator:** ${creator}\n` +
             `**Plays:** ${game.playCount} | **Remixes:** ${remixCount}\n` +
             `${game.description.slice(0, 100)}${game.description.length > 100 ? '...' : ''}`,
      inline: false
    });
  });

  await interaction.editReply({
    embeds: [embed]
  });
}

/**
 * Handle create remix button
 */
async function handleCreateRemix(
  interaction: ButtonInteraction,
  remixService: GameRemixService,
  subscriptionChecker: SubscriptionChecker
): Promise<void> {
  // Check subscription permissions
  const subscriptionCheck = await subscriptionChecker.checkGameCreation(interaction);
  if (!subscriptionCheck.allowed) return;

  const parts = interaction.customId.split(':');
  const gameId = parts[1];
  const title = parts[2] || '';
  const description = parts[3] || '';

  await interaction.deferReply();

  try {
    // Create basic remix with default modifications
    const defaultModifications: GameModification[] = [
      {
        type: 'style',
        description: 'Applied a fresh color scheme and visual style'
      }
    ];

    const result = await remixService.createRemix({
      originalGameId: gameId,
      remixTitle: title || undefined,
      remixDescription: description || undefined,
      remixType: RemixType.FORK,
      modifications: defaultModifications,
      creatorId: interaction.user.id,
      serverId: interaction.guildId!
    });

    // Record usage for subscription tracking
    await subscriptionChecker.recordUsage(
      interaction.guildId!,
      'create_game',
      interaction.user.id,
      { type: 'remix', originalGameId: gameId }
    );

    const embed = new EmbedBuilder()
      .setTitle('🎉 Remix Created Successfully!')
      .setDescription(`Your remix **${result.remixedGame.name}** is ready to play!`)
      .setColor(Colors.Green)
      .addFields(
        { name: 'Remix ID', value: `\`${result.remixedGame.shortId}\``, inline: true },
        { name: 'Version', value: result.version.version, inline: true },
        { name: 'Type', value: result.remix.remixType, inline: true }
      )
      .setFooter({ text: 'Share your remix ID with friends so they can play it!' })
      .setTimestamp();

    const playButton = new ButtonBuilder()
      .setCustomId(`play_game:${result.remixedGame.shortId}`)
      .setLabel('Play Your Remix')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎮');

    const shareButton = new ButtonBuilder()
      .setCustomId(`share_game:${result.remixedGame.shortId}`)
      .setLabel('Share Remix')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📤');

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(playButton, shareButton)
      ]
    });

  } catch (error) {
    console.error('Error creating remix:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Remix Creation Failed')
      .setDescription('Sorry, we couldn\'t create your remix. Please try again.')
      .setColor(Colors.Red)
      .addFields({
        name: 'Error Details',
        value: error instanceof Error ? error.message : 'Unknown error occurred'
      });

    await interaction.editReply({
      embeds: [errorEmbed]
    });
  }
}

/**
 * Handle template selection from customization interface
 */
async function handleTemplateSelection(
  interaction: StringSelectMenuInteraction,
  remixService: GameRemixService,
  subscriptionChecker: SubscriptionChecker
): Promise<void> {
  const parts = interaction.customId.split(':');
  const gameId = parts[1];
  const title = parts[2] || '';
  const description = parts[3] || '';
  const templateId = interaction.values[0];

  await interaction.deferReply({ ephemeral: true });

  const template = RemixTemplatesService.getTemplateById(templateId);
  if (!template) {
    await interaction.editReply({ content: '❌ Template not found.' });
    return;
  }

  // Check subscription permissions
  const subscriptionCheck = await subscriptionChecker.checkGameCreation(interaction);
  if (!subscriptionCheck.allowed) return;

  try {
    // Create remix using the template
    const result = await remixService.createRemix({
      originalGameId: gameId,
      remixTitle: title || `${template.name} Remix`,
      remixDescription: description || template.description,
      remixType: RemixType.VARIATION,
      modifications: template.modifications,
      creatorId: interaction.user.id,
      serverId: interaction.guildId!
    });

    // Record usage
    await subscriptionChecker.recordUsage(
      interaction.guildId!,
      'create_game',
      interaction.user.id,
      { type: 'template_remix', templateId }
    );

    // Show success message
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${template.emoji} Template Applied!`)
      .setDescription(`Your **${template.name}** remix is ready to play!`)
      .setColor(Colors.Green)
      .addFields(
        { name: 'Remix ID', value: `\`${result.remixedGame.shortId}\``, inline: true },
        { name: 'Template', value: template.name, inline: true },
        { name: 'Modifications', value: template.modifications.length.toString(), inline: true }
      )
      .setFooter({ text: 'Template applied successfully!' });

    const playButton = new ButtonBuilder()
      .setCustomId(`play_game:${result.remixedGame.shortId}`)
      .setLabel('Play Your Remix')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎮');

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(playButton)
      ]
    });

  } catch (error) {
    console.error('Error creating template remix:', error);
    await interaction.editReply({
      content: '❌ Failed to create remix with template. Please try again.'
    });
  }
}

/**
 * Handle template info display
 */
async function handleTemplateInfo(interaction: StringSelectMenuInteraction): Promise<void> {
  const templateId = interaction.values[0];
  const template = RemixTemplatesService.getTemplateById(templateId);

  if (!template) {
    await interaction.reply({
      content: '❌ Template not found.',
      ephemeral: true
    });
    return;
  }

  const difficultyIcon = {
    easy: '🟢',
    medium: '🟡',
    hard: '🔴'
  }[template.difficulty];

  const embed = new EmbedBuilder()
    .setTitle(`${template.emoji} ${template.name} ${difficultyIcon}`)
    .setDescription(template.description)
    .setColor(Colors.Blue)
    .addFields(
      { name: 'Difficulty', value: template.difficulty.toUpperCase(), inline: true },
      { name: 'Modifications', value: template.modifications.length.toString(), inline: true },
      { name: 'Supported Types', value: template.gameTypes.join(', '), inline: false }
    );

  // Show modification details
  template.modifications.forEach((mod, index) => {
    embed.addFields({
      name: `${index + 1}. ${mod.type.toUpperCase()}`,
      value: mod.description,
      inline: false
    });
  });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

/**
 * Handle quick remix button
 */
async function handleQuickRemix(
  interaction: ButtonInteraction,
  remixService: GameRemixService,
  subscriptionChecker: SubscriptionChecker
): Promise<void> {
  const parts = interaction.customId.split(':');
  const gameId = parts[1];
  const title = parts[2] || '';
  const description = parts[3] || '';

  // Check subscription permissions
  const subscriptionCheck = await subscriptionChecker.checkGameCreation(interaction);
  if (!subscriptionCheck.allowed) return;

  await interaction.deferReply();

  try {
    // Get a random template for quick remix
    const randomTemplates = RemixTemplatesService.getRandomTemplates(1);
    const template = randomTemplates[0];

    const result = await remixService.createRemix({
      originalGameId: gameId,
      remixTitle: title || `Quick Remix`,
      remixDescription: description || 'A quick remix with random modifications',
      remixType: RemixType.FORK,
      modifications: template ? template.modifications : [
        {
          type: 'style',
          description: 'Applied random visual modifications'
        }
      ],
      creatorId: interaction.user.id,
      serverId: interaction.guildId!
    });

    // Record usage
    await subscriptionChecker.recordUsage(
      interaction.guildId!,
      'create_game',
      interaction.user.id,
      { type: 'quick_remix' }
    );

    const embed = new EmbedBuilder()
      .setTitle('⚡ Quick Remix Created!')
      .setDescription(`Your quick remix is ready to play!`)
      .setColor(Colors.Green)
      .addFields(
        { name: 'Remix ID', value: `\`${result.remixedGame.shortId}\``, inline: true },
        { name: 'Template Used', value: template?.name || 'Random', inline: true }
      );

    const playButton = new ButtonBuilder()
      .setCustomId(`play_game:${result.remixedGame.shortId}`)
      .setLabel('Play Now')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎮');

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(playButton)
      ]
    });

  } catch (error) {
    console.error('Error creating quick remix:', error);
    await interaction.editReply({
      content: '❌ Failed to create quick remix. Please try again.'
    });
  }
}

/**
 * Handle browse templates button
 */
async function handleBrowseTemplates(interaction: ButtonInteraction): Promise<void> {
  const gameType = interaction.customId.split(':')[1];
  
  await interaction.reply({
    content: `🎨 To browse all templates, use the command: \`/remix-game templates\`\n\nFor ${gameType} specific templates, add: \`/remix-game templates type:${gameType}\``,
    ephemeral: true
  });
}

/**
 * Handle start remix button from game selection
 */
async function handleStartRemix(
  interaction: ButtonInteraction,
  remixService: GameRemixService
): Promise<void> {
  const gameId = interaction.customId.split(':')[1];

  await interaction.deferReply({ ephemeral: true });

  // Get game details
  const games = await remixService.browseGamesForRemix({ limit: 1000 });
  const game = games.find(g => g.id === gameId);

  if (!game) {
    await interaction.editReply({
      content: '❌ Game not found.'
    });
    return;
  }

  // Show customization interface (similar to the command)
  const embed = new EmbedBuilder()
    .setTitle(`🎨 Remix: ${game.name}`)
    .setDescription(`Ready to remix **${game.name}**!`)
    .setColor(Colors.Purple)
    .addFields(
      { name: 'Original Game', value: `${game.name} by @${game.creator?.username || 'Unknown'}`, inline: false }
    );

  const quickButton = new ButtonBuilder()
    .setCustomId(`quick_remix:${gameId}::`)
    .setLabel('Quick Remix')
    .setStyle(ButtonStyle.Success)
    .setEmoji('⚡');

  await interaction.editReply({
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(quickButton)
    ]
  });
}

/**
 * Handle cancel remix button
 */
async function handleCancelRemix(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({
    content: '❌ Remix creation canceled.',
    embeds: [],
    components: []
  });
}

/**
 * Handle version details selection from history command
 */
async function handleVersionDetails(
  interaction: StringSelectMenuInteraction,
  remixService: GameRemixService
): Promise<void> {
  const parts = interaction.customId.split(':');
  const gameId = parts[1];
  const versionId = interaction.values[0];

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get all versions to find the selected one
    const versions = await remixService.getGameVersions(gameId);
    const selectedVersion = versions.find(v => v.id === versionId);

    if (!selectedVersion) {
      await interaction.editReply({
        content: '❌ Version not found.'
      });
      return;
    }

    // Get game info
    const games = await remixService.browseGamesForRemix({ limit: 1000 });
    const game = games.find(g => g.id === gameId);

    if (!game) {
      await interaction.editReply({
        content: '❌ Game not found.'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Version ${selectedVersion.version}: ${selectedVersion.title || game.name}`)
      .setDescription(selectedVersion.description || game.description)
      .setColor(selectedVersion.isLatest ? Colors.Green : Colors.Blue)
      .addFields(
        { name: 'Version', value: selectedVersion.version, inline: true },
        { name: 'Status', value: selectedVersion.isLatest ? '🟢 Current' : '📌 Previous', inline: true },
        { name: 'Created By', value: selectedVersion.createdBy ? `@${selectedVersion.createdBy.username}` : 'Unknown', inline: true },
        { name: 'Date Created', value: `<t:${Math.floor(selectedVersion.createdAt.getTime() / 1000)}:F>`, inline: false },
        { name: 'Changelog', value: selectedVersion.changelog || 'No changelog provided', inline: false }
      );

    // Show detailed modifications if available
    if (selectedVersion.changes && Array.isArray(selectedVersion.changes)) {
      const modifications = selectedVersion.changes as any[];
      if (modifications.length > 0) {
        const modificationDetails = modifications.map((mod, index) => {
          const typeEmojis: Record<string, string> = {
            'style': '🎨',
            'mechanics': '⚙️',
            'theme': '🌍', 
            'difficulty': '🎯',
            'assets': '🖼️'
          };
          
          const emoji = typeEmojis[mod.type] || '🔧';
          return `${emoji} **${mod.type.toUpperCase()}**: ${mod.description}`;
        }).join('\n');

        embed.addFields({
          name: `🔧 Modifications (${modifications.length})`,
          value: modificationDetails.slice(0, 1000), // Limit to Discord's field limit
          inline: false
        });
      }
    }

    // Show metadata if available
    if (selectedVersion.metadata) {
      const metadata = selectedVersion.metadata as any;
      const metaInfo = [];
      
      if (metadata.isRemix) {
        metaInfo.push('🎨 This is a remix');
      }
      if (metadata.originalGameId) {
        metaInfo.push(`📎 Original game: ${metadata.originalGameId}`);
      }
      if (metadata.remixType) {
        metaInfo.push(`🔄 Remix type: ${metadata.remixType}`);
      }
      
      if (metaInfo.length > 0) {
        embed.addFields({
          name: '📊 Metadata',
          value: metaInfo.join('\n'),
          inline: false
        });
      }
    }

    embed.setFooter({ 
      text: `Version ${selectedVersion.version} • Use /remix-game history ${game.shortId} to see all versions` 
    });

    // Add navigation buttons
    const currentIndex = versions.findIndex(v => v.id === versionId);
    const buttons = [];

    if (currentIndex < versions.length - 1) {
      const prevVersion = versions[currentIndex + 1];
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`version_nav:${gameId}:${prevVersion.id}`)
          .setLabel(`← v${prevVersion.version}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    }

    if (currentIndex > 0) {
      const nextVersion = versions[currentIndex - 1];
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`version_nav:${gameId}:${nextVersion.id}`)
          .setLabel(`v${nextVersion.version} →`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
      );
    }

    const components = [];
    if (buttons.length > 0) {
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
    }

    await interaction.editReply({
      embeds: [embed],
      components
    });

  } catch (error) {
    console.error('Error handling version details:', error);
    await interaction.editReply({
      content: '❌ Failed to load version details. Please try again.'
    });
  }
}

/**
 * Handle version navigation buttons
 */
async function handleVersionNavigation(
  interaction: ButtonInteraction,
  remixService: GameRemixService
): Promise<void> {
  const parts = interaction.customId.split(':');
  const gameId = parts[1];
  const versionId = parts[2];

  // Reuse the version details handler logic
  const mockSelectInteraction = {
    ...interaction,
    isStringSelectMenu: () => true,
    customId: `version_details:${gameId}`,
    values: [versionId],
    deferReply: (options: any) => interaction.deferUpdate()
  } as any;

  try {
    // Get all versions to find the selected one
    const versions = await remixService.getGameVersions(gameId);
    const selectedVersion = versions.find(v => v.id === versionId);

    if (!selectedVersion) {
      await interaction.editReply({
        content: '❌ Version not found.'
      });
      return;
    }

    // Get game info
    const games = await remixService.browseGamesForRemix({ limit: 1000 });
    const game = games.find(g => g.id === gameId);

    if (!game) {
      await interaction.editReply({
        content: '❌ Game not found.'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Version ${selectedVersion.version}: ${selectedVersion.title || game.name}`)
      .setDescription(selectedVersion.description || game.description)
      .setColor(selectedVersion.isLatest ? Colors.Green : Colors.Blue)
      .addFields(
        { name: 'Version', value: selectedVersion.version, inline: true },
        { name: 'Status', value: selectedVersion.isLatest ? '🟢 Current' : '📌 Previous', inline: true },
        { name: 'Created By', value: selectedVersion.createdBy ? `@${selectedVersion.createdBy.username}` : 'Unknown', inline: true },
        { name: 'Date Created', value: `<t:${Math.floor(selectedVersion.createdAt.getTime() / 1000)}:F>`, inline: false },
        { name: 'Changelog', value: selectedVersion.changelog || 'No changelog provided', inline: false }
      );

    // Show detailed modifications if available
    if (selectedVersion.changes && Array.isArray(selectedVersion.changes)) {
      const modifications = selectedVersion.changes as any[];
      if (modifications.length > 0) {
        const modificationDetails = modifications.map((mod, index) => {
          const typeEmojis: Record<string, string> = {
            'style': '🎨',
            'mechanics': '⚙️',
            'theme': '🌍', 
            'difficulty': '🎯',
            'assets': '🖼️'
          };
          
          const emoji = typeEmojis[mod.type] || '🔧';
          return `${emoji} **${mod.type.toUpperCase()}**: ${mod.description}`;
        }).join('\n');

        embed.addFields({
          name: `🔧 Modifications (${modifications.length})`,
          value: modificationDetails.slice(0, 1000),
          inline: false
        });
      }
    }

    // Show metadata if available
    if (selectedVersion.metadata) {
      const metadata = selectedVersion.metadata as any;
      const metaInfo = [];
      
      if (metadata.isRemix) {
        metaInfo.push('🎨 This is a remix');
      }
      if (metadata.originalGameId) {
        metaInfo.push(`📎 Original game: ${metadata.originalGameId}`);
      }
      if (metadata.remixType) {
        metaInfo.push(`🔄 Remix type: ${metadata.remixType}`);
      }
      
      if (metaInfo.length > 0) {
        embed.addFields({
          name: '📊 Metadata',
          value: metaInfo.join('\n'),
          inline: false
        });
      }
    }

    embed.setFooter({ 
      text: `Version ${selectedVersion.version} • Use /remix-game history ${game.shortId} to see all versions` 
    });

    // Add navigation buttons
    const currentIndex = versions.findIndex(v => v.id === versionId);
    const buttons = [];

    if (currentIndex < versions.length - 1) {
      const prevVersion = versions[currentIndex + 1];
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`version_nav:${gameId}:${prevVersion.id}`)
          .setLabel(`← v${prevVersion.version}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⬅️')
      );
    }

    if (currentIndex > 0) {
      const nextVersion = versions[currentIndex - 1];
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`version_nav:${gameId}:${nextVersion.id}`)
          .setLabel(`v${nextVersion.version} →`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('➡️')
      );
    }

    const components = [];
    if (buttons.length > 0) {
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));
    }

    await interaction.editReply({
      embeds: [embed],
      components
    });

  } catch (error) {
    console.error('Error handling version navigation:', error);
    await interaction.editReply({
      content: '❌ Failed to navigate versions. Please try again.'
    });
  }
}

/**
 * Handle trending remix exploration
 */
async function handleTrendingRemixExplore(
  interaction: StringSelectMenuInteraction,
  remixService: GameRemixService
): Promise<void> {
  const gameId = interaction.values[0];

  await interaction.deferReply({ ephemeral: true });

  try {
    // Get game and remix info
    const games = await remixService.browseGamesForRemix({ limit: 1000 });
    const game = games.find(g => g.id === gameId);
    const remixInfo = await remixService.getRemixInfo(gameId);

    if (!game) {
      await interaction.editReply({
        content: '❌ Game not found.'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🔍 ${game.name}`)
      .setDescription(game.description)
      .setColor(Colors.Blue)
      .addFields(
        { name: 'Game ID', value: `\`${game.shortId}\``, inline: true },
        { name: 'Type', value: game.type, inline: true },
        { name: 'Plays', value: game.playCount.toString(), inline: true },
        { name: 'Creator', value: game.creator ? `@${game.creator.username}` : 'Unknown', inline: true },
        { name: 'Created', value: `<t:${Math.floor(game.createdAt.getTime() / 1000)}:R>`, inline: true }
      );

    if (remixInfo) {
      embed.addFields({
        name: '🎨 Remix Details',
        value: `**Original:** ${remixInfo.originalGame.name}\n` +
               `**Remix Type:** ${remixInfo.remixType}\n` +
               `**Remixed by:** @${remixInfo.remixedBy.username}`,
        inline: false
      });
    }

    // Add action buttons
    const playButton = new ButtonBuilder()
      .setCustomId(`play_game:${game.shortId}`)
      .setLabel('Play Now')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎮');

    const remixButton = new ButtonBuilder()  
      .setCustomId(`start_remix:${game.id}`)
      .setLabel('Remix This')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎨');

    const historyButton = new ButtonBuilder()
      .setCustomId(`view_history:${game.id}`)
      .setLabel('Version History')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📚');

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(playButton, remixButton, historyButton)
      ]
    });

  } catch (error) {
    console.error('Error exploring trending remix:', error);
    await interaction.editReply({
      content: '❌ Failed to load remix details. Please try again.'
    });
  }
}

/**
 * Handle community stats button
 */
async function handleCommunityStats(
  interaction: ButtonInteraction,
  remixService: GameRemixService
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const trendingRemixes = await remixService.getTrendingRemixes(50);
    const totalRemixes = trendingRemixes.length;

    // Calculate community statistics
    const typeStats: Record<string, number> = {};
    const creatorStats: Record<string, number> = {};
    let totalPlays = 0;

    trendingRemixes.forEach(remix => {
      const type = remix.originalGame.type;
      typeStats[type] = (typeStats[type] || 0) + 1;
      totalPlays += remix.remixGame.playCount;

      if (remix.remixedBy?.username) {
        const username = remix.remixedBy.username;
        creatorStats[username] = (creatorStats[username] || 0) + 1;
      }
    });

    const topTypes = Object.entries(typeStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    const topCreators = Object.entries(creatorStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    const embed = new EmbedBuilder()
      .setTitle('📊 Community Remix Statistics')
      .setDescription('Insights into the GameVibe AI remix community')
      .setColor(Colors.Green)
      .addFields(
        { name: '🎮 Total Active Remixes', value: totalRemixes.toString(), inline: true },
        { name: '👥 Active Creators', value: Object.keys(creatorStats).length.toString(), inline: true },
        { name: '🎯 Total Community Plays', value: totalPlays.toLocaleString(), inline: true }
      );

    // Top game types
    if (topTypes.length > 0) {
      const typeList = topTypes.map(([type, count]) => 
        `${getGameTypeEmoji(type)} **${type}**: ${count} remixes`
      ).join('\n');
      
      embed.addFields({
        name: '🏆 Popular Game Types',
        value: typeList,
        inline: true
      });
    }

    // Top creators
    if (topCreators.length > 0) {
      const creatorList = topCreators.map(([username, count], index) => 
        `${index < 3 ? ['🥇', '🥈', '🥉'][index] : '⭐'} @${username}: ${count} remixes`
      ).join('\n');
      
      embed.addFields({
        name: '👑 Top Remix Creators',
        value: creatorList,
        inline: true
      });
    }

    embed.setFooter({ text: 'Stats refreshed every hour • Join the community and start remixing!' });

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error getting community stats:', error);
    await interaction.editReply({
      content: '❌ Failed to load community statistics. Please try again.'
    });
  }
}

/**
 * Handle remix categories browsing
 */
async function handleRemixCategories(
  interaction: ButtonInteraction,
  remixService: GameRemixService
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const embed = new EmbedBuilder()
      .setTitle('📂 Browse Remix Categories')
      .setDescription('Discover remixes organized by type and theme')
      .setColor(Colors.Purple);

    // Add category descriptions
    const categories = [
      { emoji: '🎨', name: 'Style Makeovers', desc: 'Visual transformations and new aesthetics' },
      { emoji: '⚙️', name: 'Mechanics Tweaks', desc: 'Gameplay adjustments and new mechanics' },
      { emoji: '🌍', name: 'Theme Changes', desc: 'Setting and story transformations' },
      { emoji: '🎯', name: 'Difficulty Mods', desc: 'Easier or more challenging versions' },
      { emoji: '🍴', name: 'Community Forks', desc: 'Player-created variations' },
      { emoji: '⭐', name: 'Featured Remixes', desc: 'Hand-picked amazing creations' }
    ];

    categories.forEach(cat => {
      embed.addFields({
        name: `${cat.emoji} ${cat.name}`,
        value: cat.desc,
        inline: true
      });
    });

    // Create category selection menu
    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('browse_by_category')
      .setPlaceholder('Select a category to explore')
      .addOptions(
        categories.map(cat => ({
          label: cat.name,
          description: cat.desc,
          value: cat.name.toLowerCase().replace(/\s+/g, '_'),
          emoji: cat.emoji
        }))
      );

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect)
      ]
    });

  } catch (error) {
    console.error('Error handling remix categories:', error);
    await interaction.editReply({
      content: '❌ Failed to load remix categories. Please try again.'
    });
  }
}

/**
 * Handle my remixes button
 */
async function handleMyRemixes(
  interaction: ButtonInteraction,
  remixService: GameRemixService
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Get user's remixes
    const userRemixes = await remixService.getRemixesByCreator(interaction.user.id, 10);

    if (userRemixes.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('👤 My Remixes')
        .setDescription('You haven\'t created any remixes yet!')
        .setColor(Colors.Yellow)
        .addFields({
          name: '🎨 Get Started',
          value: 'Use `/remix-game browse` to find games to remix, or try `/remix-game templates` to see modification ideas!',
          inline: false
        });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`👤 My Remixes (${userRemixes.length})`)
      .setDescription(`Your creative game remixes, @${interaction.user.username}!`)
      .setColor(Colors.Blue);

    // Show user's remixes
    userRemixes.forEach((remix, index) => {
      embed.addFields({
        name: `${index + 1}. ${remix.remixGame.name}`,
        value: `**ID:** \`${remix.remixGame.shortId}\` | **Plays:** ${remix.remixGame.playCount}\n` +
               `**Original:** ${remix.originalGame.name}\n` +
               `**Created:** <t:${Math.floor(remix.remixedAt.getTime() / 1000)}:R>`,
        inline: false
      });
    });

    // Create selection menu for user's remixes
    const myRemixSelect = new StringSelectMenuBuilder()
      .setCustomId('manage_my_remix')
      .setPlaceholder('Select one of your remixes to manage')
      .addOptions(
        userRemixes.map((remix, index) => ({
          label: remix.remixGame.name,
          description: `${remix.remixGame.playCount} plays • from ${remix.originalGame.name}`,
          value: remix.remixGame.id,
          emoji: '🎮'
        }))
      );

    await interaction.editReply({
      embeds: [embed],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(myRemixSelect)  
      ]
    });

  } catch (error) {
    console.error('Error handling my remixes:', error);
    await interaction.editReply({
      content: '❌ Failed to load your remixes. Please try again.'
    });
  }
}

/**
 * Helper function to get game type emoji
 */
function getGameTypeEmoji(gameType: string): string {
  const emojis: Record<string, string> = {
    PLATFORMER: '🏃',
    PUZZLE: '🧩',
    RPG: '⚔️', 
    SHOOTER: '🔫',
    ENDLESS_RUNNER: '🏃‍♂️',
    TOWER_DEFENSE: '🏰',
    OTHER: '🎮'
  };
  return emojis[gameType] || '🎮';
}