// const {connectdatabase} = require('../../config/connectDB');
// const sdk = require("node-appwrite");

const creators = require("../../Creators/creators");
let crushdb = require("../../Creators/crushdb");
let userdb = require("../../Creators/userdb");
const admindb = require("../../Creators/admindb");
const { pushmessage } = require("../../utiils/sendPushnot");

const createCreator = async (req, res) => {
  const hostid = req.body.hostid;
  const userid = req.body.userid;
  const username = req.body.username;
  console.log("Received request to fetch creator by portfolio ID:", { hostid, userid, username });
  let added = false;
  

  if (!hostid && !username) {
    return res.status(400).json({
      ok: false,
      message: "user Id invalid!!",
    });
  }

  //let data = await connectdatabase()

  try {
    //  let userdb = data.databar.listDocuments(data.dataid,data.creatorCol)
    //  let currentuser = (await userdb).documents.find(value=>{
    //   return value.$id === hostid
    //  })
  
let currentuser;

if (hostid) {
  currentuser = await creators.findOne({_id:hostid}).exec();
} 
else if (username) {
  const cleanUsername = String(username)
  .replace(/^@/, "")
  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const account = await userdb.findOne({
  $or: [
    { username: new RegExp("^@?" + cleanUsername + "$", "i") },
    { nickname: new RegExp("^@?" + cleanUsername + "$", "i") }
  ]
}).exec();


 

  if (!account) {
    return res.status(404).json({
      ok: false,
      message: "User not found in userdb"
    });
  }

currentuser = await creators.findOne({
  $or: [
    { userid:req.body.userid || account?.id },
    { userid: account._id.toString() }
  ]
}).exec();

  

  if (!currentuser) {
  return res.status(404).json({
    ok: false,
    message: "Creator profile not found"
  });
}
}
    // Check if the current user has this creator in their crush list
    let istrue = await crushdb
      .findOne({
        creator_portfolio_id: currentuser._id,
        userid: userid
      })
      .exec();

    if (userid && istrue) {
      added = true;
    }

    let modState = await userdb
      .findOne({
        _id: currentuser.userid,
      })
      .exec();

    const photolink = currentuser.creatorfiles
      .map((photolink) => {
        return photolink?.creatorfilelink;
      })
      .filter((link) => link && link.trim() !== ""); // Filter out null/undefined/empty links
    

    
    const isFollowingUser = modState.followers.includes(userid);

    let host = {
      hostid: currentuser._id,
      // photolink: currentuser.creatorfiles[0].creatorfilelink,
      photolink,
      creatorfiles: currentuser.creatorfiles, // Include full creatorfiles array
      verify: modState.creator_verified,
      name: currentuser.name,
      username: modState.username, // Include username from user data
      age: currentuser.age,
      location: currentuser.location,
      price: currentuser.price,
      duration: currentuser.duration,
      description: currentuser.description,
      gender: currentuser.gender,
      timeava: currentuser.timeava.join(" "),
      daysava: currentuser.daysava.join(" "),
      hosttype: currentuser.hosttype,
      userid: currentuser.userid,
      add: added,
      active: modState.active,
      followingUser: isFollowingUser,
      views: currentuser.views.length,
      createdAt: currentuser.createdAt,
      updatedAt: currentuser.updatedAt,
      // Include VIP status from user data
      isVip: modState.isVip || false,
      vipEndDate: modState.vipEndDate || null,
    };

 

    res.status(200).json({
      ok: true,
      message: `Creator Fetched successfully`,
      host,
    });
    
    // Track view and send notification if needed
    if (userid && !currentuser.views.includes(userid)) {
      currentuser.views.push(userid);
      await currentuser.save();
      
      // Check if notification should be sent
      const totalViews = currentuser.views.length;
      const lastNotificationView = currentuser.lastNotificationView || 0;
      
      let shouldNotify = false;
      let notificationTitle = "";
      let notificationMessage = "";
      let notificationEmoji = "";

      // Determine notification interval based on view count
      // Only send notifications at milestone views (not at 0)
      if (totalViews > 0) {
        if (totalViews < 100) {
          // Below 100 views: every 10 views (10, 20, 30, 40, 50, 60, 70, 80, 90)
          if (totalViews % 10 === 0 && totalViews > lastNotificationView) {
            shouldNotify = true;
            notificationTitle = "You're getting noticed!";
            notificationEmoji = "🎉";
            notificationMessage = `Your profile just hit ${totalViews} views - fans are starting to discover you 👀`;
          }
        } else if (totalViews >= 100 && totalViews < 1000) {
          // Between 100-999 views: every 20 views (100, 120, 140, 160, 180, 200, ...)
          if (totalViews % 20 === 0 && totalViews > lastNotificationView) {
            shouldNotify = true;
            notificationTitle = "Still growing!";
            notificationEmoji = "🔥";
            notificationMessage = `You've reached ${totalViews} total views - your visibility keeps climbing 🚀`;
          }
        } else if (totalViews >= 1000) {
          // 1000+ views: every 100 views (1000, 1100, 1200, 1300, ...)
          if (totalViews % 100 === 0 && totalViews > lastNotificationView) {
            shouldNotify = true;
            notificationTitle = "Creator on the rise!";
            notificationEmoji = "🌟";
            notificationMessage = `You just crossed ${totalViews} views. You're building real momentum - keep it up 💪`;
          }
        }
      }

      // Send notification if needed
      if (shouldNotify) {
        try {
          // Send push notification
          await pushmessage(
            currentuser.userid,
            `${notificationEmoji} ${notificationMessage}`,
            "/icons/m-logo.png",
            {
              title: notificationTitle,
              type: "view_milestone",
              url: `/creators/${currentuser._id}`
            }
          );

          // Save notification to database
          await admindb.create({
            userid: currentuser.userid,
            message: `${notificationEmoji} ${notificationMessage}`,
            title: notificationTitle,
            seen: false
          });

          // Update last notification view count
          currentuser.lastNotificationView = totalViews;
          await currentuser.save();
        } catch (notifError) {
          // Log error but don't fail the request
          console.error("Error sending view notification:", notifError);
        }
      }
    }
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`,
    });
  }
};


module.exports = createCreator;
