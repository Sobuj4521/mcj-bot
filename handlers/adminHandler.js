const { User } = require('../database/models');
const config = require('../config');

class AdminHandler {
  static isAdmin(userId) {
    console.log('🔐 Checking admin access for:', userId, 'Expected Admin ID:', config.ADMIN_ID);
    return userId === config.ADMIN_ID;
  }
  
  static async handleAdminCommand(ctx) {
    const userId = ctx.from.id;
    
    console.log('🛠️ Admin command received from:', userId);
    
    if (!this.isAdmin(userId)) {
      console.log('❌ Access denied for user:', userId);
      await ctx.reply('❌ Access denied. Admin only.');
      return;
    }
    
    const args = ctx.message.text.split(' ');
    const command = args[1];
    
    console.log('📋 Admin command:', command, 'Args:', args);
    
    switch (command) {
      case 'stats':
        await this.showStats(ctx);
        break;
      case 'broadcast':
        await this.startBroadcast(ctx);
        break;
      case 'users':
        await this.showUserList(ctx);
        break;
      case 'ban':
        await this.handleBanCommand(ctx);
        break;
      case 'unban':
        await this.handleUnbanCommand(ctx);
        break;
      default:
        await this.showAdminPanel(ctx);
    }
  }
  
  static async showAdminPanel(ctx) {
    await ctx.reply(
      `🛠️ *Admin Panel*\n\n` +
      `Available commands:\n` +
      `/admin stats - Show bot statistics\n` +
      `/admin broadcast - Broadcast message to all users\n` +
      `/admin users - Show user list\n` +
      `/admin ban <userId> - Ban user\n` +
      `/admin unban <userId> - Unban user`,
      { parse_mode: 'Markdown' }
    );
  }
  
  static async showStats(ctx) {
    try {
      console.log('📊 Generating admin stats...');
      
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ 
        lastActive: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
      });
      const bannedUsers = await User.countDocuments({ isBanned: true });
      const totalBalance = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$balance' } } }
      ]);
      const totalReferrals = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$referralCount' } } }
      ]);
      
      const totalBalanceValue = totalBalance[0]?.total || 0;
      const totalReferralsValue = totalReferrals[0]?.total || 0;
      
      // Get users with completed profiles
      const completedProfiles = await User.countDocuments({
        twitterProfile: { $exists: true, $ne: null },
        telegramUsername: { $exists: true, $ne: null },
        evmWallet: { $exists: true, $ne: null }
      });
      
      const statsMessage = 
        `📊 *Bot Statistics*\n\n` +
        `👥 Total users: ${totalUsers}\n` +
        `✅ Active users (7d): ${activeUsers}\n` +
        `✅ Completed profiles: ${completedProfiles}\n` +
        `❌ Banned users: ${bannedUsers}\n` +
        `💰 Total ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL} distributed: ${totalBalanceValue}\n` +
        `📈 Total referrals: ${totalReferralsValue}`;
      
      console.log('📊 Stats generated:', statsMessage);
      await ctx.reply(statsMessage, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('❌ Admin stats error:', error);
      await ctx.reply('❌ Error loading statistics.');
    }
  }
  
  static async startBroadcast(ctx) {
    if (!this.isAdmin(ctx.from.id)) {
      await ctx.reply('❌ Access denied.');
      return;
    }
    
    ctx.session.awaitingBroadcast = true;
    await ctx.reply('📢 Please send the broadcast message:');
  }
  
  static async handleBroadcast(ctx) {
    if (!ctx.session.awaitingBroadcast || !this.isAdmin(ctx.from.id)) return;
    
    const message = ctx.message.text;
    ctx.session.awaitingBroadcast = false;
    
    await ctx.reply('🔄 Broadcasting message to all users...');
    
    try {
      const users = await User.find({ isBanned: false });
      let successCount = 0;
      let failCount = 0;
      
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegramId, 
            `📢 *Announcement*\n\n${message}`,
            { parse_mode: 'Markdown' }
          );
          successCount++;
          
          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to send to user ${user.telegramId}:`, error.message);
          failCount++;
        }
      }
      
      await ctx.reply(
        `✅ Broadcast completed!\n\n` +
        `Successful: ${successCount}\n` +
        `Failed: ${failCount}`
      );
      
    } catch (error) {
      console.error('Broadcast error:', error);
      await ctx.reply('❌ Error during broadcast.');
    }
  }
  
  static async showUserList(ctx) {
    if (!this.isAdmin(ctx.from.id)) {
      await ctx.reply('❌ Access denied.');
      return;
    }
    
    try {
      const users = await User.find().sort({ createdAt: -1 }).limit(10);
      
      let userList = `👥 *Last 10 Users*\n\n`;
      
      if (users.length === 0) {
        userList += `No users found.`;
      } else {
        users.forEach((user, index) => {
          const profileComplete = user.twitterProfile && user.telegramUsername && user.evmWallet;
          userList += `${index + 1}. ${user.firstName || 'Unknown'} (ID: ${user.telegramId})\n`;
          userList += `   Balance: ${user.balance} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL}\n`;
          userList += `   Referrals: ${user.referralCount}\n`;
          userList += `   Profile: ${profileComplete ? '✅ Complete' : '❌ Incomplete'}\n`;
          userList += `   Joined: ${user.createdAt.toLocaleDateString()}\n\n`;
        });
      }
      
      await ctx.reply(userList, { parse_mode: 'Markdown' });
      
    } catch (error) {
      console.error('User list error:', error);
      await ctx.reply('❌ Error loading user list.');
    }
  }
  
  static async handleBanCommand(ctx) {
    if (!this.isAdmin(ctx.from.id)) {
      await ctx.reply('❌ Access denied.');
      return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
      await ctx.reply('Usage: /admin ban <telegramId>');
      return;
    }
    
    const telegramId = parseInt(args[2]);
    
    try {
      const user = await User.findOne({ telegramId });
      if (!user) {
        await ctx.reply('❌ User not found.');
        return;
      }
      
      user.isBanned = true;
      await user.save();
      
      await ctx.reply(`✅ User ${telegramId} has been banned.`);
      
    } catch (error) {
      console.error('Ban error:', error);
      await ctx.reply('❌ Error banning user.');
    }
  }
  
  static async handleUnbanCommand(ctx) {
    if (!this.isAdmin(ctx.from.id)) {
      await ctx.reply('❌ Access denied.');
      return;
    }
    
    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
      await ctx.reply('Usage: /admin unban <telegramId>');
      return;
    }
    
    const telegramId = parseInt(args[2]);
    
    try {
      const user = await User.findOne({ telegramId });
      if (!user) {
        await ctx.reply('❌ User not found.');
        return;
      }
      
      user.isBanned = false;
      await user.save();
      
      await ctx.reply(`✅ User ${telegramId} has been unbanned.`);
      
    } catch (error) {
      console.error('Unban error:', error);
      await ctx.reply('❌ Error unbanning user.');
    }
  }
}

module.exports = AdminHandler;