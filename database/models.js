const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    sparse: true
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  twitterProfile: {
    type: String,
    sparse: true,
    validate: {
      validator: function(v) {
        return !v || /https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]{1,15}/.test(v);
      },
      message: 'Invalid Twitter profile URL'
    }
  },
  telegramUsername: {
    type: String,
    sparse: true,
    validate: {
      validator: function(v) {
        return !v || /^@[a-zA-Z0-9_]{5,32}$/.test(v);
      },
      message: 'Invalid Telegram username'
    }
  },
  evmWallet: {
    type: String,
    sparse: true,
    validate: {
      validator: function(v) {
        return !v || /^0x[a-fA-F0-9]{40}$/.test(v);
      },
      message: 'Invalid EVM wallet address'
    }
  },
  balance: {
    type: Number,
    default: 0
  },
  tasksCompleted: {
    type: Map,
    of: Boolean,
    default: {}
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referrals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  referralCount: {
    type: Number,
    default: 0
  },
  referralRewardGiven: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  // Disable automatic index creation
  autoIndex: false
});

// Pre-save middleware to generate referral code and sanitize names
userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = 'MCJ' + Math.random().toString(36).substring(2, 10).toUpperCase();
  }
  
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
  
  if (this.firstName) this.firstName = sanitizeName(this.firstName);
  if (this.lastName) this.lastName = sanitizeName(this.lastName);
  if (this.username) this.username = sanitizeName(this.username);
  
  next();
});

// Define indexes with EXPLICIT names to avoid conflicts
userSchema.index({ telegramId: 1 }, { name: 'telegramId_unique' });
userSchema.index({ referralCode: 1 }, { name: 'referralCode_unique' });
userSchema.index({ referralCount: -1, balance: -1 }, { name: 'leaderboard_performance' });

module.exports = {
  User: mongoose.model('User', userSchema)
};
