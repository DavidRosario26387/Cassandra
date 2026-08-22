export function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  try {
    localStorage.setItem("ce-theme", isDark ? "dark" : "light");
  } catch (e) {
    /* storage may be unavailable */
  }
  return isDark;
}

export function isDark() {
  return document.documentElement.classList.contains("dark");
}
