// routes/api/creator/getdocument.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const getdocument = require("../../../Controller/Creator/getdocument");
const getFanDocuments = require("../../../Controller/Creator/getFanDocuments");
const getFanDocumentByUserId = require("../../../Controller/Creator/getFanDocumentByUserId");
const updateApplicationDocument = require("../../../Controller/Creator/updateApplicationDocument");
const deleteApplicationDocument = require("../../../Controller/Creator/deleteApplicationDocument");
const adminFillDocument = require("../../../Controller/Creator/adminFillDocument");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/", getdocument);
router.get("/fan", getFanDocuments);  
router.get("/fan/:userid", getFanDocumentByUserId);

// Admin: create or fill in a verification record for a manually-verified
// user who never actually submitted an application. Must be registered
// before the "/:docid" route below, or Express would match "admin" as a
// docid value instead of reaching this handler.
router.put("/admin/:userid", upload.any(), adminFillDocument);

// Admin: edit an application's fields and/or replace its photos
router.put("/:docid", upload.any(), updateApplicationDocument);
// Admin: permanently delete an application (creator or fan)
router.delete("/:docid", deleteApplicationDocument);

module.exports = router;