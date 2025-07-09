const escapeHtml = (text) => {
  const map = {
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&#39;",
    '"': "&quot;",
    "/": "&#47;",
    ";": "&#59;",
  };
  return text
    ? text.replace(/[<>&'"/]/g, (char) => map[char])
    : null;
};

const formatDate = (date, removeLast = false) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Adding 1 to month since it's zero-based
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return removeLast
    ? `${year}-${month}-${day}`
    : `${year}-${month}-${day} ${hours}:${minutes}`;
};
const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

exports.escapeHtml = escapeHtml;
exports.formatDate = formatDate;
exports.slugify = slugify