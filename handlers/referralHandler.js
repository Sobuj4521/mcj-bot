const { User } = require('../database/models');
const Keyboards = require('../utils/keyboards');
const Helpers = require('../utils/helpers');
const config = require('../config');

class ReferralHandler {
  static async showReferralInfo(ctx) {
    const userId = ctx.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        await ctx.reply('Please start with /start first.');
        return;
      }
      
      const referralLink = `https://t.me/${ctx.botInfo.username}?start=${user.referralCode}`;
      const totalEarnings = user.referralCount * config.BOT_CONFIG.REFERRAL_REWARD;
      
      await ctx.reply(
        `📊 *Referral Program*\n\n` +
        `Invite friends and earn ${config.BOT_CONFIG.REFERRAL_REWARD} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL} for each referral!\n\n` +
        `🔗 Your referral link:\n\`${referralLink}\`\n\n` +
        `📈 Your referral stats:\n` +
        `• Total referrals: ${user.referralCount}\n` +
        `• Total Ref Bonus: ${totalEarnings} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL}\n\n` +
        `Share your link and to climb the leaderboard!`,
        {
          parse_mode: 'Markdown',
          ...Keyboards.referralButtons(user.referralCode)
        }
      );
      
    } catch (error) {
      console.error('Referral info error:', error);
      await ctx.reply('❌ Error loading referral information.');
    }
  }
  
  static async showLeaderboard(ctx) {
    try {
      console.log('🏆 Loading leaderboard...');
      
      const topReferrers = await User.find({ 
        referralCount: { $gte: config.BOT_CONFIG.MIN_REFERRALS_FOR_LEADERBOARD } 
      })
      .sort({ referralCount: -1, balance: -1 })
      .limit(50)
      .select('firstName username referralCount balance')
      .lean();
      
      let leaderboardText = `🏆 Top Referrers\n\n`;
      
      if (!topReferrers || topReferrers.length === 0) {
        leaderboardText += `No referrals yet. Be the first to refer friends!\n\n`;
      } else {
        const displayCount = Math.min(topReferrers.length, 50);
        
        for (let i = 0; i < displayCount; i++) {
          const user = topReferrers[i];
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🔸';
          
          // ULTRA-SAFE NAME CLEANING
          let name = this.sanitizeUserName(user.firstName || user.username || 'Anonymous');
          
          // Truncate long names
          const displayName = name.length > 20 ? name.substring(0, 20) + '...' : name;
          
          leaderboardText += `${medal} ${displayName}: ${user.referralCount} ref (${user.balance} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL})\n`;
          
          if (leaderboardText.length > 3000) {
            leaderboardText += `\n... and more (showing top ${i + 1})`;
            break;
          }
        }
      }
      
      leaderboardText += `\n💡 Refer friends to climb the leaderboard!`;
      leaderboardText += `\n🎁 The Top 50 Referral Will Share $3,500 USDC!`;

      // ULTRA-SAFE UTF-8 ENCODING
      const safeText = this.ensureUTF8(leaderboardText);
      
      if (safeText.length > 4096) {
        const firstPart = this.ensureUTF8(safeText.substring(0, 4090)) + '...';
        await ctx.reply(firstPart, { parse_mode: 'HTML' });
      } else {
        await ctx.reply(safeText, { parse_mode: 'HTML' });
      }
      
      console.log('✅ Leaderboard loaded successfully');
      
    } catch (error) {
      console.error('❌ Leaderboard error:', error);
      await this.sendSafeFallback(ctx, '🏆 Leaderboard is currently being updated. Please try again in a moment.');
    }
  }

  /**
   * Ultra-safe UTF-8 sanitization for user names
   */
  static sanitizeUserName(name) {
    if (typeof name !== 'string') return 'Anonymous';
    
    try {
      return name
        .normalize('NFKC')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/[^\u0000-\uFFFF]/g, '')
        .replace(/[^\p{L}\p{N}\p{M}\p{P}\p{Z}\p{Emoji}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100) || 'Anonymous';
    } catch (error) {
      console.error('Name sanitization error:', error);
      return 'Anonymous';
    }
  }

  /**
   * Ensure text is properly UTF-8 encoded
   */
  static ensureUTF8(text) {
    try {
      if (typeof text !== 'string') {
        return 'Text encoding issue - please try again.';
      }
      
      const buffer = Buffer.from(text, 'utf8');
      const utf8Text = buffer.toString('utf8');
      
      return utf8Text;
    } catch (error) {
      console.error('UTF-8 encoding error:', error);
      return 'Leaderboard data is being updated.';
    }
  }

  /**
   * Safe fallback message sender
   */
  static async sendSafeFallback(ctx, message) {
    try {
      const safeMessage = this.ensureUTF8(message);
      await ctx.reply(safeMessage);
    } catch (error) {
      console.error('Fallback also failed:', error);
      try {
        await ctx.reply('Please try again later.');
      } catch (finalError) {
        console.error('All messaging failed:', finalError);
      }
    }
  }
}

module.exports = ReferralHandler;
