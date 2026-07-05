let admindb = require("../../Creators/admindb")
let requestdb =  require("../../Creators/requsts")
let commentdb = require("../../Creators/comment")
let crushdb = require("../../Creators/crushdb")
let follwerdb = require("../../Creators/followers")
let gift = require("../../Creators/gift")
let mainbalance = require("../../Creators/mainbalance")
let messagedb = require("../../Creators/message")
let reviewdb = require("../../Creators/review")
let userdb = require("../../Creators/userdb")
let videocalldb = require("../../Creators/videoalldb")
let postdb = require("../../Creators/post")
let deletelike = require("../deleteLike")
const deleteImage = require("../deleteImage")
let exclusivedb = require("../../Creators/exclusivedb")
let completedb = require("../../Creators/usercomplete")
let exclusivepurchase = require("../../Creators/exclusivePurshase")
let creatordb = require("../../Creators/creators")
let blockeddb = require("../../Creators/BlockedDB")
let settingdb = require("../../Creators/settingsdb")
let pushdb = require("../../Creators/pushnotifydb")



let deletedbs = async(userid)=>{

 await admindb.deleteMany({userid:userid}).exec()
 await requestdb.deleteMany({userid:userid}).exec()
 await commentdb.deleteMany({userid:userid}).exec()
 await crushdb.deleteMany({userid:userid}).exec()
 await follwerdb.deleteMany({userid:userid}).exec()
 await gift.deleteMany({userid:userid}).exec()
 await mainbalance.deleteMany({userid:userid}).exec()
 await messagedb.deleteMany({fromid:userid}).exec()
 await reviewdb.deleteMany({userid:userid}).exec()
 await settingdb.deleteMany({userid:userid}).exec()
 await pushdb.deleteMany({userid:userid}).exec()
 await videocalldb.deleteMany({callerid:userid}).exec()
 await exclusivepurchase.deleteMany({userid:userid}).exec()
 await blockeddb.deleteMany({userid:userid}).exec()

 // delete like with post id

 let list_of_post = await postdb.find({userid:userid}).exec()
 let list_of_exclusve = await exclusivedb.find({userid:userid}).exec()
 let userImage = await completedb.findOne({useraccountId:userid}).exec()
 let creatorimage = await creatordb.findOne({userid:userid}).exec()
 

 for(let i = 0; i < list_of_post.length; i++){
    await deletelike(String(list_of_post[i]._id))

    if(list_of_post[i].postlink){
      try{
         await deleteImage("post",list_of_post[i].postlink)
      }catch{
          console.log("failed deleting post")
      }
   
    }
 }
 console.log("failone")
 await postdb.deleteMany({userid:userid}).exec()

 for(let i = 0; i < list_of_exclusve.length; i++){

  
      if(list_of_exclusve[i].thumblink){
         console.log("fail in thumb")
         console.log("thumb "+list_of_exclusve[i].thumblink)
         try{
            await deleteImage("post",list_of_exclusve[i].thumblink)
         }catch{
            console.log("failed deleting thumb")
         }
        
       }
   
       if(list_of_exclusve[i].contentlink){
         console.log("thumb "+list_of_exclusve[i].thumblink)
         try{
            await deleteImage("content",list_of_exclusve[i].contentlink)
            await deleteImage("post",list_of_exclusve[i].contentlink)
         }catch{
            console.log("failed deleting content and post")
         }

         }

   
   
 }
 console.log("failtwo")
 await exclusivedb.deleteMany({userid:userid}).exec()

 if(creatorimage){

    if(creatorimage.photolink){

        let images = creatorimage.photolink.split(",")

        for(let i = 0; i < images.length; i++){
         try{
            await deleteImage("post",images[i])
         }catch{
           console.log("failed deleting creator")
         }
            
        }
        
     }
   
 }
 console.log("failtree")
 await creatordb.deleteOne({userid:userid}).exec()


if(userImage){

  if(userImage.photoLink){
      try{
         await deleteImage("profile",userImage.photoLink)
      }catch{
         console.log("failed deleting profile photo")
      }
   }
  await completedb.deleteOne({useraccountId:userid}).exec()
}
 await userdb.deleteOne({_id:userid}).exec()
}

module.exports = deletedbs;