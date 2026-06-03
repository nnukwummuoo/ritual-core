// routes/api/creator/getdocument.js
const express = require("express");
const router = express.Router();
const getdocument = require("../../../Controller/Creator/getdocument");
const getFanDocuments = require("../../../Controller/Creator/getFanDocuments");
const getFanDocumentByUserId = require("../../../Controller/Creator/getFanDocumentByUserId");

router.get("/", getdocument);
router.get("/fan", getFanDocuments);  
router.get("/fan/:userid", getFanDocumentByUserId);

module.exports = router;