const PREDEFINED_TAGS = [
  'Adventure', 'Funny', 'Scary', 'Animals', 'Friendship',
  'Family', 'School', 'Fantasy', 'Magic', 'Mystery',
  'Nature', 'Science', 'History', 'Sports', 'Biography',
  'Comics', 'Fairytale', 'Superhero', 'Outer Space', 'Robots'
];

/**
 * Sanitizes a tag string:
 * - Removes non-letters (keeps spaces?) -> User said "only letters".
 * - "first always capitalized".
 * - We will interpret "only letters" as A-Za-z. Maybe spaces? Valid tags usually act as single tokens.
 *   User example: "Outer Space" is 2 words. "Wild Robot" is 2 words.
 *   Let's assume "letters and spaces" is safer, or maybe "letters only" means "No numbers/symbols".
 *   Let's go with: Remove anything that's not a letter or space. Trim. Title Case.
 */
function sanitizeTag(tag) {
  if (!tag) return '';

  // Remove non-letters/non-spaces
  let clean = tag.replace(/[^a-zA-Z\s]/g, '');

  // Trim and collapse whitespace
  clean = clean.trim().replace(/\s+/g, ' ');

  if (!clean) return '';

  // Title Case (capitalize first letter of each word? or just first letter of string?)
  // User said: "first always capitalized". Could mean "Sentence case" or "Title Case".
  // Given "The Wild Robot" => Title Case is standard for tags.
  // Let's do Title Case for now.
  return clean.split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

module.exports = {
  PREDEFINED_TAGS,
  sanitizeTag
};
