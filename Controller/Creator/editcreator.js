const creators = require("../../Creators/creators");
const { updateManyFileToCloudinary } = require("../../utiils/storj");

const editCreator = async (req, res) => {
  
  // Handle data from FormData (individual fields) or JSON string
  let data;
  if (req.body.data) {
    // If data is sent as JSON string
    data = JSON.parse(req.body.data);
  } else {
    // If data is sent as individual form fields
    data = req.body;
  }
  
  

  let hostid = data.hostid;
  let age = data.age;
  let location = data.location;
  let state = data.state;
let tours = data.tours;
if (typeof tours === "string") {
  try {
    tours = JSON.parse(tours);
  } catch {
    tours = undefined;
  }
}
  let price = data.price;
  let duration = data.duration;
  let description = data.description;
  let gender = data.gender;
  let timeava = data.timeava;
  let daysava = data.daysava;
  let hosttype = data.hosttype;
  let name = data.name; // Add name field
  let userId = data.userId; // Add userId field
  let creator_portfolio_id = data.creator_portfolio_id; // Add creator_portfolio_id field

  // Handle array fields properly (FormData sends arrays as multiple fields with same name)

  if (Array.isArray(data.timeava)) {
    timeava = data.timeava;
  } else if (typeof data.timeava === 'string') {
    try {
      timeava = JSON.parse(data.timeava);
    } catch (e) {
      timeava = [data.timeava];
    }
  }

  if (Array.isArray(data.daysava)) {
    daysava = data.daysava;
  } else if (typeof data.daysava === 'string') {
    try {
      daysava = JSON.parse(data.daysava);
    } catch (e) {
      daysava = [data.daysava];
    }
  }
  // photolink = data.photolink

  if (!hostid) {
    return res.status(400).json({
      ok: false,
      message: "User Id invalid!!",
    });
  }

  let currentuser = await creators
    .findOne({
      userid: hostid,
    })
    .exec();

  if (!currentuser) {
    return res.status(409).json({
      ok: false,
      message: `User can not edit portfolio`,
    });
  }


  let publicIDs = [];

  if (currentuser.creatorfiles.length > 0) {
    const creatorfilepublicids = currentuser.creatorfiles.map((creatorfile) => {
      return creatorfile.creatorfilepublicid;
    });

    publicIDs = creatorfilepublicids;
  }


  /**
   * This implementation allows for in memory file upload manipulation
   * This prevents accessing the filesystem of the hosted server
   */
  let results = [];

  if (req.files && req.files.length > 0) {
    
    results = await updateManyFileToCloudinary(publicIDs, req.files, "creator");
    
  } else {
  }

  let creatorfiles = [];

  // Clean up uploaded file for database storage
  if (results && results.length !== 0) {
    const databaseReady = results.map((result) => {
      return {
        creatorfilelink: result.file_link,
        creatorfilepublicid: result.public_id,
      };
    });
    creatorfiles = databaseReady;
  }

  // Handle existing images that should be preserved
  // Multipart often sends repeated fields as single value; support both array and JSON string
  let existingImagesList = data.existingImages;
  if (existingImagesList != null) {
    if (typeof existingImagesList === 'string') {
      try {
        existingImagesList = JSON.parse(existingImagesList);
      } catch {
        existingImagesList = existingImagesList ? [existingImagesList] : [];
      }
    }
    if (Array.isArray(existingImagesList) && existingImagesList.length > 0) {
      const existingFiles = existingImagesList.map((imgUrl) => ({
        creatorfilelink: imgUrl,
        creatorfilepublicid: null,
      }));
      creatorfiles = [...existingFiles, ...creatorfiles];
    }
  }

  //let data = await connectdatabase()

  try {
    const age1 = currentuser.age;
    const location1 = currentuser.location;
    const state1 = currentuser.state;
    const tours1 = currentuser.tours;
    const price1 = currentuser.price;
    const duration1 = currentuser.duration;
    const description1 = currentuser.description;
    const gender1 = currentuser.gender;
    const timeava1 = currentuser.timeava;
    const daysava1 = currentuser.daysava;
    const hosttype1 = currentuser.hosttype;
    const initialCreatorFiles = currentuser.creatorfiles;

    if (!age) {
      age = age1;
    }

    if (!location) {
      location = location1;
    }
    if (state === undefined) {
  state = state1;
}
if (tours === undefined) {
  tours = tours1;
}
    if (!price) {
      price = price1;
    }
    if (!duration) {
      duration = duration1;
    }
    if (!description) {
      description = description1;
    }
    if (!gender) {
      gender = gender1;
    }
    if (!timeava) {
      timeava = timeava1;
    }
    if (!daysava) {
      daysava = daysava1;
    }
    if (!hosttype) {
      hosttype = hosttype1;
    }
    if (!creatorfiles) {
      currentuser.creatorfiles = initialCreatorFiles;
    }

    currentuser.name = name || currentuser.name; // Update name if provided
    currentuser.age = age;
    currentuser.location = location;
    currentuser.location = location;
currentuser.state = state;
currentuser.tours = tours;
    currentuser.price = price;
    currentuser.duration = duration;
    currentuser.description = description;
    currentuser.gender = gender;
    currentuser.timeava = timeava;
    currentuser.daysava = daysava;
    currentuser.hosttype = hosttype;

    if (creatorfiles && creatorfiles.length > 0) {
      currentuser.creatorfiles = creatorfiles;
    } else {
    }


    await currentuser.save();


    // await data.databar.updateDocument(data.dataid,data.creatorCol,currentuser._id,currentuser)

    return res.status(200).json({
      ok: true,
      message: `Creator Update successfully`,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      ok: false,
      message: `${err.message}!`,
    });
  }
};

module.exports = editCreator;
