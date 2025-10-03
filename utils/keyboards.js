const { Markup } = require('telegraf');
const Helpers = require('./helpers');

class Keyboards {
  static mainMenu() {
    return Markup.keyboard([
      ['💰 Balance', '👤 Profile'],
      ['📊 Referral', '🏆 Leaderboard']
    ]).resize();
  }
  
  static taskButtons() {
    const tasks = Helpers.getTaskList();
    const buttons = tasks.map(task => 
      [Markup.button.url(`✅ ${task.name}`, task.url)]
    );
    
    buttons.push([Markup.button.callback('🔄 Continue', 'continue_tasks')]);
    
    return Markup.inlineKeyboard(buttons);
  }
  
  static profileEditButtons() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✏️ Twitter', 'edit_twitter'),
        Markup.button.callback('✏️ Telegram', 'edit_telegram')
      ],
      [
        Markup.button.callback('✏️ Wallet', 'edit_wallet'),
        Markup.button.callback('📋 Main Menu', 'main_menu')
      ]
    ]);
  }
  
  static referralButtons(referralCode) {
    // Get bot username from context or use a fallback
    const botUsername = process.env.BOT_USERNAME || 'your_bot_username';
    const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;
    
    return Markup.inlineKeyboard([
  [
    Markup.button.url(
      '📤 Share Referral',
      `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20MetaCoderJackDemoBot%20Airdrop!`
    )
  ],
  [Markup.button.callback('📊 Referral Stats', 'referral_stats')]
]);
  }
  
  static backButton() {
    return Markup.keyboard(['⬅️ Back']).resize();
  }
  
  static emptyInlineKeyboard() {
    return Markup.inlineKeyboard([]);
  }
  
  // NEW: Add a proper inline keyboard version of main menu
  static mainMenuInline() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('💰 Balance', 'show_balance'),
        Markup.button.callback('👤 Profile', 'show_profile')
      ],
      [
        Markup.button.callback('📊 Referral', 'show_referral'),
        Markup.button.callback('🏆 Leaderboard', 'show_leaderboard')
      ]
    ]);
  }
}

module.exports = Keyboards;
