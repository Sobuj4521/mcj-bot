const { User } = require('../database/models');
const CaptchaGenerator = require('../utils/captcha');
const Keyboards = require('../utils/keyboards');
const Helpers = require('../utils/helpers');
const config = require('../config');
const TelegramCheck = require('../utils/telegramCheck');

class StartHandler {
  static async handleStart(ctx) {
    if (!ctx.from || !ctx.from.id) {
      console.error('❌ Invalid context in handleStart');
      return;
    }
    
    const userId = ctx.from.id;
    const referralCode = ctx.startPayload;
    
    try {
      let user = await User.findOne({ telegramId: userId });
      
      if (user && user.isBanned) {
        await ctx.reply('❌ Your account has been banned from using this bot.');
        return;
      }
      
      if (!user) {
        // New user registration with sanitized names
        const sanitizeName = (name) => {
          if (!name || typeof name !== 'string') return name;
          try {
            return name
              .normalize('NFKC')
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
              .replace(/[^\u0000-\uFFFF]/g, '')
              .replace(/[^\p{L}\p{N}\p{M}\p{P}\p{Z}\p{Emoji}]/gu, '')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 100);
          } catch (error) {
            return 'User';
          }
        };
        
        user = new User({
          telegramId: userId,
          username: sanitizeName(ctx.from.username),
          firstName: sanitizeName(ctx.from.first_name),
          lastName: sanitizeName(ctx.from.last_name)
        });
        
        // Handle referral
        if (referralCode) {
          const referrer = await User.findOne({ referralCode });
          if (referrer && referrer.telegramId !== userId) {
            user.referredBy = referrer._id;
            console.log(`📝 User ${userId} was referred by ${referrer.telegramId}, rewards pending profile completion`);
          }
        }
        
        await user.save();
        
        // Generate captcha
        const captcha = CaptchaGenerator.generate();
        ctx.session.captcha = captcha;
        ctx.session.awaitingCaptcha = true;
        
        const escapedQuestion = Helpers.escapeMarkdown(captcha.question);
        
        await ctx.reply(
          `🔒 *Welcome to Airdrop bot by MetacoderJack\\!*\n\n` +
          `To prevent spam, please solve this captcha:\n\n` +
          `*${escapedQuestion}*`,
          { parse_mode: 'MarkdownV2' }
        );
        
      } else {
        // Existing user
        user.lastActive = new Date();
        await user.save();
        
        const isProfileComplete = user.twitterProfile && user.telegramUsername && user.evmWallet;
        
        if (!isProfileComplete) {
          await StartHandler.showTasks(ctx);
        } else {
          await ctx.reply(
            `👋 Welcome back, ${ctx.from.first_name}!\n\n` +
            `Use the menu below to navigate:`,
            Keyboards.mainMenu()
          );
        }
      }
      
    } catch (error) {
      console.error('Start handler error:', error);
      if (ctx && ctx.reply) {
        await ctx.reply('❌ An error occurred. Please try again.');
      }
    }
  }
  
  static async handleCaptcha(ctx) {
    if (!ctx.session.awaitingCaptcha || !ctx.message || !ctx.message.text) return;
    
    const userAnswer = ctx.message.text;
    const expectedAnswer = ctx.session.captcha.answer;
    
    if (CaptchaGenerator.validate(userAnswer, expectedAnswer)) {
      ctx.session.awaitingCaptcha = false;
      delete ctx.session.captcha;
      
      await ctx.reply('✅ Captcha verified successfully!');
      await StartHandler.showTasks(ctx);
      
    } else {
      await ctx.reply('❌ Incorrect answer. Please try again:');
    }
  }
  
  static async showTasks(ctx) {
    if (!ctx.from || !ctx.from.id) {
      console.error('❌ Invalid context in showTasks');
      return;
    }
    
    const userId = ctx.from.id;
    const user = await User.findOne({ telegramId: userId });
    
    if (!user) {
      await ctx.reply('Please start with /start first.');
      return;
    }
    
    const isProfileComplete = user.twitterProfile && user.telegramUsername && user.evmWallet;
    
    if (isProfileComplete) {
      await ctx.reply(
        `✅ Your profile is already complete!\n\n` +
        `Use the menu below to manage your account:`,
        Keyboards.mainMenu()
      );
      return;
    }
    
    const tasks = Helpers.getTaskList();
    const taskList = tasks.map((task, index) => 
      `${index + 1}. ${task.name}`
    ).join('\n');
    
    await ctx.reply(
      `📋 *Complete these tasks to earn ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL} tokens:*\n\n` +
      `${taskList}\n\n` +
      `Click the buttons below to complete each task, then press "Continue" to verify.`,
      Keyboards.taskButtons()
    );
  }
  
  static async handleContinueTasks(ctx) {
    if (!ctx.from || !ctx.from.id) {
      console.error('❌ Invalid context in handleContinueTasks');
      return;
    }
    
    const userId = ctx.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        await ctx.answerCbQuery('User not found. Please start with /start');
        return;
      }
      
      if (user.twitterProfile && user.telegramUsername && user.evmWallet) {
        await ctx.editMessageText(
          `✅ All tasks completed!\n\n` +
          `Your profile is already set up. Use the main menu to manage your account.`,
          { 
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] }
          }
        );
        return;
      }
      
      const joinCheckResult = await TelegramCheck.verifyAllMemberships(ctx, userId);
      
      if (!joinCheckResult.allJoined) {
        // FIXED: Check if we actually need to modify the message
        try {
          const currentMessage = ctx.callbackQuery.message.text;
          const newMessage = TelegramCheck.getMembershipMessage(joinCheckResult);
          
          // Only edit if the message content has actually changed
          if (currentMessage !== newMessage) {
            await ctx.editMessageText(
              newMessage,
              { 
                parse_mode: 'Markdown',
                reply_markup: Keyboards.taskButtons().reply_markup 
              }
            );
          } else {
            // Message is the same, just answer the callback query
            await ctx.answerCbQuery('Please join the required channels first.');
          }
        } catch (editError) {
          // Handle "message not modified" error gracefully
          if (editError.message.includes('message is not modified')) {
            await ctx.answerCbQuery('Please join the required channels first.');
          } else {
            throw editError; // Re-throw other errors
          }
        }
        return;
      }
      
      ctx.session.setupStage = 'twitter';
      ctx.session.pendingProfile = {};
      
      await ctx.reply(
        `🎉 All tasks verified!\n\n` +
        `Now let's set up your profile. Please submit your Twitter profile link:`,
        { 
          parse_mode: 'Markdown'
        }
      );
      
      // FIXED: Silently ignore "message not found" errors
      try {
        await ctx.deleteMessage();
      } catch (error) {
        // Ignore "message not found" errors, they're harmless
        if (!error.message.includes('message to delete not found')) {
          console.log('Could not delete message:', error.message);
        }
      }
      
    } catch (error) {
      // FIXED: Handle "message not modified" error specifically
      if (error.message.includes('message is not modified')) {
        await ctx.answerCbQuery('Please join the required channels first.');
      } else {
        console.error('Continue tasks error:', error);
        await ctx.answerCbQuery('❌ Error verifying tasks. Please try again.');
      }
    }
  }
}

module.exports = StartHandler;
