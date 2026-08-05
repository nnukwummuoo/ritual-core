# ritual Analytics System

## Overview
A comprehensive analytics system for tracking and visualizing AI-generated story (ritual Rituals) performance metrics in the admin dashboard.

## Features Implemented

### Backend (API)

#### 1. Analytics Controller (`Controller/AnyaAnalyticsController.js`)
- **Endpoint**: `GET /api/ai-story/analytics?period={period}`
- **Period Options**: today, 7days, month, 3months, 6months, year, all

**Analytics Provided**:
- Total stories created
- Total views, likes, and comments
- Average views/likes/comments per story
- Engagement rate calculation: `(likes + comments) / views * 100`
- Peak engagement day identification
- Most liked, most viewed, and most commented stories
- Daily breakdown of all metrics
- Top 10 stories by likes, views, and comments

#### 2. Route (`routes/aiStoryRoutes.js`)
- Added `GET /api/ai-story/analytics` route
- Imports and uses `AnyaAnalyticsController`

### Frontend (Admin Dashboard)

#### 1. ritual Analytics Page (`src/app/mmeko/admin/ritual-analytics/page.tsx`)

**Summary Cards** (4 cards):
- Total Stories
- Total Views (with average per story)
- Total Likes (with average per story)
- Total Comments (with average per story)

**Additional Metrics** (3 cards):
- Engagement Rate percentage
- Peak Engagement Day (with total interactions)
- Most Viewed Story (with view count)

**Daily Engagement Chart**:
- Line chart showing Views, Likes, and Comments over time
- Uses Recharts library for visualization
- Responsive design with proper axes and tooltips
- Color-coded: Blue (Views), Pink (Likes), Teal (Comments)

**Top Stories Section** (Tabbed Interface):
- Tab 1: Top by Likes
- Tab 2: Top by Views
- Tab 3: Top by Comments

**Story Table Columns**:
- Rank (with medals for top 3: 🥇🥈🥉)
- Story Title
- Emotional Core (badged)
- Views (blue)
- Likes (pink)
- Comments (teal)
- Created Date

**Features**:
- Period selector (dropdown)
- Loading states with animations
- Error handling with retry button
- Responsive design (mobile & desktop)
- Back to Admin button
- Color-coded gradient cards
- Professional dark theme

#### 2. Admin Dashboard Integration (`src/app/mmeko/admin/page.tsx`)
- Added "ritual Analytics" navigation item
- Icon: IoSparkles (sparkles icon)
- Positioned after "Referral Analysis"
- Integrated into the same sidebar navigation system

## Data Flow

1. **User selects period** → Frontend makes GET request to `/api/ai-story/analytics?period={period}`
2. **Backend**:
   - Calculates date range based on period
   - Queries MongoDB for stories within that range
   - Processes and aggregates data:
     - Calculates totals and averages
     - Groups by day for daily metrics
     - Sorts stories by different metrics
     - Finds peak days and top stories
3. **Frontend receives response** → Displays in charts, cards, and tables

## Usage

### For Administrators:
1. Navigate to Admin Dashboard (`/mmeko/admin`)
2. Click on "ritual Analytics" in the sidebar
3. Select desired time period from dropdown
4. View comprehensive metrics and charts
5. Switch between top stories tabs (Likes/Views/Comments)

### Metrics Tracked:
- **Engagement**: How users interact (likes + comments)
- **Reach**: How many views stories get
- **Performance**: Which stories perform best
- **Trends**: Daily patterns and peak days
- **Growth**: Story creation trends over time

## Technical Details

### Technologies Used:
- **Backend**: Node.js, Express, MongoDB
- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Charts**: Recharts library
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios

### Security:
- Admin-only access (requires authentication)
- Token-based authorization
- Error handling for failed requests

### Performance:
- Efficient MongoDB queries with date filtering
- Client-side caching of analytics data
- Responsive charts that adapt to screen size
- Loading states for better UX

## Future Enhancements

Potential additions:
- Export analytics to CSV/PDF
- User demographics for story viewers
- Story completion rates (% who view all panels)
- Time-of-day analytics
- Emotional core popularity trends
- Story sharing analytics
- User retention metrics
- Push notification effectiveness

## Files Created/Modified

**Backend**:
- ✅ Created: `Controller/AnyaAnalyticsController.js`
- ✅ Modified: `routes/aiStoryRoutes.js`

**Frontend**:
- ✅ Created: `src/app/mmeko/admin/ritual-analytics/page.tsx`
- ✅ Modified: `src/app/mmeko/admin/page.tsx`

## API Response Example

```json
{
  "ok": true,
  "data": {
    "selectedPeriod": "7days",
    "summary": {
      "totalStories": 7,
      "totalViews": 1250,
      "totalLikes": 340,
      "totalComments": 89,
      "avgViewsPerStory": "178.57",
      "avgLikesPerStory": "48.57",
      "avgCommentsPerStory": "12.71",
      "engagementRate": "34.32",
      "peakEngagementDay": {
        "day": "Dec 28",
        "totalEngagement": 523
      },
      "mostLikedStory": {...},
      "mostViewedStory": {...},
      "mostCommentedStory": {...}
    },
    "dailyData": [...],
    "topStoriesByLikes": [...],
    "topStoriesByViews": [...],
    "topStoriesByComments": [...]
  }
}
```

## Success Criteria ✅

✅ Track daily visits to ritual page  
✅ 7-day historical data  
✅ Charts showing visitor trends  
✅ Like count tracking  
✅ Most liked story identification  
✅ Most viewed story identification  
✅ Comment count tracking  
✅ Comprehensive admin dashboard  
✅ Beautiful, responsive UI  
✅ Real-time data fetching  
✅ Period selection (today to all-time)  
✅ Professional charts and visualizations  

## Conclusion

The ritual Analytics system provides comprehensive insights into AI story performance, helping administrators understand user engagement, identify popular content, and make data-driven decisions for content strategy.
