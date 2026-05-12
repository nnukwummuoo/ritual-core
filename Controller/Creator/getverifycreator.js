const creators = require("../../Creators/creators");
const userdb = require("../../Creators/userdb");
const { filterBlockedUsers } = require("../../utiils/blockFilter");

const createCreator = async (req, res) => {
  const userid = req.body.userid;
  
  try {
    let verified = await creators
      .find({
        verify: "live",
      })
      .exec();

    let useronline = await userdb.find().exec();

    if (!verified[0]) {
      return res.status(200).json({
        ok: false,
        message: `user host empty`,
        host: [],
      });
    }

    let host = [];

    for (let i = 0; i < useronline.length; i++) {
      for (let j = 0; j < verified.length; j++) {
        if (String(verified[j].userid) === String(useronline[i]._id)) {
          const photolink = verified[j].creatorfiles.map((creatorfile) => {
            return creatorfile.creatorfilelink;
          });

          listofhost = {
            hostid: verified[j]._id,
            photolink,
            verify: verified[j].verify,
            name: verified[j].name,
            age: verified[j].age,
            location: verified[j].location,
            price: verified[j].price,
            duration: verified[j].duration,
            description: verified[j].description,
            gender: verified[j].gender,
            timeava: verified[j].timeava.join(" "),
            daysava: verified[j].daysava.join(" "),
            hosttype: verified[j].hosttype,
            online: useronline[i].active,
            userid: verified[j].userid,
            amount: verified[j].price,
            createdAt: verified[j].createdAt,
            updatedAt: verified[j].updatedAt,
            views: verified[j].views.length,
          };

          host.push(listofhost);
        }
      }
    }

    // Filter out blocked users from the host list
    console.log(`🔍 [DISCOVER] Before filtering: ${host.length} hosts for user ${userid}`);
    
    // Convert host objects to user-like objects for filtering
    const hostAsUsers = host.map(h => ({
      _id: h.userid,
      id: h.userid,
      userId: h.userid,
      ...h
    }));
    
    const filteredHostAsUsers = await filterBlockedUsers(hostAsUsers, userid);
    console.log(`🔍 [DISCOVER] After filtering: ${filteredHostAsUsers.length} hosts remaining`);
    
    // Convert back to host format
    const filteredHost = filteredHostAsUsers.map(user => ({
      hostid: user.hostid,
      photolink: user.photolink,
      verify: user.verify,
      name: user.name,
      age: user.age,
      location: user.location,
      price: user.price,
      duration: user.duration,
      description: user.description,
      gender: user.gender,
      timeava: user.timeava,
      daysava: user.daysava,
      hosttype: user.hosttype,
      online: user.online,
      userid: user.userid,
      amount: user.amount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      views: user.views
    }));

    return res.status(200).json({
      ok: true,
      message: `Creator Fetched successfully`,
      host: filteredHost,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`,
    });
  }
};

module.exports = createCreator;
