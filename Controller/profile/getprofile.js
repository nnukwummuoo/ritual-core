// const {connectdatabase} = require('../../config/connectDB');
// const sdk = require("node-appwrite");
const userdb = require("../../Creators/userdb")
const creators = require("../../Creators/creators")
//const history = require("../../helpers/earning_in_month")
const settingdb = require("../../Creators/settingsdb")


const readProfile = async (req, res) => {
  const bodyUserid = req.body?.userid || req.body?.userId;
  const bodyUsername = req.body?.username || req.body?.userName || req.body?.slug;
  let userid = bodyUserid;
  let dues;
  let exclusive = false;
  let emailnot = false;
  let pushnot = false;

  let Creator_portfolio;

  try {
    let du;
    if (bodyUsername && String(bodyUsername).trim()) {
      // Decode URL encoding so %40 from client becomes @ for DB lookup
      let decoded = String(bodyUsername).trim();
      try { decoded = decodeURIComponent(decoded); } catch (e) { /* keep as-is */ }
      const raw = decoded.trim();
      const withoutAt = raw.replace(/^@+/, '');
      const candidates = [raw];

     

      if (withoutAt !== raw) candidates.push(withoutAt);
      du = await userdb.findOne({ username: { $in: candidates } }).exec();
      if (!du) {
        du = await userdb.findOne({ username: new RegExp('^' + raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }).exec();
      }
      if (!du && withoutAt !== raw) {
        du = await userdb.findOne({ username: new RegExp('^' + withoutAt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }).exec();
      }
      if (!du) {
        return res.status(404).json({
          ok: false,
          message: 'User not found for this username.',
          debug: process.env.NODE_ENV !== 'production' ? { tried: candidates, raw, withoutAt } : undefined
        });
      }
      userid = du._id.toString();
    } else if (bodyUserid) {
      du = await userdb.findOne({ _id: bodyUserid }).exec();
    } else {
      return res.status(400).json({ ok: false, message: 'Provide userid or username.' });
    }

    let creatorava = await creators.findOne({
      userid: userid
    }).exec();
    let notificaton_turn = await settingdb.findOne({
      userid: userid
    }).exec();

    if (notificaton_turn) {
      emailnot = notificaton_turn.emailnot
      pushnot = notificaton_turn.pushnot
    }


    //  let creatorava = creator.documents.find(value =>{
    //   return value.userid === userid;
    //  })

    // Check if user exists FIRST before accessing properties
    if (!du) {
      return res.status(409).json({
        "ok": false,
        'message': 'current user can not edit this post!!'
      });
    }

    if (creatorava) {
      Creator_portfolio = true
    } else {
      Creator_portfolio = false;
    }

    if (du.creator_verified) {
      exclusive = true
    } else {
      exclusive = false
    }

    dues = du.toObject();
    dues.userId = userid; // ensure string id for frontend
    dues.exclusive = exclusive;
    dues.creator = Creator_portfolio;
    // Also set creator_portfolio field (use value from userdb which is updated when portfolio is created/deleted)
    dues.creator_portfolio = du.creator_portfolio || false;
    dues.emailnot = emailnot;
    dues.pushnot = pushnot;
    dues.hosttype = "Fan meet"; // Default host type
    dues.fan_verified = du.fan_verified || false;
    if (creatorava) {
      // let images = creatorava.creatorfiles.split(",")
      if (creatorava.creatorfiles.length > 0) {
        // Use the first creator image
        dues.creatorphotolink = creatorava.creatorfiles[0].creatorfilelink;
      }
      dues.creator_portfolio_id = creatorava._id
      // dues.creatorphotolink = images[0]
      dues.creatorname = creatorava.name
      dues.hosttype = creatorava.hosttype || "" // Include host type from creator data
      // Ensure creator_portfolio is true if creator exists
      dues.creator_portfolio = true;
    } else {
      // If no creator portfolio exists, ensure creator_portfolio_id is empty string
      dues.creator_portfolio_id = du.creator_portfolio_id || "";
      dues.creator_portfolio = false;
    }



    
    return res.status(200).json({
      "ok": true,
      "message": `All Post`,
      profile: dues
    })


  } catch (err) {
    return res.status(500).json({
      "ok": false,
      'message': `${err.message}!`
    });
  }
}

module.exports = readProfile
