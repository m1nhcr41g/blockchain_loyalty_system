// Lưu trữ dạng Map<token, expiresAtTimestampMs>
const blacklistedTokens = new Map();

// Thêm token vào danh sách thu hồi
const addToBlacklist = (token, expInSeconds) => {
    const expiresAt = expInSeconds ? expInSeconds * 1000 : Date.now() + 24 * 60 * 60 * 1000;
    blacklistedTokens.set(token, expiresAt);
};

// Kiểm tra token đã bị đăng xuất chưa
const isBlacklisted = (token) => {
    if (!blacklistedTokens.has(token)) {
        return false;
    }

    const expiresAt = blacklistedTokens.get(token);
    if (Date.now() > expiresAt) {
        blacklistedTokens.delete(token);
        return false;
    }

    return true;
};

// Định kỳ mỗi 1 tiếng tự động dọn dẹp các token đã hết hạn để tránh tốn RAM
setInterval(() => {
    const now = Date.now();
    for (const [token, expiresAt] of blacklistedTokens.entries()) {
        if (now > expiresAt) {
            blacklistedTokens.delete(token);
        }
    }
}, 60 * 60 * 1000).unref();

module.exports = {
    addToBlacklist,
    isBlacklisted
};