const FIELD_MAP = {
  firstname: 'first_name',
  lastname: 'last_name',
  phone: 'phone',
  email: 'email',
};

// Replaces {{firstName}}, {{lastName}}, {{phone}}, {{email}} with contact data.
// Unknown/missing fields resolve to an empty string rather than leaving the placeholder.
function renderTemplate(message, contact = {}) {
  if (!message) return message;
  return message.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, key) => {
    const column = FIELD_MAP[key.toLowerCase()];
    if (!column) return match;
    return contact[column] || '';
  });
}

module.exports = { renderTemplate };
