// routes/api/creator/getdocument.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const getdocument = require("../../../Controller/Creator/getdocument");
const getFanDocuments = require("../../../Controller/Creator/getFanDocuments");
const getFanDocumentByUserId = require("../../../Controller/Creator/getFanDocumentByUserId");
const updateApplicationDocument = require("../../../Controller/Creator/updateApplicationDocument");
const deleteApplicationDocument = require("../../../Controller/Creator/deleteApplicationDocument");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/", getdocument);
router.get("/fan", getFanDocuments);  
router.get("/fan/:userid", getFanDocumentByUserId);

// Admin: edit an application's fields and/or replace its photos
router.put("/:docid", upload.any(), updateApplicationDocument);
// Admin: permanently delete an application (creator or fan)
router.delete("/:docid", deleteApplicationDocument);

module.exports = router;