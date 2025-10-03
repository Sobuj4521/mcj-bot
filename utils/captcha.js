const Helpers = require('./helpers');

class CaptchaGenerator {
  static generate() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-', '*'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let answer;
    switch (operator) {
      case '+':
        answer = num1 + num2;
        break;
      case '-':
        answer = num1 - num2;
        break;
      case '*':
        answer = num1 * num2;
        break;
    }
    
    // Create a safe question without Markdown issues
    const question = `${num1} ${operator} ${num2} = ?`;
    
    return {
      question: question,
      answer: answer.toString()
    };
  }
  
  static validate(input, expectedAnswer) {
    return input.trim() === expectedAnswer;
  }
}

module.exports = CaptchaGenerator;