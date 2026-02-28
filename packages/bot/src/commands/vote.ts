import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Logger } from '../utils/logger.js';
import { prisma } from '../utils/database.js';
import { botListingService } from '../services/index.js';

const logger = new Logger('VoteCommand');

export const voteCommand = {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Support GameVibe AI by voting and earn credits!')
    .addSubcommand(subcommand =>
      subcommand
        .setName('links')
        .setDescription('Get voting links for all bot listing sites')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('View your voting statistics and rewards')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remind')
        .setDescription('Set up voting reminders (toggle on/off)')
    ),

  async execute(interaction: CommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'links':
        await handleVoteLinks(interaction);
        break;
      case 'stats':
        await handleVoteStats(interaction);
        break;
      case 'remind':
        await handleVoteReminder(interaction);
        break;
    }
  },
};

async function handleVoteLinks(interaction: CommandInteraction) {
  try {
    const urls = botListingService.getBotListingUrls();
    
    const embed = new EmbedBuilder()
      .setTitle('🗳️ Vote for GameVibe AI')
      .setDescription(
        '**Support GameVibe AI by voting on bot listing sites!**\n' +
        '\n🎁 **Rewards:**\n' +
        '• 10 credits per vote\n' +
        '• 20 credits on weekends (2x bonus!)\n' +
        '• Special achievements for regular voters\n' +
        '\nVoting helps more people discover GameVibe AI and supports development!'
      )
      .setColor(0x00ff00)
      .addFields(
        {
          name: '⏰ Vote Cooldowns',
          value: 'You can vote every 12 hours on each site',
          inline: false,
        },
        {
          name: '🏆 Vote Milestones',
          value: 
            '• First Vote: 25 bonus credits\n' +
            '• 10 Votes: "Supporter" achievement + 100 credits\n' +
            '• 50 Votes: "Dedicated Voter" achievement + 500 credits\n' +
            '• 100 Votes: "Voting Champion" achievement + 1000 credits',
          inline: false,
        }
      )
      .setFooter({ text: 'Thank you for supporting GameVibe AI!' })
      .setTimestamp();

    // Create buttons for each voting site
    const row1 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Vote on Top.gg')
          .setStyle(ButtonStyle.Link)
          .setURL(urls.topgg)
          .setEmoji('🔝'),
        new ButtonBuilder()
          .setLabel('Vote on Discord.bots.gg')
          .setStyle(ButtonStyle.Link)
          .setURL(urls.discordBotsGG)
          .setEmoji('🤖')
      );

    const row2 = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Vote on Discordbotlist')
          .setStyle(ButtonStyle.Link)
          .setURL(urls.discordBotList)
          .setEmoji('📋'),
        new ButtonBuilder()
          .setLabel('Invite GameVibe AI')
          .setStyle(ButtonStyle.Link)
          .setURL(botListingService.getInviteLink())
          .setEmoji('➕')
      );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2],
    });

    // Track command usage
    await prisma.analyticsEvent.create({
      data: {
        type: 'command_usage',
        userId: interaction.user.id,
        metadata: {
          command: 'vote',
          subcommand: 'links',
        },
      },
    });
  } catch (error) {
    logger.error('Error in vote links command:', error);
    await interaction.reply({
      content: 'An error occurred while fetching voting links.',
      ephemeral: true,
    });
  }
}

