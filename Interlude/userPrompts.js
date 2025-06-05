// userPrompts.js
let userPrompts = JSON.parse(localStorage.getItem("userPrompts")) || [];

export function addUserPrompt(prompt) {
  userPrompts.push(prompt);
  localStorage.setItem("userPrompts", JSON.stringify(userPrompts));
}

export function getUserPrompts() {
  return userPrompts;
}