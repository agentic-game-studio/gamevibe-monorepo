import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from 'discord.js';
import { Logger } from '../utils/logger.js';
import { Container } from 'inversify';
import { SocialMediaService } from '../services/social-media.js';
import { TYPES } from '../types.js';

const logger = new Logger('SocialMediaInteractions');

export async function handleSocialMediaInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  container: Container
): Promise<void> {
  const socialMediaService = container.get<SocialMediaService>(TYPES.SocialMediaService);
  
  try {
    const [prefix, action, ...params] = interaction.customId.split(':');
    
    if (prefix !== 'social') return;

    switch (action) {
      case 'platforms':
        await handlePlatformsButton(interaction as ButtonInteraction);
        break;
      case 'triggers':
        await handleTriggersButton(interaction as ButtonInteraction);
        break;
      case 'templates':
        await handleTemplatesButton(interaction as ButtonInteraction);
        break;
      case 'select_platforms':
        await handlePlatformSelection(interaction as StringSelectMenuInteraction, socialMediaService);
        break;
      case 'trigger':
        await handleTriggerToggle(interaction as ButtonInteraction, params[0], socialMediaService);
        break;
      case 'select_template':
        await handleTemplateSelection(interaction as StringSelectMenuInteraction);
        break;
      case 'edit_template':
        await handleTemplateEdit(interaction as ButtonInteraction, params[0], socialMediaService);
        break;
    }
  } catch (error) {
    logger.error('Error handling social media interaction:', error);
    await interaction.reply({
      content: 'An error occurred while processing your request.',
      ephemeral: true,
    });
  }
}