async function handleVoteStats(interaction: CommandInteraction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    
    // Get user's voting history
    const [voteCount, recentVotes, totalCreditsEarned] = await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          type: 'bot_vote',
          userId,
        },
      }),
      prisma.analyticsEvent.findMany({
        where: {
          type: 'bot_vote',
          userId,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.analyticsEvent.aggregate({
        where: {
          type: 'bot_vote',
          userId,
        },
        _sum: {
          metadata: {
            path: ['creditAmount'],
          },
        },
      }),
    ]);

    const embed = new EmbedBuilder()
      .setTitle('📊 Your Voting Statistics')
      .setDescription(`Thank you for supporting GameVibe AI!`)
      .setColor(0x00ff00)
      .addFields(
        {
          name: '🗳️ Total Votes',
          value: voteCount.toString(),
          inline: true,
        },
        {
          name: '💎 Credits Earned',
          value: (totalCreditsEarned._sum?.metadata || 0).toString(),
          inline: true,
        },
        {
          name: '🎯 Next Milestone',
          value: getNextMilestone(voteCount),
          inline: true,
        }
      )
      .setTimestamp();

    if (recentVotes.length > 0) {
      const recentVotesText = recentVotes
        .map(vote => {
          const site = (vote.metadata as any)?.site || 'Unknown';
          const credits = (vote.metadata as any)?.creditAmount || 0;
          const date = new Date(vote.createdAt).toLocaleDateString();
          return `• ${site}: +${credits} credits (${date})`;
        })
        .join('\n');

      embed.addFields({
        name: '📅 Recent Votes',
        value: recentVotesText || 'No recent votes',
        inline: false,
      });
    }

    // Add voting streak info if applicable
    const streak = await calculateVotingStreak(userId);
    if (streak > 0) {
      embed.addFields({
        name: '🔥 Voting Streak',
        value: `${streak} days${streak >= 7 ? ' (Bonus credits active!)' : ''}`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

    // Track command usage
    await prisma.analyticsEvent.create({
      data: {
        type: 'command_usage',
        userId,
        metadata: {
          command: 'vote',
          subcommand: 'stats',
        },
      },
    });
  } catch (error) {
    logger.error('Error in vote stats command:', error);
    await interaction.editReply({
      content: 'An error occurred while fetching your voting statistics.',
    });
  }
}

async function handleVoteReminder(interaction: CommandInteraction) {
  try {
    const userId = interaction.user.id;
    
    // Toggle reminder preference
    const user = await prisma.user.upsert({
      where: { discordId: userId },
      create: {
        discordId: userId,
        username: interaction.user.username,
        preferences: {
          voteReminders: true,
        },
      },
      update: {
        preferences: {
          ...((await prisma.user.findUnique({ 
            where: { discordId: userId } 
          }))?.preferences as any || {}),
          voteReminders: !((await prisma.user.findUnique({ 
            where: { discordId: userId } 
          }))?.preferences as any)?.voteReminders,
        },
      },
    });

    const remindersEnabled = (user.preferences as any)?.voteReminders || false;

    const embed = new EmbedBuilder()
      .setTitle('🔔 Vote Reminders')
      .setDescription(
        remindersEnabled
          ? '✅ **Vote reminders enabled!**\n\nYou\'ll receive a DM when you can vote again on each site.'
          : '❌ **Vote reminders disabled!**\n\nYou won\'t receive voting reminders anymore.'
      )
      .setColor(remindersEnabled ? 0x00ff00 : 0xff0000)
      .setFooter({ text: 'Reminders help you maximize your credit earnings!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Track command usage
    await prisma.analyticsEvent.create({
      data: {
        type: 'command_usage',
        userId,
        metadata: {
          command: 'vote',
          subcommand: 'remind',
          remindersEnabled,
        },
      },
    });
  } catch (error) {
    logger.error('Error in vote reminder command:', error);
    await interaction.reply({
      content: 'An error occurred while updating your reminder preferences.',
      ephemeral: true,
    });
  }
}

function getNextMilestone(currentVotes: number): string {
  const milestones = [1, 10, 50, 100];
  const nextMilestone = milestones.find(m => m > currentVotes);
  
  if (!nextMilestone) {
    return 'All milestones achieved! 🎉';
  }
  
  const remaining = nextMilestone - currentVotes;
  return `${nextMilestone} votes (${remaining} more needed)`;
}

async function calculateVotingStreak(userId: string): Promise<number> {
  const votes = await prisma.analyticsEvent.findMany({
    where: {
      type: 'bot_vote',
      userId,
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (votes.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < votes.length; i++) {
    const voteDate = new Date(votes[i].createdAt);
    voteDate.setHours(0, 0, 0, 0);
    
    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - streak);
    
    if (voteDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}