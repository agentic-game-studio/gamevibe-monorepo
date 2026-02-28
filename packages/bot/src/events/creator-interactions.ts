import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ModalSubmitInteraction,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Logger } from '../utils/logger.js';
import { Container } from 'inversify';
import { ContentCreatorService } from '../services/content-creator.js';
import { TYPES } from '../types.js';
import { ContentType } from '../generated/prisma/index.js';

const logger = new Logger('CreatorInteractions');

export async function handleCreatorInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
  container: Container
): Promise<void> {
  const contentCreatorService = container.get<ContentCreatorService>(TYPES.ContentCreatorService);
  
  try {
    const [prefix, action, ...params] = interaction.customId.split(':');
    
    if (prefix !== 'creator') return;

    switch (action) {
      case 'start_application':
        await handleStartApplication(interaction as ButtonInteraction);
        break;
      case 'select_platform':
        await handlePlatformSelection(interaction as StringSelectMenuInteraction, contentCreatorService);
        break;
      case 'application_modal':
        await handleApplicationModal(interaction as ModalSubmitInteraction, contentCreatorService);
        break;
      case 'confirm_application':
        await handleConfirmApplication(interaction as ButtonInteraction, contentCreatorService);
        break;
      case 'cancel_application':
        await handleCancelApplication(interaction as ButtonInteraction);
        break;
    }
  } catch (error) {
    logger.error('Error handling creator interaction:', error);
    
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        ephemeral: true,
      });
    }
  }
}

async function handleStartApplication(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('📋 Creator Application - Step 1')
    .setDescription('Please select your primary content platform:')
    .setColor(0x00acee);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('creator:select_platform')
    .setPlaceholder('Choose your main platform')
    .addOptions([
      {
        label: 'YouTube',
        description: 'YouTube channel creator',
        value: 'YOUTUBE',
        emoji: '📺',
      },
      {
        label: 'Twitch',
        description: 'Twitch streamer',
        value: 'TWITCH',
        emoji: '🎮',
      },
      {
        label: 'TikTok',
        description: 'TikTok content creator',
        value: 'TIKTOK',
        emoji: '🎵',
      },
      {
        label: 'Instagram',
        description: 'Instagram creator/influencer',
        value: 'INSTAGRAM',
        emoji: '📸',
      },
      {
        label: 'Twitter',
        description: 'Twitter content creator',
        value: 'TWITTER',
        emoji: '🐦',
      },
      {
        label: 'Blog/Website',
        description: 'Blog or website owner',
        value: 'BLOG',
        emoji: '📝',
      },
      {
        label: 'Podcast',
        description: 'Podcast host',
        value: 'PODCAST',
        emoji: '🎙️',
      },
    ]);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(selectMenu);

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handlePlatformSelection(
  interaction: StringSelectMenuInteraction,
  contentCreatorService: ContentCreatorService
) {
  const selectedPlatform = interaction.values[0] as ContentType;
  
  // Store platform selection temporarily (in practice, you'd use a cache or database)
  // For now, we'll pass it through the modal custom ID
  
  const modal = new ModalBuilder()
    .setCustomId(`creator:application_modal:${selectedPlatform}`)
    .setTitle('Creator Partnership Application');

  const bioInput = new TextInputBuilder()
    .setCustomId('bio')
    .setLabel('Tell us about yourself')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Describe your content, audience, and why you want to partner with GameVibe AI...')
    .setRequired(true)
    .setMaxLength(1000);

  const subscribersInput = new TextInputBuilder()
    .setCustomId('subscribers')
    .setLabel('Total Subscribers/Followers')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 10000')
    .setRequired(true);

  const viewsInput = new TextInputBuilder()
    .setCustomId('avgViews')
    .setLabel('Average Views per Video/Post')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 5000')
    .setRequired(true);

  const engagementInput = new TextInputBuilder()
    .setCustomId('engagement')
    .setLabel('Engagement Rate (%)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., 5.5 (leave blank if unknown)')
    .setRequired(false);

  const socialLinksInput = new TextInputBuilder()
    .setCustomId('socialLinks')
    .setLabel('Social Media Links')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Paste your channel/profile URLs (one per line)')
    .setRequired(true)
    .setMaxLength(500);

  const bioRow = new ActionRowBuilder<TextInputBuilder>().addComponents(bioInput);
  const subscribersRow = new ActionRowBuilder<TextInputBuilder>().addComponents(subscribersInput);
  const viewsRow = new ActionRowBuilder<TextInputBuilder>().addComponents(viewsInput);
  const engagementRow = new ActionRowBuilder<TextInputBuilder>().addComponents(engagementInput);
  const socialLinksRow = new ActionRowBuilder<TextInputBuilder>().addComponents(socialLinksInput);

  modal.addComponents(bioRow, subscribersRow, viewsRow, engagementRow, socialLinksRow);

  await interaction.showModal(modal);
}

async function handleApplicationModal(
  interaction: ModalSubmitInteraction,
  contentCreatorService: ContentCreatorService
) {
  await interaction.deferReply({ ephemeral: true });

  const [, , platform] = interaction.customId.split(':');
  const primaryPlatform = platform as ContentType;

  // Extract form data
  const bio = interaction.fields.getTextInputValue('bio');
  const subscribersStr = interaction.fields.getTextInputValue('subscribers');
  const avgViewsStr = interaction.fields.getTextInputValue('avgViews');
  const engagementStr = interaction.fields.getTextInputValue('engagement');
  const socialLinksStr = interaction.fields.getTextInputValue('socialLinks');

  // Validate numeric inputs
  const subscribers = parseInt(subscribersStr.replace(/,/g, ''));
  const avgViews = parseInt(avgViewsStr.replace(/,/g, ''));
  const engagement = engagementStr ? parseFloat(engagementStr) : 3.0; // Default 3%

  if (isNaN(subscribers) || isNaN(avgViews)) {
    await interaction.editReply({
      content: '❌ Please enter valid numbers for subscribers and average views.',
    });
    return;
  }

  if (subscribers < 1000) {
    await interaction.editReply({
      content: '❌ You need at least 1,000 subscribers/followers to apply for the creator program.',
    });
    return;
  }

  // Parse social links
  const links = socialLinksStr.split('\n').filter(link => link.trim());
  const socialLinks: Record<string, string> = {};
  
  links.forEach((link, index) => {
    const trimmedLink = link.trim();
    if (trimmedLink.startsWith('http')) {
      socialLinks[`link_${index + 1}`] = trimmedLink;
    }
  });

  // Calculate estimated total views
  const estimatedTotalViews = avgViews * Math.max(10, Math.floor(subscribers / 100)); // Rough estimate

  // Create application
  const application = {
    bio,
    primaryPlatform,
    platforms: [primaryPlatform], // Can be expanded later
    socialLinks,
    totalViews: estimatedTotalViews,
    totalSubscribers: subscribers,
    avgViewsPerVideo: avgViews,
    engagementRate: engagement / 100, // Convert percentage to decimal
  };

  // Store application data temporarily and show confirmation
  const embed = new EmbedBuilder()
    .setTitle('📋 Review Your Application')
    .setDescription('Please review your application details before submitting:')
    .setColor(0x00acee)
    .addFields(
      {
        name: 'Primary Platform',
        value: getPlatformDisplayName(primaryPlatform),
        inline: true,
      },
      {
        name: 'Subscribers/Followers',
        value: subscribers.toLocaleString(),
        inline: true,
      },
      {
        name: 'Avg. Views per Video',
        value: avgViews.toLocaleString(),
        inline: true,
      },
      {
        name: 'Engagement Rate',
        value: `${engagement.toFixed(1)}%`,
        inline: true,
      },
      {
        name: 'Social Links',
        value: Object.values(socialLinks).slice(0, 3).join('\n') || 'None provided',
        inline: false,
      },
      {
        name: 'Bio',
        value: bio.length > 200 ? bio.substring(0, 200) + '...' : bio,
        inline: false,
      }
    )
    .setFooter({ text: 'Click Confirm to submit your application for review' });

  // Store application data in custom ID (simplified - in production use database/cache)
  const applicationData = Buffer.from(JSON.stringify(application)).toString('base64');
  
  const confirmRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`creator:confirm_application:${applicationData}`)
        .setLabel('Confirm & Submit')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('creator:cancel_application')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌')
    );

  await interaction.editReply({ embeds: [embed], components: [confirmRow] });
}

