const userdb = require("../Creators/userdb");
const deviceIddb = require("../Creators/deviceIddb");

/**
 * Generate a unique 6-character referral code
 * @returns {Promise<string>} A unique referral code
 */
async function generateReferralCode() {
    let code;
    let isUnique = false;

    while (!isUnique) {
        // Generate a random 6-character code (alphanumeric, uppercase)
        code = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Check if code already exists
        const existing = await userdb.findOne({ referralCode: code }).exec();
        if (!existing) {
            isUnique = true;
        }
    }

    return code;
}

/**
 * Reward a user for a successful referral
 * @param {string} referrerId - User ID of the referrer
 * @param {number} rewardAmount - Amount to reward (default: 100 coins)
 * @returns {Promise<void>}
 */
async function rewardReferrer(referrerId, rewardAmount = 2) {
    try {
        const referrer = await userdb.findById(referrerId);
        if (!referrer) {
            console.error(`Referrer with ID ${referrerId} not found`);
            return;
        }

        // Increment reward balance
        referrer.rewardBalance = (referrer.rewardBalance || 0) + rewardAmount;

        // Increment referral count
        referrer.referralCount = (referrer.referralCount || 0) + 1;

        await referrer.save();

        console.log(`✅ Rewarded ${rewardAmount} coins to referrer ${referrerId}`);
    } catch (error) {
        console.error(`Error rewarding referrer ${referrerId}:`, error);
    }
}

module.exports = {
    generateReferralCode,
    rewardReferrer,
    checkHybridDeviceMatch,
    extractDeviceComponents,
};

/**
 * Extract device ID components from hybrid ID
 * Format: "persistentId::browserFingerprint" or just "browserFingerprint"
 * @param {string} hybridId 
 * @returns {{persistentId: string|null, browserFingerprint: string}}
 */
function extractDeviceComponents(hybridId) {
    if (!hybridId) return { persistentId: null, browserFingerprint: null };

    const parts = hybridId.split('::');

    if (parts.length === 2) {
        // Full hybrid ID
        return {
            persistentId: parts[0],
            browserFingerprint: parts[1]
        };
    } else {
        // Only browser fingerprint (fallback mode)
        return {
            persistentId: null,
            browserFingerprint: hybridId
        };
    }
}

// Levenshtein distance implementation
const getLevenshteinDistance = (a, b) => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

/**
 * Calculate similarity percentage between two strings
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Similarity from 0 to 1
 */
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const distance = getLevenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return (maxLength - distance) / maxLength;
}

/**
 * Enhanced hybrid device matching with multi-layer detection
 * This is the CORE anti-fraud function - similar to TikTok/Binance/PayPal
 * @param {string} deviceId - The hybrid device ID from the client
 * @returns {Promise<{isMatch: boolean, matchType: string, confidence: number}>}
 */
async function checkHybridDeviceMatch(deviceId) {
    if (!deviceId) {
        return { isMatch: false, matchType: 'none', confidence: 0 };
    }

    // Extract components from the new device ID
    const newDevice = extractDeviceComponents(deviceId);

  

    // Fetch all device IDs from the dedicated deviceIddb collection
    const deviceRecords = await deviceIddb
        .find({})
        .select('deviceId createdAt')
        .lean()
        .exec();

  
    for (const record of deviceRecords) {
        const existingDevice = extractDeviceComponents(record.deviceId);

        // LEVEL 1: Persistent ID Match (HIGHEST PRIORITY - Cross-browser detection)
        // This is the most reliable as it's stored in a file on the OS
        if (newDevice.persistentId && existingDevice.persistentId) {
            if (newDevice.persistentId === existingDevice.persistentId) {
                 return {
                    isMatch: true,
                    matchType: 'persistent_exact',
                    confidence: 1.0,
                    matchedDevice: record.deviceId
                };
            }

            // Fuzzy match on persistent ID (in case of minor corruption)
            const similarity = calculateSimilarity(newDevice.persistentId, existingDevice.persistentId);
            if (similarity >= 0.95) {
               return {
                    isMatch: true,
                    matchType: 'persistent_fuzzy',
                    confidence: similarity,
                    matchedDevice: record.deviceId
                };
            }
        }

        // LEVEL 2: Browser Fingerprint Match (Same browser detection)
        if (newDevice.browserFingerprint && existingDevice.browserFingerprint) {
            // Exact match
            if (newDevice.browserFingerprint === existingDevice.browserFingerprint) {
                console.warn(`[Anti-Fraud] 🚨 EXACT BROWSER FINGERPRINT MATCH`);
                return {
                    isMatch: true,
                    matchType: 'browser_exact',
                    confidence: 0.95,
                    matchedDevice: record.deviceId
                };
            }

            // Fuzzy match (allows for small variations in fingerprint)
            const similarity = calculateSimilarity(newDevice.browserFingerprint, existingDevice.browserFingerprint);

            // Log similarity for debugging
            if (similarity > 0.4) {
                console.log(`[Anti-Fraud] 🔍 Similarity check: ${(similarity * 100).toFixed(1)}%`);
            }

            if (similarity >= 0.60) {
                console.warn(`[Anti-Fraud] ⚠️ FUZZY BROWSER FINGERPRINT MATCH (${(similarity * 100).toFixed(1)}%)`);
                return {
                    isMatch: true,
                    matchType: 'browser_fuzzy',
                    confidence: similarity,
                    matchedDevice: record.deviceId
                };
            }
        }

        // LEVEL 3: Cross-component matching (persistent ID vs browser FP)
        // This catches attempts to use different browsers with cleared data
        if (newDevice.persistentId && existingDevice.browserFingerprint) {
            const similarity = calculateSimilarity(newDevice.persistentId, existingDevice.browserFingerprint);
            if (similarity >= 0.60) {
                console.warn(`[Anti-Fraud] ⚠️ CROSS-COMPONENT MATCH (${(similarity * 100).toFixed(1)}%)`);
                return {
                    isMatch: true,
                    matchType: 'cross_component',
                    confidence: similarity * 0.8,
                    matchedDevice: record.deviceId
                };
            }
        }
    }

    return { isMatch: false, matchType: 'none', confidence: 0 };
}

/**
 * Grant sign-up bonus to a new user
 * @param {string} userId 
 * @returns {Promise<void>}
 */
async function grantSignUpBonus(userId) {
    try {
        const user = await userdb.findById(userId);
        if (!user) return;

        // Grant bonus (e.g., 0.5 reward balance)
        user.rewardBalance = (user.rewardBalance || 0) + 0.5;
        await user.save();
        console.log(`✅ Sign-up bonus awarded to user ${userId}`);
    } catch (error) {
        console.error(`Error granting sign-up bonus to ${userId}:`, error);
    }
}
