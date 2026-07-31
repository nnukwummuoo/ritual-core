const bcrypt = require("bcrypt");
const userdb = require("../../Creators/userdb");

// Word list used only to generate a fresh display phrase — doesn't need to
// match the frontend's list exactly, it's hashed immediately either way.
const wordList = [
  "apple","ball","cat","dog","egg","fish","goat","hat","ice","jam",
  "kite","lamp","moon","nest","orange","pen","queen","rain","sun","tree",
  "umbrella","van","water","xray","yarn","zebra","book","chair","desk","door",
  "floor","glass","house","key","leaf","milk","note","oven","plate","road",
  "shoe","table","unit","vase","wall","yard","zero","air","bag","car",
  "day","ear","fan","game","hand","iron","job","king","line","man",
  "net","oil","park","quiz","ring","salt","time","use","voice","wind",
  "year","zone","bread","cloud","dust","fire","gold","hill","ink","joy",
  "love","map","name","open","pool","rice","sand","town","user","view",
  "wood","young","baby","cold","dark","easy","fast","good","hard","idea",
  "kind","long","more","new","old","play","quick","red","small","tall",
  "up","very","white","yellow","blue","green","black","brown","silver","gray",
  "happy","sad","angry","calm","peace","hope","fear","dream","wish","smile",
  "laugh","cry","sing","dance","walk","run","jump","sit","stand","sleep",
  "wake","eat","drink","cook","read","write","draw","paint","build","fix",
  "open","close","start","stop","push","pull","carry","lift","drop","throw",
  "catch","hold","touch","feel","see","hear","smell","taste","think","know",
  "learn","teach","work","rest","play","study","drive","ride","fly","swim",
  "climb","fall","grow","cut","break","make","give","take","send","call",
  "ask","answer","tell","say","talk","listen","look","watch","show","find",
  "lose","win","begin","end","stay","go","come","leave","enter","exit",
  "rise","move","stand","sit","walk","run","jump","sleep","dream","light",
  "dark","hot","cold","wet","dry","soft","hard","high","low","big",
  "small","short","long","wide","narrow","deep","shallow","near","far","early",
  "late","young","old","new","used","clean","dirty","full","empty","strong",
  "weak","rich","poor","fast","slow","right","left","north","south","east",
  "west","morning","noon","night","day","week","month","year","time","life",
  "death","man","woman","boy","girl","child","friend","family","people","city",
  "town","village","country","world","earth","sky","sea","river","lake","mountain",
  "forest","field","garden","road","street","bridge","school","work","home","shop",
  "market","bank","office","room","bed","chair","table","door","window","wall",
  "floor","roof","light","fan","clock","phone","radio","tv","computer","music",
  "song","film","game","sport","ball","team","goal","win","lose","food",
  "drink","fruit","meat","rice","bread","milk","water","tea","coffee","sugar",
  "salt","spice","sweet","soup","cake","fish","egg","oil","butter","money",
  "coin","note","card","price","cost","buy","sell","pay","save","love",
  "hope","peace","joy","fear","dream","wish","smile","laugh","cry","clouds",
  "storm","rainbow","riverbank","shore","beach","desert","valley","cave","stone","rock",
  "metal","iron","steel","wood","paper","pen","pencil","brush","color","paint",
  "picture","photo","camera","screen","keyboard","mouse","button","switch","lamp","lightbulb",
  "engine","wheel","tire","car","bus","train","ship","boat","plane","rocket",
  "star","planet","space","galaxy","universe","atom","cell","blood","heart","brain",
  "body","arm","leg","hand","foot","eye","ear","nose","mouth","face",
  "hair","skin","bone","muscle","voice","sound","noise","music","song","melody",
  "rhythm","beat","dance","move","step","jump","run","walk","sit","stand",
  "rest","sleep","dream","wake","think","plan","goal","task","job","work",
  "play","fun","joy","laugh","smile","cry","tear","sad","angry","calm",
  "peace","hope","love","care","help","share","give","take","send","call",
  "text","chat","talk","listen","hear","see","look","watch","show","find",
  "lose","win","begin","end","start","stop","open","close","push","pull",
  "carry","lift","drop","throw","catch","hold","touch","feel","taste","smell",
  "hot","cold","warm","cool","wet","dry","soft","hard","light","dark",
  "big","small","short","long","wide","narrow","deep","shallow","high","low",
  "early","late","young","old","new","used","clean","dirty","full","empty",
  "strong","weak","rich","poor","fast","slow","right","left","north","south",
  "east","west","day","night","week","month","year","time","life","death"
];

const generatePhrase = () => {
  const phrase = new Set();
  while (phrase.size < 12) {
    const randomIndex = Math.floor(Math.random() * wordList.length);
    phrase.add(wordList[randomIndex].toLowerCase());
  }
  return Array.from(phrase);
};

const regenerateSecretPhrase = async (req, res) => {
  const userId = req.userId; // set by verifyJwt middleware
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      ok: false,
      message: "Please enter your password to continue.",
    });
  }

  try {
    const user = await userdb.findOne({ _id: userId }).exec();
    if (!user) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    // Re-authenticate — this is a security-critical action
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ ok: false, message: "Incorrect password" });
    }

    const newPhrase = generatePhrase();
    const phraseString = newPhrase.join(" ");
    const hashedPhrase = await bcrypt.hash(phraseString, 10);

    user.secretPhraseHash = hashedPhrase;
    await user.save();

    // The plaintext phrase is returned exactly once, right here.
    // It is never stored anywhere — only its hash persists.
    return res.status(200).json({
      ok: true,
      message: "Secret phrase regenerated successfully",
      secretPhrase: newPhrase,
    });
  } catch (err) {
    console.error("❌ Regenerate secret phrase error:", err);
    return res.status(500).json({
      ok: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

module.exports = regenerateSecretPhrase;