async function handleConfirmApplication(
  interaction: ButtonInteraction,
  contentCreatorService: ContentCreatorService
) {
  await interaction.deferUpdate();

  try {
    // Extract application data from custom ID
    const [, , applicationDataB64] = interaction.customId.split(':');
    const applicationData = JSON.parse(Buffer.from(applicationDataB64, 'base64').toString());

    // Submit application
    const result = await contentCreatorService.submitApplication(
      interaction.user.id,
      interaction.user.username,
      applicationData
    );

    if (result.success) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Application Submitted!')
        .setDescription(
          'Thank you for applying to the GameVibe AI Creator Partnership Program!\n\n' +
          '**What happens next:**\n' +
          '1. Our team will review your application (1-3 business days)\n' +
          '2. We may reach out for additional information\n' +
          '3. You\'ll receive a DM with the decision\n' +
          '4. If approved, you\'ll get onboarding instructions\n\n' +
          `**Application ID:** ${result.applicationId}\n\n` +
          'You can check your status anytime with `/creator status`'
        )
        .setColor(0x00ff00)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed], components: [] });
    } else {
      const embed = new EmbedBuilder()
        .setTitle('❌ Application Failed')
        .setDescription(result.message)
        .setColor(0xff0000);

      await interaction.editReply({ embeds: [embed], components: [] });
    }
  } catch (error) {
    logger.error('Failed to process application confirmation:', error);
    
    const embed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to process your application. Please try again.')
      .setColor(0xff0000);

    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

async function handleCancelApplication(interaction: ButtonInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('Application Cancelled')
    .setDescription('Your creator application has been cancelled. You can start a new application anytime with `/creator apply`.')
    .setColor(0x999999);

  await interaction.update({ embeds: [embed], components: [] });
}

function getPlatformDisplayName(platform: ContentType): string {
  switch (platform) {
    case ContentType.YOUTUBE: return 'YouTube';
    case ContentType.TWITCH: return 'Twitch';
    case ContentType.TIKTOK: return 'TikTok';
    case ContentType.INSTAGRAM: return 'Instagram';
    case ContentType.TWITTER: return 'Twitter';
    case ContentType.BLOG: return 'Blog/Website';
    case ContentType.PODCAST: return 'Podcast';
    case ContentType.DISCORD: return 'Discord';
    default: return platform;
  }
}

