const express = require('express');
const router = express.Router();
const { trackWebsiteVisitor, updateVisitorTimeSpent, trackPageView } = require('../../utiils/trackUserActivity');
const { getIpAndLocation } = require('../../utiils/getIpAndLocation');

// GET /api/track-visitor (test route to verify route is accessible)
router.get('/track-visitor', (req, res) => {
  return res.status(200).json({ ok: true, message: 'Track visitor route is accessible' });
});

// POST /api/track-visitor
router.post('/track-visitor', async (req, res) => {
  try {
    const { visitorId, userid, sessionId, device, visitTime } = req.body;
    
    if (!visitorId) {
      return res.status(400).json({ ok: false, message: 'Visitor ID is required' });
    }

    // Get IP and location from request
    const { ipAddress, location } = await getIpAndLocation(req);

    await trackWebsiteVisitor({
      visitorId,
      userid: userid || null,
      sessionId: sessionId || null,
      device: device || {},
      visitTime: visitTime ? new Date(visitTime) : new Date(),
      ipAddress,
      location,
    });

    return res.status(200).json({ ok: true, message: 'Visitor tracked successfully' });
  } catch (error) {
    console.error('❌ [API] Error tracking visitor:', error);
    return res.status(500).json({ ok: false, message: 'Failed to track visitor', error: error.message });
  }
});

// POST /api/update-visitor-time
router.post('/update-visitor-time', async (req, res) => {
  try {
    const { visitorId, timeSpent } = req.body;
    
    if (!visitorId || !timeSpent) {
      return res.status(400).json({ ok: false, message: 'Visitor ID and time spent are required' });
    }

    await updateVisitorTimeSpent(visitorId, timeSpent);

    return res.status(200).json({ ok: true, message: 'Visitor time updated successfully' });
  } catch (error) {
    console.error('Error updating visitor time:', error);
    return res.status(500).json({ ok: false, message: 'Failed to update visitor time', error: error.message });
  }
});

// POST /api/track-pageview
router.post('/track-pageview', async (req, res) => {
  try {
    const { visitorId, userid, path } = req.body;

    if (!visitorId || !path) {
      return res.status(400).json({ ok: false, message: 'Visitor ID and path are required' });
    }

    await trackPageView(visitorId, userid || null, path);

    return res.status(200).json({ ok: true, message: 'Page view tracked successfully' });
  } catch (error) {
    console.error('❌ [API] Error tracking page view:', error);
    return res.status(500).json({ ok: false, message: 'Failed to track page view' });
  }
});

module.exports = router;

