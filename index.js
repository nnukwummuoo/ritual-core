const dotenv = require("dotenv");
dotenv.config();

const validateEnv = require("./config/validateEnv");
validateEnv();

const { loginLimiter, forgotPasswordLimiter } = require("./Middleware/authRateLimit");

const express = require("express");
const http = require("http");

const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const cors = require("cors");
const { setInterval } = require("timers");
const connect = require("./config/connectdataBase");
const handleRefresh = require("./Middleware/refresh");
const verifyJwt = require("./Middleware/verify");
const checkuser = require("./utiils/useractive");
const userdisconnect = require("./utiils/userdisconnect");
const Livechats = require("./utiils/createlivechat");
const getnotify = require("./utiils/getnotification");
let sendEmail = require("./utiils/sendEmailnot");
const MYID = require("./utiils/Getmyname");
let {
  Check_caller,
  deletebyClient,
  deletebyCallerid,
  check_connected,
  deletecallOffline,
} = require("./utiils/check_caller");
const pay_creator = require("./utiils/payclient_PCALL");
const updatebalance = require("./utiils/deductPVC");
const { pushmessage, pushMessageNotification, pushSupportNotification, pushActivityNotification, pushAdminNotification } = require("./utiils/sendPushnot");
const imageRoutes = require("./routes/imageRoutes");
const { scheduleMessageCleanup } = require("./utiils/deleteOldMessages");
const scheduledCleanup = require("./scripts/scheduledCleanup");
const { trackUserConnection, trackUserDisconnection, trackUserAction, trackWebsiteVisitor } = require("./utiils/trackUserActivity");
const { checkReferralMilestones } = require("./utiils/referralMilestoneChecker");

const PORT = process.env.PORT || 3100;
const app = express();
const server = http.createServer(app);

// Enable trust proxy to get real client IP from reverse proxies
app.set('trust proxy', true);

// Define allowed origins for CORS
const allowedOrigins = [
  process.env.NEXT_PUBLIC_URL,
  "https://mmeko.com",
  "https://www.mmeko.com",
  

  "https://mmekowebsite-mu.vercel.app", // Vercel deployment

  "http://localhost:3000", // Add localhost for development
  "http://192.168.1.245:3000", // Add network URL for device access
].filter(Boolean); // Remove falsy values (e.g., undefined NEXT_PUBLIC_URL)

// Configure CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps or curl) or from allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || "*");
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use("/verifyfan", require("./routes/api/creator/verifyfan"));
app.use("/rejectfan", require("./routes/api/creator/rejectfan"));

