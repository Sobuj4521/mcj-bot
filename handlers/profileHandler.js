const { User } = require('../database/models');
const ValidationMiddleware = require('../middleware/validation');
const Keyboards = require('../utils/keyboards');
const Helpers = require('../utils/helpers');
const config = require('../config');

class ProfileHandler {
  static async handleProfileSetup(ctx) {
    if (!ctx.session.setupStage || !ctx.message || !ctx.message.text) return;
    
    const userId = ctx.from.id;
    const userInput = ctx.message.text;
    
    try {
      switch (ctx.session.setupStage) {
        case 'twitter':
          if (!ValidationMiddleware.validateTwitterUrl(userInput)) {
            await ctx.reply('❌ Invalid Twitter profile URL. Please provide a valid Twitter/X profile link:');
            return;
          }
          
          ctx.session.pendingProfile.twitterProfile = userInput;
          ctx.session.setupStage = 'telegram';
          
          await ctx.reply(
            '✅ Twitter profile saved!\n\n' +
            'Now please submit your Telegram username (e.g., @username):'
          );
          break;
          
        case 'telegram':
          if (!ValidationMiddleware.validateTelegramUsername(userInput)) {
            await ctx.reply('❌ Invalid Telegram username. Please provide in format @username:');
            return;
          }
          
          ctx.session.pendingProfile.telegramUsername = userInput;
          ctx.session.setupStage = 'wallet';
          
          await ctx.reply(
            '✅ Telegram username saved!\n\n' +
            'Now please submit your EVM wallet address (e.g., 0x...):'
          );
          break;
          
        case 'wallet':
          if (!ValidationMiddleware.validateEVMWallet(userInput)) {
            await ctx.reply('❌ Invalid EVM wallet address. Please provide a valid address:');
            return;
          }
          
          ctx.session.pendingProfile.evmWallet = userInput;
          
          await ValidationMiddleware.validateUniqueFields(ctx, async () => {
            await this.saveProfile(ctx);
          });
          break;
      }
    } catch (error) {
      console.error('Profile setup error:', error);
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }
  
  static async saveProfile(ctx) {
    if (!ctx.from || !ctx.from.id) {
      console.error('❌ Invalid context in saveProfile');
      return;
    }
    
    const userId = ctx.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        await ctx.reply('User not found. Please start with /start');
        return;
      }
      
      Object.assign(user, ctx.session.pendingProfile);
      
      const tasks = Helpers.getTaskList();
      let totalReward = 0;
      
      tasks.forEach(task => {
        if (!user.tasksCompleted.get(task.key)) {
          user.tasksCompleted.set(task.key, true);
          totalReward += config.BOT_CONFIG.TASK_REWARD;
        }
      });
      
      user.balance += totalReward;
      
      let referralRewardGiven = false;
      if (user.referredBy && !user.referralRewardGiven) {
        const referrer = await User.findById(user.referredBy);
        if (referrer) {
          referrer.balance += config.BOT_CONFIG.REFERRAL_REWARD;
          referrer.referralCount += 1;
          user.referralRewardGiven = true;
          await referrer.save();
          referralRewardGiven = true;
          console.log(`🎉 Referral reward given: ${config.BOT_CONFIG.REFERRAL_REWARD} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL} to ${referrer.telegramId} for referring ${user.telegramId}`);
        }
      }
      
      await user.save();
      
      delete ctx.session.setupStage;
      delete ctx.session.pendingProfile;
      
      let successMessage = `🎉 *Profile Setup Complete!*\n\n` +
        `✅ Twitter: ${user.twitterProfile}\n` +
        `✅ Telegram: ${user.telegramUsername}\n` +
        `✅ Wallet: ${user.evmWallet}\n\n` +
        `💰 You earned ${totalReward} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL} tokens from tasks!`;
      
      if (referralRewardGiven) {
        successMessage += `\n\n👥 Thank you for joining through referral! Your referrer earned ${config.BOT_CONFIG.REFERRAL_REWARD} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL}!`;
      }
      
      successMessage += `\n\nUse the menu below to manage your account:`;
      
      await ctx.reply(
        successMessage,
        Keyboards.mainMenu()
      );
      
    } catch (error) {
      console.error('Save profile error:', error);
      
      if (error.code === 11000) {
        await ctx.reply('❌ This information is already registered with another account. Please use different details.');
      } else {
        await ctx.reply('❌ Error saving profile. Please try again.');
      }
    }
  }
  
  static async showProfile(ctx) {
    if (!ctx.from || !ctx.from.id) {
      console.error('❌ Invalid context in showProfile');
      return;
    }
    
    const userId = ctx.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        await ctx.reply('Please start with /start first.');
        return;
      }
      
      let profileText = `👤 *Your Profile*\n\n`;
      
      if (user.twitterProfile) {
        profileText += `🐦 Twitter: ${user.twitterProfile}\n`;
      } else {
        profileText += `🐦 Twitter: Not set\n`;
      }
      
      if (user.telegramUsername) {
        profileText += `📱 Telegram: ${user.telegramUsername}\n`;
      } else {
        profileText += `📱 Telegram: Not set\n`;
      }
      
      if (user.evmWallet) {
        profileText += `💰 Wallet: ${user.evmWallet}\n`;
      } else {
        profileText += `💰 Wallet: Not set\n`;
      }
      
      profileText += `\n📊 Statistics:\n`;
      profileText += `Balance: ${user.balance} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL}\n`;
      profileText += `Referrals: ${user.referralCount}\n`;
      profileText += `Joined: ${user.createdAt.toLocaleDateString()}\n`;
      
      await ctx.reply(
        profileText,
        { 
          parse_mode: 'Markdown',
          reply_markup: Keyboards.profileEditButtons().reply_markup 
        }
      );
      
    } catch (error) {
      console.error('Show profile error:', error);
      await ctx.reply('❌ Error loading profile.');
    }
  }
  
  static async handleEditProfile(ctx, field) {
    if (!ctx.from || !ctx.from.id) {
      console.error('❌ Invalid context in handleEditProfile');
      return;
    }
    
    const userId = ctx.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        await ctx.answerCbQuery('User not found');
        return;
      }
      
      ctx.session.editingField = field;
      
      const fieldNames = {
        twitter: 'Twitter profile link',
        telegram: 'Telegram username (@username)',
        wallet: 'EVM wallet address'
      };
      
      await ctx.reply(
        `✏️ Editing ${fieldNames[field]}\n\n` +
        `Please send the new value:`,
        { reply_markup: { remove_keyboard: true } }
      );
      
      await ctx.answerCbQuery();
      
    } catch (error) {
      console.error('Edit profile error:', error);
      await ctx.answerCbQuery('❌ Error starting edit');
    }
  }
  
  static async handleEditInput(ctx) {
    if (!ctx.session.editingField || !ctx.message || !ctx.message.text) return;
    
    const field = ctx.session.editingField;
    const userInput = ctx.message.text;
    const userId = ctx.from.id;
    
    try {
      let isValid = true;
      let fieldKey = '';
      
      switch (field) {
        case 'twitter':
          isValid = ValidationMiddleware.validateTwitterUrl(userInput);
          fieldKey = 'twitterProfile';
          break;
        case 'telegram':
          isValid = ValidationMiddleware.validateTelegramUsername(userInput);
          fieldKey = 'telegramUsername';
          break;
        case 'wallet':
          isValid = ValidationMiddleware.validateEVMWallet(userInput);
          fieldKey = 'evmWallet';
          break;
      }
      
      if (!isValid) {
        await ctx.reply(`❌ Invalid ${field} format. Please try again:`);
        return;
      }
      
      const updateData = { [fieldKey]: userInput };
      const existingUser = await User.findOne(updateData);
      
      if (existingUser && existingUser.telegramId !== userId) {
        await ctx.reply(`❌ This ${field} is already registered with another account.`);
        delete ctx.session.editingField;
        return;
      }
      
      const user = await User.findOne({ telegramId: userId });
      user[fieldKey] = userInput;
      await user.save();
      
      delete ctx.session.editingField;
      
      await ctx.reply(
        `✅ ${field.charAt(0).toUpperCase() + field.slice(1)} updated successfully!`,
        Keyboards.mainMenu()
      );
      
    } catch (error) {
      console.error('Edit profile error:', error);
      
      if (error.code === 11000) {
        await ctx.reply('❌ This information is already registered with another account.');
      } else {
        await ctx.reply('❌ Error updating profile.');
      }
      
      delete ctx.session.editingField;
    }
  }
}

module.exports = ProfileHandler;
