const safeJsonParse = (value, fallback) => {
  try {
    if (value == null) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const session = {
  getToken() {
    return localStorage.getItem("token");
  },
  getRole() {
    return localStorage.getItem("role");
  },
  getEmail() {
    return localStorage.getItem("email");
  },
  clear() {
    localStorage.clear();
  },
};

export const preferencesStorage = {
  getInterests() {
    return safeJsonParse(localStorage.getItem("interests"), []);
  },
  setInterests(interests) {
    localStorage.setItem("interests", JSON.stringify(interests || []));
  },
  getFollowedOrganizers() {
    return safeJsonParse(localStorage.getItem("followed_organizers"), []);
  },
  setFollowedOrganizers(ids) {
    localStorage.setItem("followed_organizers", JSON.stringify(ids || []));
  },
};

export const uniqueStrings = (items) => {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const s = String(item || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
};
