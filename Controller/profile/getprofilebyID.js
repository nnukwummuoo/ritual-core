// const {connectdatabase} = require('../../config/connectDB');
// const sdk = require("node-appwrite");

const userdb = require("../../Creators/userdb");
const completedb = require("../../Creators/usercomplete");
const commentdb = require("../../Creators/comment");
const likedb = require("../../Creators/like");
const postdb = require("../../Creators/post");
let exclusivedb = require("../../Creators/exclusivedb");
let followersdb = require("../../Creators/followers");
let creatordb = require("../../Creators/creators");
let exclusive_pushasedb = require("../../Creators/exclusivePurshase");

const readProfile = async (req, res) => {
  const userid = req.body.userid;
  let clientid = req.body.clientid;

  let likecount = 0;
  // let data = await connectdatabase()

  try {
    let du = await userdb
      .findOne({
        _id: userid,
      })
      .exec();

    let com = await completedb
      .findOne({
        useraccountId: userid,
      })
      .exec();

    let commentDB = await commentdb.find().exec();
    let likeDB = await likedb.find().exec();
    let followPost = await followersdb.find({}).exec();

    if (!du) {
      return res.status(409).json({
        ok: false,
        message: "Current user cant view this post!!",
      });
    }

    let postDB = await postdb
      .find({
        userid: userid,
      })
      .exec();

    let dob = "12/06/1992";

    if (du.dob) {
      dob = du.dob;
    }

    let user = {
      userid: du._id,
      exclusive: du.creator_verified,
      username: `${du.firstname} ${du.lastname}`,
      admin: du.admin,
      userphoto: com?.photoLink || "",
      username: `${du.username}`,
      aboutuser: `${com?.details || ""}`,
      location: `${du.country}`,
      active: du.active,
      gender: du.gender,
      post: [],
      firstname: du.firstname,
      lastname: du.lastname,
      exclusive_content: [],
      followers: du.followers,
      joined_month: `${du._id.getTimestamp().getMonth()}`,
      joined_year: `${du._id.getTimestamp().getFullYear()}`,
      following: du?.following.includes(clientid),
      creator_portfolio: false,
      creator_portfolio_id: "",
      creatortype: "",
      dob: dob,
      likecount: 0,
      // VIP status fields
      isVip: du.isVip || false,
      vipStartDate: du.vipStartDate || null,
      vipEndDate: du.vipEndDate || null,
      // Balance fields
      balance: du.balance || "0",
      coinBalance: du.coinBalance || 0,
      // PPV settings
      ppvStatus: du.ppvStatus || "none",
      ppvPrice: du.ppvPrice || 100,
      ppvEnabled: du.ppvEnabled || false,
    };

    let exclusiveData = await exclusivedb
      .find({
        userid: userid,
      })
      .exec();
    let have_buy = [];

    if (clientid) {
      have_buy = await exclusive_pushasedb
        .find({
          userid: clientid,
        })
        .exec();
    }

    if (exclusiveData) {
      exclusiveData.forEach((value) => {
        let data = {};
        let is_in = have_buy.find(
          (index) => String(index.exclusiveid) === String(value._id)
        );
        if (is_in) {
          data = value.toObject();
          data.buy = true;
        } else {
          data = value.toObject();
          data.buy = false;
        }

        data.contentlink = data?.contentfile?.contentfilelink;
        data.thumblink = data?.thumbnailfile?.thumbnaillink;
        data.createdAt = value?.createdAt || "";

        user.exclusive_content.push(data);
      });
    }

    // let followers = await followersdb
    //   .find({
    //     userid: userid,
    //   })
    //   .exec();

    // if (followers) {
    //   user.followers = followers;
    // }

    // if (clientid) {
    //   let isFollowed = followers.find((value) => {
    //     return String(value.followerid) === String(clientid);
    //   });

    //   if (isFollowed) {
    //     user.following = true;
    //   }
    // }

    let creator_portfolio = await creatordb
      .findOne({
        userid: userid,
      })
      .exec();

    if (creator_portfolio) {
      user.creator_portfolio = true;
      user.creator_portfolio_id = creator_portfolio._id;
      user.creatortype = creator_portfolio.hosttype;
    }

    if (postDB.length > 0) {
      postDB.forEach((value) => {
        let postFollowed = false;
        if (clientid) {
          let isfollowww = followPost.find((value) => {
            return (
              String(value.followerid) === String(clientid) &&
              String(value.userid) === String(userid)
            );
          });

          if (isfollowww) {
            postFollowed = true;
          }
        }
        let con = {
          content: value.content,
          postphoto: value.postfilelink,
          postphotoID: value.postfilepublicid,
          posttime: `${value.posttime}`,
          posttype: `${value.posttype}`,
          postid: `${value._id}`,
          userid: du._id,
          active: du.active,
          comment: [],
          like: [],
          isfollow: postFollowed,
          createdAt: value?.createdAt || "",
        };
        user.post.push(con);
      });
    }

    user.post.forEach((value, index) => {
      commentDB.forEach((value1) => {
        if (String(value.postid) === String(value1.postid)) {
          user.post[index].comment.push(value1);
        }
      });
    });

    user.post.forEach((value, index) => {
      likeDB.forEach((value1) => {
        if (String(value.postid) === String(value1.postid)) {
          user.post[index].like.push(value1);
          likecount = likecount + 1;
        }
      });
    });

    user.likecount = likecount;

    return res.status(200).json({
      ok: true,
      message: `All Post`,
      profile: user,
      user: {
        ...user,
        balance: du.balance || "0",
        coinBalance: du.coinBalance || 0,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`,
    });
  }
};

module.exports = readProfile;
