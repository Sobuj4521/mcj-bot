const { User } = require('../database/models');

class ValidationMiddleware {
  static async validateUniqueFields(ctx, next) {
    const { twitterProfile, telegramUsername, evmWallet } = ctx.session.pendingProfile || {};
    
    if (twitterProfile) {
      const existingTwitter = await User.findOne({ twitterProfile });
      if (existingTwitter && existingTwitter.telegramId !== ctx.from.id) {
        await ctx.reply('❌ This Twitter profile is already registered with another account.');
        return;
      }
    }
    
    if (telegramUsername) {
      const existingTelegram = await User.findOne({ telegramUsername });
      if (existingTelegram && existingTelegram.telegramId !== ctx.from.id) {
        await ctx.reply('❌ This Telegram username is already registered with another account.');
        return;
      }
    }
    
    if (evmWallet) {
      const existingWallet = await User.findOne({ evmWallet });
      if (existingWallet && existingWallet.telegramId !== ctx.from.id) {
        await ctx.reply('❌ This EVM wallet is already registered with another account.');
        return;
      }
    }
    
    await next();
  }
  
  static validateTwitterUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const twitterRegex = /https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]{1,15}/;
    return twitterRegex.test(url.trim());
  }
  
  static validateTelegramUsername(username) {
    if (!username || typeof username !== 'string') return false;
    const telegramRegex = /^@[a-zA-Z0-9_]{5,32}$/;
    return telegramRegex.test(username.trim());
  }
  
  static validateEVMWallet(wallet) {
    if (!wallet || typeof wallet !== 'string') return false;
    const evmRegex = /^0x[a-fA-F0-9]{40}$/;
    return evmRegex.test(wallet.trim());
  }
  
  /**
   * Validate and sanitize text input for UTF-8 compatibility
   */
  static sanitizeText(text, maxLength = 100) {
    if (!text || typeof text !== 'string') return '';
    
    try {
      return text
        .normalize('NFKC')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/[^\u0000-\uFFFF]/g, '')
        .replace(/[^\p{L}\p{N}\p{M}\p{P}\p{Z}\p{Emoji}]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, maxLength);
    } catch (error) {
      console.error('Text sanitization error:', error);
      return '';
    }
  }
}

module.exports = ValidationMiddleware;