async function handlePlatformsButton(interaction: ButtonInteraction) {
  const serverId = interaction.guildId!;
  const socialMediaService = container.get<SocialMediaService>(TYPES.SocialMediaService);
  const settings = await socialMediaService.getServerAutoPostSettings(serverId);

  const embed = new EmbedBuilder()
    .setTitle('🌐 Select Social Media Platforms')
    .setDescription('Choose which platforms to auto-post to:')
    .setColor(0x00acee)
    .addFields({
      name: 'Currently Selected',
      value: settings.platforms.length > 0
        ? settings.platforms.map(p => `• ${p}`).join('\n')
        : 'None',
      inline: false,
    });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('social:select_platforms')
    .setPlaceholder('Select platforms')
    .setMinValues(0)
    .setMaxValues(2)
    .addOptions([
      {
        label: 'Twitter',
        description: 'Post game updates to Twitter/X',
        value: 'twitter',
        emoji: '🐦',
        default: settings.platforms.includes('twitter'),
      },
      {
        label: 'TikTok',
        description: 'Share gameplay videos on TikTok',
        value: 'tiktok',
        emoji: '🎵',
        default: settings.platforms.includes('tiktok'),
      },
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleTriggersButton(interaction: ButtonInteraction) {
  const serverId = interaction.guildId!;
  const socialMediaService = container.get<SocialMediaService>(TYPES.SocialMediaService);
  const settings = await socialMediaService.getServerAutoPostSettings(serverId);

  const embed = new EmbedBuilder()
    .setTitle('🎯 Configure Auto-Post Triggers')
    .setDescription('Click to toggle when posts are automatically created:')
    .setColor(0x00acee);

  const buttons = Object.entries(settings.triggers).map(([trigger, enabled]) => {
    return new ButtonBuilder()
      .setCustomId(`social:trigger:${trigger}`)
      .setLabel(formatTriggerName(trigger))
      .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(getTriggerEmoji(trigger));
  });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(buttons.slice(i, i + 2));
    rows.push(row);
  }

  await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
}

async function handleTemplatesButton(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('📝 Social Media Post Templates')
    .setDescription(
      'Customize your auto-post templates. Use these variables:\n\n' +
      '**Available Variables:**\n' +
      '• `{title}` - Game title\n' +
      '• `{type}` - Game type\n' +
      '• `{creator}` - Creator name\n' +
      '• `{url}` - Game URL\n' +
      '• `{plays}` - Play count\n\n' +
      'Select a template to edit:'
    )
    .setColor(0x00acee);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('social:select_template')
    .setPlaceholder('Choose a template to edit')
    .addOptions([
      {
        label: 'Game Creation',
        description: 'Posted when a new game is created',
        value: 'gameCreation',
        emoji: '🎮',
      },
      {
        label: 'Viral Milestone',
        description: 'Posted when a game goes viral',
        value: 'viralMilestone',
        emoji: '🔥',
      },
      {
        label: 'Weekly Highlight',
        description: 'Weekly top games summary',
        value: 'weeklyHighlight',
        emoji: '📊',
      },
      {
        label: 'Event Winner',
        description: 'Announces event winners',
        value: 'eventWinner',
        emoji: '🏆',
      },
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handlePlatformSelection(
  interaction: StringSelectMenuInteraction,
  socialMediaService: SocialMediaService
) {
  const serverId = interaction.guildId!;
  const selectedPlatforms = interaction.values;

  await socialMediaService.updateServerAutoPostSettings(serverId, {
    platforms: selectedPlatforms,
  });

  const embed = new EmbedBuilder()
    .setTitle('🌐 Platforms Updated')
    .setDescription(
      selectedPlatforms.length > 0
        ? `Auto-posting enabled for:\n${selectedPlatforms.map(p => `• ${p}`).join('\n')}`
        : 'All platforms disabled'
    )
    .setColor(0x00ff00)
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [] });
}

async function handleTriggerToggle(
  interaction: ButtonInteraction,
  trigger: string,
  socialMediaService: SocialMediaService
) {
  const serverId = interaction.guildId!;
  const settings = await socialMediaService.getServerAutoPostSettings(serverId);
  
  // Toggle the trigger
  settings.triggers[trigger as keyof typeof settings.triggers] = 
    !settings.triggers[trigger as keyof typeof settings.triggers];

  await socialMediaService.updateServerAutoPostSettings(serverId, {
    triggers: settings.triggers,
  });

  // Update the buttons
  const embed = new EmbedBuilder()
    .setTitle('🎯 Configure Auto-Post Triggers')
    .setDescription('Click to toggle when posts are automatically created:')
    .setColor(0x00acee);

  const buttons = Object.entries(settings.triggers).map(([t, enabled]) => {
    return new ButtonBuilder()
      .setCustomId(`social:trigger:${t}`)
      .setLabel(formatTriggerName(t))
      .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(getTriggerEmoji(t));
  });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(buttons.slice(i, i + 2));
    rows.push(row);
  }

  await interaction.update({ embeds: [embed], components: rows });
}

async function handleTemplateSelection(interaction: StringSelectMenuInteraction) {
  const template = interaction.values[0];
  const serverId = interaction.guildId!;
  const socialMediaService = container.get<SocialMediaService>(TYPES.SocialMediaService);
  const settings = await socialMediaService.getServerAutoPostSettings(serverId);

  const currentTemplate = settings.templates[template as keyof typeof settings.templates];

  const embed = new EmbedBuilder()
    .setTitle(`📝 Edit ${formatTriggerName(template)} Template`)
    .setDescription(
      '**Current Template:**\n' +
      `\`\`\`${currentTemplate}\`\`\`\n\n` +
      'Click the button below to edit this template.'
    )
    .setColor(0x00acee)
    .addFields({
      name: 'Available Variables',
      value: 
        '• `{title}` - Game title\n' +
        '• `{type}` - Game type\n' +
        '• `{creator}` - Creator name\n' +
        '• `{url}` - Game URL\n' +
        '• `{plays}` - Play count\n' +
        '• `{shares}` - Share count\n' +
        '• `{servers}` - Servers reached',
      inline: false,
    });

  const button = new ButtonBuilder()
    .setCustomId(`social:edit_template:${template}`)
    .setLabel('Edit Template')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('✏️');

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(button);

  await interaction.update({ embeds: [embed], components: [row] });
}

async function handleTemplateEdit(
  interaction: ButtonInteraction,
  template: string,
  socialMediaService: SocialMediaService
) {
  const serverId = interaction.guildId!;
  const settings = await socialMediaService.getServerAutoPostSettings(serverId);
  const currentTemplate = settings.templates[template as keyof typeof settings.templates];

  const modal = new ModalBuilder()
    .setCustomId(`social:modal:template:${template}`)
    .setTitle(`Edit ${formatTriggerName(template)} Template`);

  const templateInput = new TextInputBuilder()
    .setCustomId('template')
    .setLabel('Template Text')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(currentTemplate)
    .setPlaceholder('Enter your template with variables like {title}, {creator}, etc.')
    .setRequired(true)
    .setMaxLength(500);

  const row = new ActionRowBuilder<TextInputBuilder>()
    .addComponents(templateInput);

  modal.addComponents(row);

  await interaction.showModal(modal);
}

// Helper functions
function formatTriggerName(trigger: string): string {
  const names: Record<string, string> = {
    gameCreation: 'New Game Created',
    viralMilestone: 'Viral Milestone Reached',
    weeklyHighlight: 'Weekly Highlights',
    eventWinner: 'Event Winners',
  };
  return names[trigger] || trigger;
}

function getTriggerEmoji(trigger: string): string {
  const emojis: Record<string, string> = {
    gameCreation: '🎮',
    viralMilestone: '🔥',
    weeklyHighlight: '📊',
    eventWinner: '🏆',
  };
  return emojis[trigger] || '📢';
}

