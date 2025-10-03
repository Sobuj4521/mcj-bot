const config = require('../config');

class Helpers {
  static formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
  }
  
  static generateReferralCode() {
    return 'MCJ' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }
  
  static escapeMarkdown(text) {
    return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  }
  
  static getTaskList() {
    const urls = config.TASK_URLS;
    
    // Convert Telegram usernames to proper URLs
    const telegramChannelUrl = urls.TELEGRAM_CHANNEL.startsWith('@') 
      ? `https://t.me/${urls.TELEGRAM_CHANNEL.substring(1)}`
      : urls.TELEGRAM_CHANNEL;
      
    const telegramGroupUrl = urls.TELEGRAM_GROUP.startsWith('@')
      ? `https://t.me/${urls.TELEGRAM_GROUP.substring(1)}`
      : urls.TELEGRAM_GROUP;
    
    return [
      {
        name: 'Join Telegram Channel',
        url: telegramChannelUrl,
        key: 'telegram_channel'
      },
      {
        name: 'Join Telegram Group',
        url: telegramGroupUrl,
        key: 'telegram_group'
      },
      {
        name: 'Follow Twitter',
        url: urls.TWITTER_PROFILE,
        key: 'twitter_follow'
      },
      {
        name: 'Retweet Post',
        url: urls.RETWEET_LINK,
        key: 'retweet'
      },
      {
        name: 'Like Tweet Post',
        url: urls.TWEET_POST,
        key: 'tweet_like'
      }
    ];
  }
  
  // Extract username for membership checking (without @ symbol)
  static extractTelegramUsername(url) {
    if (url.startsWith('@')) {
      return url.substring(1);
    }
    if (url.includes('t.me/')) {
      return url.split('t.me/')[1].replace('/', '');
    }
    return url;
  }
}

module.exports = Helpers;