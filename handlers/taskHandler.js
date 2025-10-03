const { User } = require('../database/models');
const Keyboards = require('../utils/keyboards');
const Helpers = require('../utils/helpers');
const config = require('../config');

class TaskHandler {
  static async showTasks(ctx) {
    const userId = ctx.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        await ctx.reply('Please start with /start first.');
        return;
      }
      
      const tasks = Helpers.getTaskList();
      const taskList = tasks.map((task, index) => 
        `${index + 1}. ${task.name}`
      ).join('\n');
      
      await ctx.reply(
        `📋 *Available Tasks*\n\n` +
        `${taskList}\n\n` +
        `Complete tasks to earn ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL} tokens!`,
        Keyboards.taskButtons()
      );
      
    } catch (error) {
      console.error('Task handler error:', error);
      await ctx.reply('❌ Error loading tasks.');
    }
  }
  
  static async checkTaskCompletion(ctx) {
    const userId = ctx.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId });
      
      if (!user) {
        await ctx.reply('Please start with /start first.');
        return;
      }
      
      const tasks = Helpers.getTaskList();
      let completedCount = 0;
      let taskStatus = '';
      
      tasks.forEach(task => {
        const isCompleted = user.tasksCompleted.get(task.key) || false;
        if (isCompleted) completedCount++;
        taskStatus += `${isCompleted ? '✅' : '❌'} ${task.name}\n`;
      });
      
      await ctx.reply(
        `📊 *Task Progress*\n\n` +
        `${taskStatus}\n` +
        `Completed: ${completedCount}/${tasks.length}\n` +
        `Reward per task: ${config.BOT_CONFIG.TASK_REWARD} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL}`
      );
      
    } catch (error) {
      console.error('Task completion check error:', error);
      await ctx.reply('❌ Error checking task progress.');
    }
  }
}

module.exports = TaskHandler;