// Log requests for debugging
app.use((req, res, next) => {
  next();
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps) or from allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  // Additional production settings
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

// Set the socket.io instance for utils
const { setSocketIO } = require('./utils/socket');
setSocketIO(io);

// Make io available to routes
app.set('io', io);

io.on("connection", (socket) => {
  socket.on("disconnect", (reason) => {
    // Handle disconnect
  });
});

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

connect();

// Initialize AI Story Generation Scheduler
const { initializeScheduledTasks } = require('./jobs/storyScheduler');
initializeScheduledTasks();

const IDS = {};

// Routes
app.use("/api/image", imageRoutes);
app.use("/", require("./routes/api/post/Post"));
app.use("/getallpost", require("./routes/api/post/getpost"));
app.use("/getalluserpost", require("./routes/api/post/getalluserPost"));
app.use("/exclusivepost", require("./routes/api/post/exclusivePost"));
app.use("/getallExclusivePosts", require("./routes/api/post/getAllExclusivePosts"));
app.use("/updateExclusivePost", require("./routes/api/post/updateExclusivePost"));
app.use("/purchaseExclusivePost", require("./routes/api/post/purchaseExclusivePost"));
app.use("/getPurchasedExclusivePosts", require("./routes/api/post/getPurchasedExclusivePosts"));
app.use("/checkExclusivePostPurchase", require("./routes/api/post/checkExclusivePostPurchase"));
app.use("/getallcomment", require("./routes/api/comment/Getallcomment"));
app.use("/getalllike", require("./routes/api/like/alllike"));
app.use("/like", require("./routes/api/like/getlikesbypost"));
app.use("/getallsharepost", require("./routes/api/share/getallsharedpost"));
app.use("/getsharepost", require("./routes/api/share/getsharepost"));

app.use("/getprofile", require("./routes/api/profile/Profile"));
app.use("/getmoreprofile", require("./routes/api/Profilemore/getProfilemore"));
app.use(
  "/messagenotification",
  require("./routes/api/chat/getNotificationmsg")
);
app.use("/notifycreator", require("./routes/api/request/notifyrequests"));
app.use("/subpushid", require("./routes/api/profile/postUserPushNote"));
app.use("/verifyemail", require("./routes/Auth/verifyEmail"));
app.use("/register", require("./routes/Auth/register"));
app.use("/logout", require("./routes/Auth/logout"));
app.use("/login", loginLimiter, require("./routes/Auth/login"));
app.use("/forgetpassword", forgotPasswordLimiter, require("./routes/Auth/forgetpassword"));
app.use("/completeregister", require("./routes/Auth/completeregister"));
app.use("/comfirmpasscode", require("./routes/Auth/comfirmpasscode"));
app.use("/changepassword", require("./routes/Auth/changepassword"));
app.use("/getpostcomment", require("./routes/api/comment/Getallcomment"));
app.use("/getprofilebyid", require("./routes/api/profile/Profile"));
app.use("/getverifycreator", require("./routes/api/creator/getlivecreator"));
app.use("/getcreatorbyportfolioid", require("./routes/api/creator/getcreatorbyportfolioid"));
app.use("/searchuser", require("./routes/api/profile/getallUser"));
app.use("/post", require("./routes/api/post/Post"));
app.use("/creator/all", require("./routes/api/creator/mycreators"));
app.use("/creator/public", require("./routes/api/creator/getAllCreators"));
app.use("/api/discover", require("./routes/api/discover/discover"));
app.use("/addpayment", require("./routes/api/payment/payment.routes"));
app.use("/payment", require("./routes/api/payment/transaction.routes"));
app.use("/web3", require("./routes/api/payment/web3.routes"));
app.use(
  "/withdraw-request",
  require("./routes/api/withdrawRequest/withdraw.route")
);
app.use(
  "/editmoreprofile",
  require("./routes/api/Profilemore/editprofilemore")
);
app.use("/creator", require("./routes/api/creator/creators"));
app.use("/creator/check", require("./routes/api/creator/checkportfolio"));
app.use("/editcreator", require("./routes/api/creator/editecreator"));
app.use("/postdocument", require("./routes/api/creator/postdocument"));
app.use("/getdocument", require("./routes/api/creator/getdocument"));
app.use("/rejectdocument", require("./routes/api/creator/rejectdocument"));
app.use("/exclusive", require("./routes/api/Exclusive/exclusive"));
app.use("/creators", require("./routes/api/creator/updateView"));
app.use("/creators", require("./routes/api/creator/updateFollowers"));
app.use("/allrequest", require("./routes/api/request/allrequestroute"));
app.use("/exclusivecontent", require("./routes/api/Exclusive/allexclusive"));
app.use("/deleteaccount", require("./routes/api/profile/deleteprofile"));
app.use("/setting", require("./routes/api/profile/setting"));
app.use("/transaction_history", require("./routes/api/profile/transaction_history"));
app.use("/top_fans", require("./routes/api/profile/top_fans"));
app.use("/top_creators", require("./routes/api/profile/top_creators"));
app.use("/follow", require("./routes/api/follow/follower"));
app.use("/getfollowers", require("./routes/api/follow/get_followers"));
app.use("/getadminhost", require("./routes/api/creator/hostforadmin"));
app.use("/deletecreator", require("./routes/api/creator/deletecreator"));
app.use("/comment", require("./routes/api/comment/Comment"));
app.use("/like", require("./routes/api/like/Like"));
app.use("/sharepost", require("./routes/api/share/share"));
app.use("/editprofile", require("./routes/api/profile/Editprofile"));
app.use("/checkusername", require("./routes/api/profile/checkusername"));
app.use("/rejectcreator", require("./routes/api/creator/rejectcreator"));
app.use("/verifycreator", require("./routes/api/creator/verifycreator"));
app.use("/getcurrentchat", require("./routes/api/chat/getchat"));
app.use("/getmsgnotify", require("./routes/api/chat/getmsgnotify"));
app.use("/updatenotify", require("./routes/api/chat/updatenotify"));
app.use("/requesthost", require("./routes/api/request/requests"));
app.use("/pendingrequest", require("./routes/api/request/getpendingrequests"));
app.use("/cancelrequest", require("./routes/api/request/cancelmyrequest"));
app.use("/acceptrequest", require("./routes/api/request/acceptrequest"));
app.use("/declinerequest", require("./routes/api/request/declinerequest"));
app.use("/getrequeststats", require("./routes/api/request/requeststat"));
app.use("/paycreator", require("./routes/api/request/paycreator"));
app.use("/completerequests", require("./routes/api/request/completerequests"));
app.use("/getallfanrequests", require("./routes/api/request/getAllFanRequests"));
app.use("/getreviews", require("./routes/api/creator/getcreatorreview"));
app.use("/deletereview", require("./routes/api/creator/deletereview"));
app.use("/statistics", require("./routes/api/profile/get_statistics"));
app.use(
  "/statistics/monthly",
  require("./routes/api/profile/get_statisticsByMonth")
);
app.use("/giftcreator", require("./routes/api/chat/giftGold"));
app.use("/topup", require("./routes/api/profile/topup"));
app.use("/getallusers", require("./routes/api/Admin/getallusers"));
app.use("/deleteuser", require("./routes/api/Admin/deleteuser"));
app.use("/suspenduser", require("./routes/api/Admin/suspenduser"));
app.use("/sendmessages", require("./routes/api/Admin/sendmessage"));
app.use("/recivemessage", require("./routes/api/Admin/recivemessage"));
app.use("/adminnotify", require("./routes/api/Admin/adminnotify"));
app.use("/vipanalysis", require("./routes/api/Admin/vipAnalysis"));
app.use("/websiteanalytics", require("./routes/api/Admin/websiteAnalytics"));
app.use("/api/admin/transactions", require("./routes/api/Admin/transactions.routes"));
app.use("/api/admin/notifications", require("./routes/api/Admin/notificationCleanupRoutes"));
app.use("/api/admin/force-logout-all", require("./routes/api/Admin/forceLogoutAll"));
app.use("/session-epoch", require("./routes/api/sessionEpoch"));

// New Admin Routes
app.use("/edituser", require("./routes/api/Admin/edituser"));
app.use("/sendNotificationWithFilter", require("./routes/api/Admin/sendNotificationWithFilter"));
app.use("/adminNotificationSystem", require("./routes/api/Admin/adminNotificationSystem"));
app.use("/getAdminNotification", require("./routes/api/Admin/getAdminNotification"));
app.use("/getAllAdminNotifications", require("./routes/api/Admin/getAllAdminNotifications"));
app.use("/updateAdminNotification", require("./routes/api/Admin/updateAdminNotification"));
app.use("/deleteAdminNotification", require("./routes/api/Admin/deleteAdminNotification"));
app.use("/getNotificationDetails", require("./routes/api/Admin/getNotificationDetails"));
app.use("/getUserStatistics", require("./routes/api/Admin/getUserStatistics"));
app.use("/getAdminDashboard", require("./routes/api/Admin/getAdminDashboard"));
app.use("/getUserFollowers", require("./routes/api/Admin/getUserFollowers"));
app.use("/banuser", require("./routes/api/Admin/banuser"));
app.use("/unbanuser", require("./routes/api/Admin/unbanuser"));
app.use("/checkBanStatus", require("./routes/api/Admin/checkBanStatus"));
app.use("/useredit", require("./routes/api/Profilemore/getuseredit"));
app.use("/addcrush", require("./routes/api/creator/addcrush"));
app.use("/getcrush", require("./routes/api/creator/getcrush"));
app.use("/deleteMsg", require("./routes/api/Admin/deleteMsg"));
app.use("/deletecrush", require("./routes/api/creator/deletecrush"));
app.use("/checkdocumentstatus", require("./routes/api/creator/checkDocumentStatus"));
app.use("/notifications", require("./routes/api/Notifications/notificationRoutes"));

// Push notification test route
app.use("/api/push", require("./routes/api/push/test"));

// Block user functionality
app.use("/block", require("./routes/api/block/blockUser"));

// VIP functionality
app.use("/vip", require("./routes/api/VIP/upgrade"));

//request
app.use("/request", require("./routes/api/requestcreator/requestRoutes"));
app.use("/upload-message-files", require("./routes/api/uploadMessageFiles"));
app.use("/quickchat", require("./routes/api/quickchat"));
app.use("/fanrequest", require("./routes/api/fanRoutes"));
app.use("/process-expired", require("./routes/api/processExpired"));
app.use("/video-call", require("./routes/api/videoCall/videoCallRoutes"));
app.use("/support-chat", require("./routes/api/supportChat"));
app.use("/review", require("./routes/api/Review/reviewRoutes"));
app.use("/api", require("./routes/api/updateRatingsVip"));
app.use("/api/backup", require("./routes/api/backupRoutes"));
app.use("/api/pending-balance", require("./routes/api/pendingBalanceRoutes"));
app.use("/api/reports", require("./routes/api/reportRoutes"));
app.use("/api/push", require("./routes/api/pushTest"));
app.use("/api/push", require("./routes/api/pushTest"));
app.use("/api", require("./routes/api/trackVisitor"));

// Pay Per View Routes
app.use("/api/ppv", require("./routes/api/ppv/ppvRoutes"));
app.use("/api/referral", require("./routes/api/referral/getReferralInfo"));
app.use("/api/referral/admin/analytics", require("./routes/api/referral/getAdminReferralAnalytics"));
app.use("/api/admin", require("./routes/admin/deviceStatsRoutes"));
app.use("/api/maintenance", require("./routes/api/maintenance"));
app.use("/api/ai-story", require("./routes/aiStoryRoutes"));
app.use("/api/creator-rituals", require("./routes/api/creatorRitualRoutes"));
app.use("/api", require("./routes/version")); // Version management
console.log("✅ Registering /api/video route");
app.use("/api/video", require("./routes/api/video/Stream"));
app.use("/api/upload-video", require("./routes/api/videoUpload"));



// Track online users
const onlineUsers = new Set();

// Track connected sockets to prevent duplicate connections
const connectedSockets = new Map();

// Track support chat connections
const supportChatConnections = new Map();

// Track disconnection times for grace period (development mode)
const disconnectionTimes = new Map();
const DISCONNECTION_GRACE_PERIOD = 10000; // 10 seconds grace period

// Track user activity to handle rapid reconnections
const userActivity = new Map();
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Cleanup inactive users periodically (TEMPORARILY DISABLED for debugging)

// TODO: Re-enable cleanup in production
// if (process.env.NODE_ENV !== 'development') {
//   setInterval(() => {
//     const now = Date.now();
//     const inactiveUsers = [];
//     
//     for (const [userid, lastActivity] of userActivity.entries()) {
//       // Only remove if user is truly inactive (no activity for 2+ minutes) AND not in grace period
//       const isInGracePeriod = disconnectionTimes.has(userid);
//       const isInactive = now - lastActivity > HEARTBEAT_INTERVAL * 4; // 2 minutes
//       
//       if (isInactive && !isInGracePeriod) {
//         inactiveUsers.push(userid);
//       }
//     }
//     
//     // Remove inactive users
//     inactiveUsers.forEach(userid => {
//       console.log(`🔍 [Socket] Removing inactive user ${userid}`);
//       onlineUsers.delete(userid);
//       userActivity.delete(userid);
//       disconnectionTimes.delete(userid);
//       connectedSockets.delete(userid);
//       io.emit('user_offline', userid);
//     });
//   }, HEARTBEAT_INTERVAL);
// }


// Socket.IO connection handling
io.on("connection", (socket) => {
  socket.on("online", async (userid) => {
    if (userid) {

      // Check if this user already has a connected socket
      const existingSocket = connectedSockets.get(userid);
      if (existingSocket && existingSocket.connected) {
        return;
      }

      await checkuser(userid);
      await deletecallOffline(userid);
      socket.id = userid;
      socket.userId = userid; // Store user ID in socket for WebRTC signaling
      IDS.userid = userid;
      socket.join("LiveChat");

      // Track this socket for this user
      connectedSockets.set(userid, socket);

      // If user was in grace period, cancel the removal
      if (disconnectionTimes.has(userid)) {
        disconnectionTimes.delete(userid);
      }

      // Update user activity
      userActivity.set(userid, Date.now());

      // Track user connection for analytics
      trackUserConnection(userid, new Date());

      // Track visitor when user connects (once per day per user)
      // Only track if user wasn't already online (first connection today)
      const wasAlreadyOnline = onlineUsers.has(userid);
      if (!wasAlreadyOnline) {
        trackWebsiteVisitor({
          visitorId: userid, // Use userid as visitorId for logged-in users
          userid: userid,
          sessionId: null,
          device: {
            userAgent: socket.handshake.headers['user-agent'] || 'Unknown',
          },
          visitTime: new Date(),
        });
      }

      // Check if user was already online (moved after visitor tracking)

      // Add user to online users set
      onlineUsers.add(userid);

      // ----------------------------------------------------
      // **Part A: Send the FULL list ONLY to the NEW user**
      // ----------------------------------------------------
      // Get the list of users *excluding* the one who just connected
      const currentOnlineUsers = Array.from(onlineUsers).filter(id => id !== userid);
      socket.emit('ONLINE_USERS_LIST', currentOnlineUsers);

      // ----------------------------------------------------
      // **Part B: Notify ALL *other* users about the NEW user**
      // ----------------------------------------------------
      // Send the single new user to everyone *except* the new user (only if user wasn't already online)
      if (!wasAlreadyOnline) {
        socket.broadcast.emit('USER_CONNECTED', userid);
      }
    }
  });

  socket.on("message", async (newdata) => {

    try {
      // Validate incoming message data
      if (!newdata || !newdata.fromid || !newdata.toid) {
        console.log("❌ [SOCKET] Invalid message data:", newdata);
        return;
      }

      if (newdata.fromid === 'undefined' || newdata.toid === 'undefined' ||
        newdata.fromid === 'null' || newdata.toid === 'null') {
        console.log("❌ [SOCKET] Message contains undefined/null IDs:", newdata);
        return;
      }

      let info = await MYID(newdata.fromid);

      const data = { ...newdata, ...info };
      const savedMsg = await Livechats({ ...data });

      // Include the database _id in the data being broadcasted
      const broadcastData = {
        ...data,
        _id: savedMsg?._id || data._id
      };

      if (info && data.toid && data.toid !== 'undefined' && data.toid !== 'null' && typeof data.toid === 'string' && data.toid.length === 24) {
        await sendEmail(data.toid, `New message from ${info?.name}`);
        await pushMessageNotification(
          data.toid,
          `New message from ${info?.name}`,
          info?.name || "Someone"
        );
      } else {
        console.log("⚠️ [SOCKET] Invalid toid for email notification:", data.toid);
      }

      socket.broadcast.emit("LiveChat", {
        name: info?.name,
        photolink: info?.photolink || "",
        data: broadcastData,
      });

    } catch (error) {
      console.error("❌ [BACKEND] Error processing message:", error);
    }
  });

  socket.on("videocall", async (data, arkFunction) => {
    let myid = data.caller_id;
    let answerid = data.answer_id;
    let video_user = data.my_id;
    let callname = data.name;

    let calloffer = [];

    if (myid === video_user) {
      let responds = await Check_caller(answerid, myid);

      if (data.answer_message === "reject") {
        await deletebyClient(myid);
        data.message = "call ended";
        data.answer_message = "reject";
        socket.broadcast.emit(answerid, { data: data });
      } else if (responds === "store_sdb") {
        if (data.offer_can) {
          socket.broadcast.emit(`${answerid}_calloffer`, {
            offer: data.offer_can,
          });
        }
      } else if (responds === "calling") {
        data.answer_message = "calling";
        data.message = `incomming call ${callname}`;
        if (data.sdp_c_offer) {
          let info = calloffer.find((value) => {
            return (
              value.callerid === data.caller_id &&
              value.answerid === data.answer_id
            );
          });
          if (!info) {
            let datas = {
              callerid: data.caller_id,
              answerid: data.answer_id,
              sdp_c_offer: data.sdp_c_offer,
            };

            calloffer.push(datas);
          }
        }

        if (data.offer_can) {
          socket.broadcast.emit(`${answerid}_calloffer`, {
            offer: data.offer_can,
          });

          socket.broadcast.emit(`${answerid}_offer`, data.offer_can);
        }
        socket.broadcast.emit(answerid, { data: data });
      } else if (responds === "user_busy") {
        data.answer_message = "user busy";
        socket.broadcast.emit(myid, { data: data });
      } else if (responds === "store_sdb") {
        socket.broadcast.emit(answerid, { data: data });
      }
    }

    if (answerid === video_user) {
      let responds = await check_connected(answerid);
      if (data.answer_message === "reject") {
        await deletebyCallerid(answerid);
        data.answer_message = "reject";
        socket.broadcast.emit(myid, { data: data });
      } else if (responds === false) {

        if (data.sdp_a_offer && data.answer_can) {
          socket.broadcast.emit(`${myid}_answeroffer`, {
            sdp: data.sdp_a_offer,
            offer: data.answer_can,
          });
        }

        socket.broadcast.emit(myid, { data: data });
      } else if (responds === true) {

        if (data.answer_can) {
          socket.broadcast.emit(`${myid}_answeroffer`, {
            offer: data.answer_can,
          });
        }

        socket.broadcast.emit(myid, { data: data });
      }
    }
  });

  socket.on("privatecall", async (data, arkFunction) => {
    let myid = data.caller_id;
    let answerid = data.answer_id;
    let video_user = data.my_id;
    let callname = data.name;

    let calloffer = [];

    if (myid === video_user) {
      let responds = await Check_caller(answerid, myid);

      if (data.amount) {
        if (parseFloat(data.amount) > 0) {
          await pay_creator(data.fromid, data.toid, data.amount);
          await updatebalance(
            data.fromid,
            data.toid,
            data.balance,
            data.amount
          );
          socket.broadcast.emit(`pvc_${data.toid}_amount`, {
            amount: data.amount,
          });
          data.amount = "";
        }
      }

      if (data.answer_message === "reject") {
        await deletebyClient(myid);
        data.message = "call ended";
        data.answer_message = "reject";
        socket.broadcast.emit(`${answerid}_reject`, { data: "reject" });
        socket.broadcast.emit(answerid, { data: data });
      } else if (responds === "store_sdb") {
        if (data.offer_can) {
          socket.broadcast.emit(`${answerid}_calloffer`, {
            offer: data.offer_can,
          });
        }
      } else if (responds === "calling") {
        data.answer_message = "calling";
        data.message = `private show ${callname}`;
        if (data.sdp_c_offer) {
          let info = calloffer.find((value) => {
            return (
              value.callerid === data.caller_id &&
              value.answerid === data.answer_id
            );
          });
          if (!info) {
            let datas = {
              callerid: data.caller_id,
              answerid: data.answer_id,
              sdp_c_offer: data.sdp_c_offer,
            };

            calloffer.push(datas);
          }
        }

        if (data.offer_can) {
          socket.broadcast.emit(`${answerid}_calloffer`, {
            offer: data.offer_can,
          });

          socket.broadcast.emit(`${answerid}_offer`, data.offer_can);
        }
        socket.broadcast.emit(answerid, { data: data });
      } else if (responds === "user_busy") {
        data.answer_message = "user busy";
        socket.broadcast.emit(myid, { data: data });
      } else if (responds === "store_sdb") {
        socket.broadcast.emit(answerid, { data: data });
      }
    }

    if (answerid === video_user) {
      let responds = await check_connected(answerid);
      if (data.answer_message === "reject") {
        await deletebyCallerid(answerid);
        data.answer_message = "reject";
        socket.broadcast.emit(`${myid}_reject`, { data: "reject" });
        socket.broadcast.emit(myid, { data: data });
      } else if (responds === false) {

        if (data.sdp_a_offer && data.answer_can) {
          socket.broadcast.emit(`${myid}_answeroffer`, {
            sdp: data.sdp_a_offer,
            offer: data.answer_can,
          });
        }

        socket.broadcast.emit(myid, { data: data });
      } else if (responds === true) {

        if (data.sdp_a_offer) {
          socket.broadcast.emit(`${myid}_answeroffer`, {
            sdp: data.sdp_a_offer,
            offer: "",
          });
        }

        if (data.answer_can) {
          socket.broadcast.emit(`${myid}_answeroffer`, {
            offer: data.answer_can,
          });
        }

        socket.broadcast.emit(myid, { data: data });
      }
    }
  });

  socket.on("offline", async (userid) => {
    if (userid) {
      // Remove user from online users set
      onlineUsers.delete(userid);

      // Remove from connected sockets
      connectedSockets.delete(userid);

      // Broadcast user offline status
      socket.broadcast.emit('user_offline', userid);

      // Clean up user data
      await userdisconnect(userid);
      await deletecallOffline(userid);
    }
  });

  // Support Chat Socket Events
  socket.on("join_support_chat", (data) => {
    if (data.userid) {
      supportChatConnections.set(data.userid, socket.id);
      socket.join(`support_chat_${data.userid}`);
      console.log(`User ${data.userid} joined support chat`);
    }
  });

  socket.on("support_chat_message", async (data) => {
    try {
      // Broadcast message to admin and user
      io.to(`support_chat_${data.userid}`).emit("support_message_received", data);
      io.to("admin_support").emit("new_support_message", data);

      // Send push notifications
      if (data.isAdmin) {
        // Admin message to user
        await pushSupportNotification(data.userid, data.message || "Hat Support Message");
      } else {
        // User message to admin - notify all admins
        const admins = await userdb.find({ isAdmin: true }).exec();
        for (const admin of admins) {
          await pushAdminNotification(admin._id, `New support message from user: ${data.message || "Support request"}`);
        }
      }
    } catch (error) {
      console.error("Error handling support chat message:", error);
    }
  });

  socket.on("admin_join_support", () => {
    socket.join("admin_support");
    console.log("Admin joined support chat");
  });

  socket.on("disconnect", async () => {
    // Remove from support chat connections
    for (const [userid, socketId] of supportChatConnections.entries()) {
      if (socketId === socket.id) {
        supportChatConnections.delete(userid);
        break;
      }
    }

    // Broadcast user offline status before disconnecting
    if (socket.id && IDS.userid) {
      const disconnectTime = Date.now();

      // Track user disconnection for analytics
      trackUserDisconnection(IDS.userid, new Date(disconnectTime));

      // Always use grace period for better user experience
      disconnectionTimes.set(IDS.userid, disconnectTime);

      // Set timeout to actually remove user after grace period
      setTimeout(() => {
        if (disconnectionTimes.has(IDS.userid)) {
          const storedDisconnectTime = disconnectionTimes.get(IDS.userid);
          const timeSinceDisconnect = Date.now() - storedDisconnectTime;

          // Only remove if user hasn't reconnected within grace period
          if (timeSinceDisconnect >= DISCONNECTION_GRACE_PERIOD) {
            onlineUsers.delete(IDS.userid);
            disconnectionTimes.delete(IDS.userid);
            userActivity.delete(IDS.userid);
            socket.broadcast.emit('user_offline', IDS.userid);
          }
        }
      }, DISCONNECTION_GRACE_PERIOD);

      // Remove from connected sockets
      connectedSockets.delete(IDS.userid);
    }

    await userdisconnect(socket.id);
    await deletecallOffline(socket.id);
    socket.disconnect();
  });

  // Handle heartbeat to keep users online
  socket.on('heartbeat', (userid) => {
    if (userid) {
      userActivity.set(userid, Date.now());

      // Ensure user stays in onlineUsers set
      if (!onlineUsers.has(userid)) {
        onlineUsers.add(userid);
      }

      // Cancel any pending disconnection
      if (disconnectionTimes.has(userid)) {
        disconnectionTimes.delete(userid);
      }
    }
  });

  // Handle follow/unfollow events from clients
  socket.on('follow_update', (data) => {
    // Broadcast to all clients
    io.emit('follow_update', data);
  });

  // Online status and typing indicators
  socket.on('join_user_room', (data) => {
    if (data.userId) {
      socket.join(`user_${data.userId}`);
    }
  });

  socket.on('leave_user_room', (data) => {
    if (data.userId) {
      socket.leave(`user_${data.userId}`);
    }
  });

  socket.on('typing_start', (data) => {
    if (data.fromUserId && data.toUserId) {
      // Send typing indicator to the target user
      socket.to(`user_${data.toUserId}`).emit('typing_start', {
        fromUserId: data.fromUserId,
        toUserId: data.toUserId
      });
    }
  });

  socket.on('typing_stop', (data) => {
    if (data.fromUserId && data.toUserId) {
      // Send typing stop indicator to the target user
      socket.to(`user_${data.toUserId}`).emit('typing_stop', {
        fromUserId: data.fromUserId,
        toUserId: data.toUserId
      });
    }
  });

  // Video call events
  socket.on('fan_call_start', async (data) => {
    try {
      const { callerId, callerName, answererId, answererName } = data;



      // Starting video call

      // Check if answererId is a creator ID (host ID) and find the actual user ID
      let actualAnswererId = answererId;
      let answererVipStatus = false;
      let answererVipEndDate = null;
      let callerVipStatus = false;
      let callerVipEndDate = null;
      let callerFirstName = '';
      let callerLastName = '';
      let callerUsername = '';
      let answererFirstName = '';
      let answererLastName = '';
      let answererUsername = '';

      // Try to find the creator's user ID from their creator ID (which is the creator's _id)
      try {
        const creatordb = require('./Creators/creators');
        const userdb = require('./Creators/userdb');

        const creator = await creatordb.findOne({ _id: answererId }).exec();

        if (creator && creator.userid) {
          actualAnswererId = creator.userid;
          // Found creator user ID
        } else {
          // Creator not found, using original ID
        }

        // Fetch VIP status and name details for both caller and answerer
        const [caller, answerer] = await Promise.all([
          userdb.findOne({ _id: callerId }).exec(),
          userdb.findOne({ _id: actualAnswererId }).exec()
        ]);

        if (caller) {
          callerVipStatus = caller.isVip || false;
          callerVipEndDate = caller.vipEndDate || null;
          callerFirstName = caller.firstname || '';
          callerLastName = caller.lastname || '';
          callerUsername = caller.username || '';
        }

        if (answerer) {
          answererVipStatus = answerer.isVip || false;
          answererVipEndDate = answerer.vipEndDate || null;
          answererFirstName = answerer.firstname || '';
          answererLastName = answerer.lastname || '';
          answererUsername = answerer.username || '';
        }


      } catch (error) {
        console.error('Error fetching VIP status:', error);
        // Error looking up creator, using original ID
      }

      // Checking online status

      // Check if answerer is online - try multiple ID formats
      const isOnline = onlineUsers.has(actualAnswererId) ||
        onlineUsers.has(actualAnswererId.toString()) ||
        Array.from(onlineUsers).some(id => id.toString() === actualAnswererId.toString());

      // Additional check: see if user has a connected socket
      const hasConnectedSocket = connectedSockets.has(actualAnswererId) ||
        connectedSockets.has(actualAnswererId.toString()) ||
        Array.from(connectedSockets.keys()).some(id => id.toString() === actualAnswererId.toString());

      if (!isOnline && !hasConnectedSocket) {
        // User not online, but allowing call
        // socket.emit('fan_call_error', {
        //   message: 'User is not online'
        // });
        // return;
      }

      // If user has connected socket but not in onlineUsers, add them
      if (!isOnline && hasConnectedSocket) {
        // User has socket but not in onlineUsers, adding
        onlineUsers.add(actualAnswererId);
      }

      // Create call record
      const videocalldb = require('./Creators/videoalldb');
      const callData = {
        callerid: actualAnswererId, // Use the actual user ID
        clientid: callerId,
        connected: false,
        waiting: "wait",
        callerName: callerName,
        answererName: answererName,
        createdAt: new Date()
      };

      const call = await videocalldb.create(callData);



      socket.to(`user_${actualAnswererId}`).emit('fan_call_incoming', {
        callId: call._id,
        callerId: callerId,
        callerName: callerName,
        callerFirstName: callerFirstName,
        callerLastName: callerLastName,
        callerUsername: callerUsername,
        callerIsVip: callerVipStatus,
        callerVipEndDate: callerVipEndDate,
        answererFirstName: answererFirstName,
        answererLastName: answererLastName,
        answererUsername: answererUsername,
        answererIsVip: answererVipStatus,
        answererVipEndDate: answererVipEndDate,
        isIncoming: true
      });

      // Call notification sent

    } catch (error) {
      console.error('Error in fan_call_start:', error);
      socket.emit('fan_call_error', {
        message: 'Failed to start call'
      });
    }
  });

  socket.on('fan_call_accept', async (data) => {
    try {
      const { callId, callerId, answererId, answererName } = data;

      const videocalldb = require('./Creators/videoalldb');
      const userdb = require('./Creators/userdb');
      const call = await videocalldb.findOne({ _id: callId }).exec();

      if (call) {
        call.connected = true;
        call.waiting = "connected";
        await call.save();

        // Fetch VIP status and name details for both users
        const [caller, answerer] = await Promise.all([
          userdb.findOne({ _id: callerId }).exec(),
          userdb.findOne({ _id: answererId }).exec()
        ]);

        const callerVipStatus = caller?.isVip || false;
        const callerVipEndDate = caller?.vipEndDate || null;
        const callerFirstName = caller?.firstname || '';
        const callerLastName = caller?.lastname || '';
        const callerUsername = caller?.username || '';
        const answererVipStatus = answerer?.isVip || false;
        const answererVipEndDate = answerer?.vipEndDate || null;
        const answererFirstName = answerer?.firstname || '';
        const answererLastName = answerer?.lastname || '';
        const answererUsername = answerer?.username || '';

        // Emit call accepted to caller
        socket.to(`user_${callerId}`).emit('fan_call_accepted', {
          callId: callId,
          callerId: callerId,
          callerFirstName: callerFirstName,
          callerLastName: callerLastName,
          callerUsername: callerUsername,
          answererId: answererId,
          answererName: answererName,
          answererFirstName: answererFirstName,
          answererLastName: answererLastName,
          answererUsername: answererUsername,
          callerIsVip: callerVipStatus,
          callerVipEndDate: callerVipEndDate,
          answererIsVip: answererVipStatus,
          answererVipEndDate: answererVipEndDate
        });

        // Call accepted, notification sent to caller
      }
    } catch (error) {
      console.error('Error in fan_call_accept:', error);
    }
  });

  socket.on('fan_call_decline', async (data) => {
    try {
      const { callId, callerId, answererId } = data;

      const videocalldb = require('./Creators/videoalldb');
      await videocalldb.deleteOne({ _id: callId }).exec();

      // Emit call declined to caller
      socket.to(`user_${callerId}`).emit('fan_call_declined', {
        callId: callId,
        callerId: callerId,
        answererId: answererId
      });

      // Call declined, notification sent to caller
    } catch (error) {
      console.error('Error in fan_call_decline:', error);
    }
  });

  socket.on('fan_call_end', async (data) => {
    try {
      const { callId, userId, callerId, answererId } = data;

      // Skip database operations for temporary call IDs
      if (callId && callId.startsWith('temp_')) {
        // Ending temporary call - emit to both caller and answerer if provided
        const endEvent = {
          callId: callId,
          endedBy: userId
        };

        // Emit to both parties using io.to() to ensure both receive it
        if (callerId) {
          io.to(`user_${callerId}`).emit('fan_call_ended', endEvent);
        }
        if (answererId) {
          io.to(`user_${answererId}`).emit('fan_call_ended', endEvent);
        }

        // Also emit to all sockets as fallback (for temp calls without user IDs)
        io.emit('fan_call_ended', endEvent);
        return;
      }

      const videocalldb = require('./Creators/videoalldb');
      const call = await videocalldb.findOne({ _id: callId }).exec();

      if (call) {
        const otherUserId = call.callerid === userId ? call.clientid : call.callerid;

        // Delete call record
        await videocalldb.deleteOne({ _id: callId }).exec();

        // Emit call ended to both participants using io.to() for proper room targeting
        const endEvent = {
          callId: callId,
          endedBy: userId
        };

        // Emit to both users immediately
        io.to(`user_${userId}`).emit('fan_call_ended', endEvent);
        io.to(`user_${otherUserId}`).emit('fan_call_ended', endEvent);

        // Call ended, notifications sent to both users
      }
    } catch (error) {
      console.error('Error in fan_call_end:', error);
    }
  });

  socket.on('fan_call_timeout', async (data) => {
    try {
      const { callId } = data;

      // Handle temporary call IDs - still create missed call notification
      if (callId && callId.startsWith('temp_')) {
        const { callerId, callerName, answererId, answererName } = data;

        // Create missed call notification for the answerer (creator)
        if (answererId) {
          // Find the actual creator user ID from their creator ID
          let actualCreatorUserId = answererId;
          try {
            const creatordb = require('./Creators/creators');
            const creator = await creatordb.findOne({ _id: answererId }).exec();
            if (creator && creator.userid) {
              actualCreatorUserId = creator.userid;
            }
          } catch (error) {
            // Error looking up creator, using original ID
          }

          const admindb = require('./Creators/admindb');
          await admindb.create({
            userid: actualCreatorUserId,
            message: `You missed a fan call from ${callerName || 'Unknown User'}`,
            seen: false,
            type: 'missed_call',
            callerId: callerId,
            callerName: callerName,
            callerPhoto: null
          });

          // Send push notification for missed call
          const userdb = require('./Creators/userdb');
          const answerer = await userdb.findOne({ _id: actualCreatorUserId }).exec();

          if (answerer) {
            await pushmessage(
              actualCreatorUserId,
              `You missed a fan call from ${callerName || 'Unknown User'}`,
              "/icons/m-logo.png",
              {
                title: 'Missed Fan Call',
                type: 'missed_call',
                url: "/notifications",
                callerId: callerId,
                callerName: callerName
              }
            );
          }

          // Emit missed call notification to the answerer (creator)
          io.to(`user_${actualCreatorUserId}`).emit('fan_call_missed', {
            callId: callId,
            callerId: callerId,
            callerName: callerName,
            callerPhoto: null
          });
        }

        // Emit timeout event to both participants
        socket.broadcast.emit('fan_call_timeout', {
          callId: callId
        });

        return;
      }

      const videocalldb = require('./Creators/videoalldb');
      const call = await videocalldb.findOne({ _id: callId }).exec();

      if (call) {
        const callerId = call.callerid;
        const clientId = call.clientid;

        // Get user information for missed call notification
        const userdb = require('./Creators/userdb');
        const caller = await userdb.findOne({ _id: callerId }).exec();
        const answerer = await userdb.findOne({ _id: clientId }).exec();

        // Create missed call notification for the answerer (creator)
        const admindb = require('./Creators/admindb');
        if (answerer) {
          // Construct full caller name
          const fullCallerName = caller?.firstname && caller?.lastname
            ? `${caller.firstname} ${caller.lastname}`
            : caller?.firstname || caller?.username || 'Unknown User';

          await admindb.create({
            userid: clientId,
            message: `You missed a fan call from ${fullCallerName}`,
            seen: false,
            type: 'missed_call',
            callerId: callerId,
            callerName: fullCallerName,
            callerPhoto: caller?.photolink || caller?.photo || null
          });

          // Send push notification for missed call
          if (answerer) {
            await pushmessage(
              clientId,
              `You missed a fan call from ${fullCallerName}`,
              "/icons/m-logo.png",
              {
                title: 'Missed Fan Call',
                type: 'missed_call',
                url: "/notifications",
                callerId: callerId,
                callerName: fullCallerName
              }
            );
          }
        }

        // Delete call record
        await videocalldb.deleteOne({ _id: callId }).exec();

        // Emit timeout event to both participants
        io.to(`user_${callerId}`).emit('fan_call_timeout', {
          callId: callId
        });

        io.to(`user_${clientId}`).emit('fan_call_timeout', {
          callId: callId
        });

        // Emit missed call notification to the answerer (creator)
        if (answerer) {
          io.to(`user_${clientId}`).emit('fan_call_missed', {
            callId: callId,
            callerId: callerId,
            callerName: fullCallerName,
            callerPhoto: caller?.photolink || caller?.photo || null
          });
        }

        // Call timeout, notifications sent to both users
      }
    } catch (error) {
      console.error('Error in fan_call_timeout:', error);
    }
  });

  // WebRTC signaling events
  socket.on('fan_call_offer', async (data) => {
    const { callId, offer } = data;
    // Received offer for call

    try {
      // If it's a temporary call ID, broadcast to all users (fallback)
      if (callId.startsWith('temp_')) {
        // Temporary call ID, broadcasting offer
        socket.broadcast.emit('fan_call_offer', {
          callId: callId,
          offer: offer
        });
        return;
      }

      // Find the call to get the other participant
      const videocalldb = require('./Creators/videoalldb');
      const call = await videocalldb.findOne({ _id: callId }).exec();

      if (call) {
        // Get the current user ID from the socket
        const currentUserId = socket.userId || socket.id;
        const otherUserId = call.callerid === currentUserId ? call.clientid : call.callerid;
        // Forwarding offer to user

        // Forward offer to the other participant
        socket.to(`user_${otherUserId}`).emit('fan_call_offer', {
          callId: callId,
          offer: offer
        });
      }
    } catch (error) {
      console.error('❌ [WebRTC] Error forwarding fan call offer:', error);
    }
  });

  socket.on('fan_call_answer', async (data) => {
    const { callId, answer } = data;
    // Received answer for call

    try {
      // If it's a temporary call ID, broadcast to all users (fallback)
      if (callId.startsWith('temp_')) {
        // Temporary call ID, broadcasting answer
        socket.broadcast.emit('fan_call_answer', {
          callId: callId,
          answer: answer
        });
        return;
      }

      // Find the call to get the other participant
      const videocalldb = require('./Creators/videoalldb');
      const call = await videocalldb.findOne({ _id: callId }).exec();

      if (call) {
        // Get the current user ID from the socket
        const currentUserId = socket.userId || socket.id;
        const otherUserId = call.callerid === currentUserId ? call.clientid : call.callerid;
        // Forwarding answer to user

        // Forward answer to the other participant
        socket.to(`user_${otherUserId}`).emit('fan_call_answer', {
          callId: callId,
          answer: answer
        });
      }
    } catch (error) {
      console.error('❌ [WebRTC] Error forwarding answer:', error);
    }
  });

  socket.on('fan_call_ice_candidate', async (data) => {
    const { callId, candidate } = data;
    // Received ICE candidate for call

    try {
      // If it's a temporary call ID, broadcast to all users (fallback)
      if (callId.startsWith('temp_')) {
        // Temporary call ID, broadcasting ICE candidate
        socket.broadcast.emit('fan_call_ice_candidate', {
          callId: callId,
          candidate: candidate
        });
        return;
      }

      // Find the call to get the other participant
      const videocalldb = require('./Creators/videoalldb');
      const call = await videocalldb.findOne({ _id: callId }).exec();

      if (call) {
        // Get the current user ID from the socket
        const currentUserId = socket.userId || socket.id;
        const otherUserId = call.callerid === currentUserId ? call.clientid : call.callerid;
        // Forwarding ICE candidate to user

        // Forward ICE candidate to the other participant
        socket.to(`user_${otherUserId}`).emit('fan_call_ice_candidate', {
          callId: callId,
          candidate: candidate
        });
      }
    } catch (error) {
      console.error('❌ [WebRTC] Error forwarding fan call ICE candidate:', error);
    }
  });
});

mongoose.connection.once("open", () => {
  console.log("✅ Database connected successfully");

  // Start message cleanup scheduler
  scheduleMessageCleanup();

  // Start MongoDB backup cron job
  const { setupBackupCron } = require('./scripts/setupBackupCron');
  setupBackupCron();

  // Start orphaned pending balances cleanup scheduler
  scheduledCleanup.start();

  // Start notification cleanup cron job
  const { setupNotificationCleanup } = require('./scripts/setupNotificationCleanup');
  setupNotificationCleanup();

  // Start expired requests processing cron job
  const scheduledExpiredRequests = require('./scripts/scheduledExpiredRequests');
  scheduledExpiredRequests.start();

  // Start story generation and lifecycle management cron jobs
  const { initializeScheduledTasks } = require('./jobs/storyScheduler');
  initializeScheduledTasks();


  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌐 Server accessible on network at http://10.216.161.157:${PORT}`);

    // Initialize Web3 payment listener
    const { initializeWeb3Listener } = require('./Controller/accountPayment/web3payment');
    initializeWeb3Listener().catch(err => {
      console.error('❌ Failed to start Web3 listener:', err);
    });
  });

  // Video call billing event
  io.on('connection', (socket) => {
    socket.on('fan_call_billing', async (data) => {
      try {
        const { callId, callerId, currentUserId, amount, minute } = data;
        console.log('💰 [Billing] Received fan call billing event:', { callId, callerId, currentUserId, amount, minute });

        const userdb = require('./Creators/userdb');
        const mainbalance = require('./Creators/mainbalance');
        const videocalldb = require('./Creators/videoalldb');

        // Find the fan (caller) and creator (answerer)
        const call = await videocalldb.findOne({ _id: callId }).exec();
        if (!call) {
          console.log('❌ [Billing] Call not found for billing:', callId);
          return;
        }

        console.log('✅ [Billing] Call found:', { callId, callerId: call.callerid, clientId: call.clientid });

        // Check if this minute has already been billed to prevent duplicate billing
        const existingBilling = await mainbalance.findOne({
          userid: currentUserId,
          details: `Fan call - payment for minute ${minute}`,
          date: { $gte: (Date.now() - 60000).toString() } // Within the last minute
        }).exec();

        if (existingBilling) {
          console.log('⚠️ [Billing] Minute already billed, skipping duplicate:', { minute, callId, currentUserId });
          return;
        }

        // Also check if the call document has a billing state to prevent race conditions
        if (call.billedMinutes && call.billedMinutes.includes(minute)) {
          console.log('⚠️ [Billing] Minute already marked as billed in call document:', { minute, callId });
          return;
        }

        // The fan is the one sending the billing event (currentUserId), not necessarily the caller
        const fanId = currentUserId; // Fan is the one paying
        const creator_portfolio_id = currentUserId === call.callerid ? call.clientid : call.callerid;

        console.log('💰 [Billing] Corrected user roles:', {
          fanId,
          creator_portfolio_id,
          originalCallerId: call.callerid,
          originalClientId: call.clientid,
          currentUserId
        });

        // Deduct from fan's balance (balance is String in database)
        const fan = await userdb.findOne({ _id: fanId }).exec();
        const fanBalance = parseInt(fan.balance) || 0;

        console.log('💰 [Billing] Fan balance check:', { fanId, fanBalance, amount, hasEnoughFunds: fanBalance >= amount });

        if (fan && fanBalance >= amount) {
          // Update fan's balance
          fan.balance = (fanBalance - amount).toString();
          await fan.save();

          // Mark this minute as billed in the call document to prevent duplicate billing
          if (!call.billedMinutes) {
            call.billedMinutes = [];
          }
          call.billedMinutes.push(minute);
          await call.save();

          // Add to creator's earnings
          const creator = await userdb.findOne({ _id: creator_portfolio_id }).exec();
          if (creator) {
            creator.earnings = (creator.earnings || 0) + amount;
            await creator.save();

            // Update main balance record
            const balanceRecord = await mainbalance.findOne({ userid: creator_portfolio_id }).exec();
            if (balanceRecord) {
              balanceRecord.earnings = (balanceRecord.earnings || 0) + amount;
              await balanceRecord.save();
            }


            const userHistory = {
              userid: fanId,
              details: `Fan call - payment for minute ${minute}`,
              spent: `${amount}`,
              income: "0",
              date: `${Date.now().toString()}`
            };
            await mainbalance.create(userHistory);
            console.log('📝 [Billing] Created user transaction history:', userHistory);

            const creatorHistory = {
              userid: creator._id, // Use the actual creator's user ID, not the portfolio ID
              details: `Fan call - payment received for 1 minute`,
              spent: "0",
              income: `${amount}`,
              date: `${Date.now().toString()}`
            };
            await mainbalance.create(creatorHistory);
            console.log('📝 [Billing] Created creator transaction history:', creatorHistory);
            console.log('📝 [Billing] Creator IDs:', {
              portfolioId: creator_portfolio_id,
              actualCreatorId: creator._id,
              creatorUsername: creator.username
            });

            // Billing successful
            console.log('✅ [Billing] Billing successful:', {
              fanId,
              creator_portfolio_id,
              amount,
              minute,
              newFanBalance: fan.balance,
              newCreatorEarnings: creator.earnings,
              billedMinutes: call.billedMinutes
            });

            // Emit balance updates to both users
            io.to(`user_${fanId}`).emit('balance_updated', {
              balance: fan.balance,
              type: 'deduct',
              amount: amount,
              minute: minute
            });

            io.to(`user_${creator_portfolio_id}`).emit('balance_updated', {
              earnings: creator.earnings,
              type: 'earn',
              amount: amount,
              callEarnings: amount, // Show earnings from this specific call
              minute: minute
            });
          }
        } else {
          // Insufficient funds for billing
          console.log('❌ [Billing] Insufficient funds:', { fanId, fanBalance, amount });
          // Emit insufficient funds event to end the call
          io.to(`user_${fanId}`).emit('insufficient_funds', {
            message: 'Insufficient funds to continue call'
          });
        }
      } catch (error) {
        console.error('Error in fan_call_billing:', error);
      }
    });
  });
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Database connection error:", err);
});

// Run referral milestone checker every 2 hours
// Check if referred users completed the 7-day challenge (120 min/day)
setInterval(async () => {
  console.log("⏰ [Cron] Running referral milestone check...");
  try {
    await checkReferralMilestones();
  } catch (error) {
    console.error("❌ [Cron] Error in referral milestone check:", error);
  }
}, 2 * 60 * 60 * 1000); // Every 2 hours

// Run once on server start
setTimeout(async () => {
  console.log("🚀 [Startup] Running initial referral milestone check...");
  try {
    await checkReferralMilestones();
  } catch (error) {
    console.error("❌ [Startup] Error in initial referral milestone check:", error);
  }
}, 10000); // Run 10 seconds after startup
