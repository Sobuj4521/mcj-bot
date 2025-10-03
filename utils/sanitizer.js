/**
 * Comprehensive text sanitizer for UTF-8 safety
 */
class Sanitizer {
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
      console.error('Sanitization error:', error, 'Original text:', text);
      return 'User';
    }
  }

  static ensureUTF8(text) {
    try {
      if (typeof text !== 'string') return '';
      return Buffer.from(text, 'utf8').toString('utf8');
    } catch (error) {
      console.error('UTF-8 encoding error:', error);
      return 'Text encoding issue';
    }
  }

  static isValidUTF8(text) {
    try {
      if (typeof text !== 'string') return false;
      Buffer.from(text, 'utf8');
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = Sanitizer;
