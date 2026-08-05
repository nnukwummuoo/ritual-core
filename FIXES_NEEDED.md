# 🔧 FIXES NEEDED

## Issue 1: Krea API 404 Error

**Problem:** The Krea API is returning 404 because the model name is wrong.

**Fix:** In `mmekoapi/Controller/AiStoryController.js` line 181, change:
```javascript
model: "krea-1.0",
```
to:
```javascript
model: "krea-1",
```

## Issue 2: 500 Error on Story Generation

**Cause:** Gemini might be having issues or the response format changed.

**Check:** Look at the backend terminal for the actual error message when you click "Generate Stories"

## Issue 3: Only One Scene Showing

**Problem:** Old stories in database only have 1 panel.

**Solution:**
1. Click "Delete All" button on `/ritual` page
2. Click "Generate Stories" button
3. Wait 15-20 seconds
4. Refresh the page
5. Click any story - you should now see 20 panels

## Issue 4: Scroll-Based Story Viewer

You want the story viewer to:
- Show scenes on scroll
- Use full height
- Animate on scroll

I'll create this next!

## Current Status:
- ✅ 20 panels per story configured
- ✅ Krea AI code ready (just needs model name fix)
- ✅ Storj upload ready
- ⏳ Need to fix model name (line 181)
- ⏳ Need to delete old stories
- ⏳ Need to create scroll-based viewer
