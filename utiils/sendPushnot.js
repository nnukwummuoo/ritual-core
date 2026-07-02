let userdb = require("../Creators/userdb");
let webpush = require("web-push");
let vapikey = require("./webpushKeys");
let pushdb = require("../Creators/pushnotifydb");

const pushmessage = async (userid, message, icon, options = {}) => {
  let online = await userdb.findOne({ _id: userid }).exec();
  let subinfo = await pushdb.findOne({ userid: userid }).exec();


  if (online) {
    let datasend = JSON.stringify({
      message: message,
      userid: userid,
      icon: icon,
      title: options.title || "MmeKo",
      url: options.url || "/",
      type: options.type || "notification",
      ...options
    });
    

   let pushOptions = {
  TTL: 604800, // 7 days instead of 172800 (2 days)
  urgency: "high",
};

    webpush.setVapidDetails(
      "mailto:noreply.mmeko@gmail.com",
      vapikey.PublicKey,
      vapikey.PrivateKey
    );

    if (subinfo && subinfo.subinfo) {
      try {
        let subscription;
        
        // Handle both string and object formats
        if (typeof subinfo.subinfo === 'string') {
          subscription = JSON.parse(subinfo.subinfo);
        } else if (typeof subinfo.subinfo === 'object') {
          subscription = subinfo.subinfo;
        } else {
          console.error("Invalid subscription data type for user:", userid);
          await pushdb.deleteOne({ userid: userid }).exec();
          return;
        }
        
        // Validate subscription data
        if (!subscription || !subscription.endpoint) {
          console.error("Invalid subscription data for user:", userid);
          await pushdb.deleteOne({ userid: userid }).exec();
          return;
        }
        
        
        await webpush.sendNotification(subscription, datasend, pushOptions);
      } catch (err) {
        console.error("Error sending push notification:", {
          userid: userid,
          statusCode: err.statusCode,
          body: err.body,
          message: err.message,
          name: err.name
        });

        if (err.statusCode === 410 || err.statusCode === 404) {
          await pushdb.deleteOne({ userid: userid }).exec();
        }
      }
    }
  }
};

// Enhanced push notification functions for different types
const pushActivityNotification = async (userid, message, activityType = "activity") => {
  await pushmessage(userid, message, "/icons/m-logo.png", {
    title: "New Activity",
    type: "activity",
    url: "/notifications",
    icon: "/icons/m-logo.png"
  });
};

const pushMessageNotification = async (userid, message, senderName = "Someone") => {
  await pushmessage(userid, message, "/icons/m-logo.png", {
    title: `Message from ${senderName}`,
    type: "message",
    url: "/message",
    icon: "/icons/m-logo.png"
  });
};

const pushSupportNotification = async (userid, message) => {
  await pushmessage(userid, message, "/icons/m-logo.png", {
    title: "Chat Support",
    type: "support",
    url: "/message/supportchat",
    icon: "/icons/m-logo.png"
  });
};

const pushAdminNotification = async (userid, message, adminType = "admin") => {
  await pushmessage(userid, message, "/icons/m-logo.png", {
    title: "MMEKO SUPPORT",
    type: "support",
    url: "/message/supportchat",
    icon: "/icons/m-logo.png"
  });
};

module.exports = {
  pushmessage,
  pushActivityNotification,
  pushMessageNotification,
  pushSupportNotification,
  pushAdminNotification
};
