const requestdb = require("../../Creators/requsts")
const userdb = require("../../Creators/userdb")
const creatordb = require("../../Creators/creators")
const historydb = require("../../Creators/mainbalance")
const admindb = require("../../Creators/admindb")
let sendEmail = require("../../utiils/sendEmailnot")
let { pushActivityNotification } = require("../../utiils/sendPushnot")

const createLike = async (req, res) => {

    const userid = req.body.userid;
    let creator_portfolio_id = req.body.creator_portfolio_id;
    const type = req.body.type;
    const time = req.body.time
    const place = req.body.place
    const date = req.body.date
    const price = req.body.price


    if (!creator_portfolio_id && !userid) {
        return res.status(400).json({ "ok": false, 'message': 'user Id invalid!!' })
    }
    //console.log('untop init db')

    //let data = await connectdatabase()

    try {
        const user = await userdb.findOne({ _id: userid }).exec()

        if (!user) {
            return res.status(404).json({ "ok": false, 'message': 'User not found' })
        }

        let userbalance = parseFloat(user.balance)

        let creatorprice = parseFloat(price)

        if (!userbalance) {
            userbalance = 0
        }

        let creatoremail = await creatordb.findOne({ _id: creator_portfolio_id }).exec()

        if (!creatoremail) {
            return res.status(404).json({ "ok": false, 'message': 'Creator not found' })
        }


        // Normalize type for case-insensitive comparison
        const normalizedType = (type || "").toLowerCase().trim();

        // Only deduct gold for Fan meet and Fan date, not for Fan call or Private show
        // Fan call should never deduct gold, Fan meet should always deduct gold
        if (normalizedType !== "private show" && !normalizedType.includes("fan call")) {

            let total = userbalance - creatorprice

            let clienthistory = {
                userid,
                details: "Creator request pending",
                spent: `${creatorprice}`,
                income: "0",
                date: `${Date.now().toString()}`
            }

            if (total < 0) {
                return res.status(400).json({ "ok": false, 'message': 'insuffciate balance!!' })
            }

            // Deduct from balance and add to pending
            user.balance = String(total)
            user.pending = String((parseFloat(user.pending) || 0) + creatorprice)

            user.save()

            await historydb.create(clienthistory)

        }




        //console.log("user balance "+userbalance)

        await sendEmail(creatoremail.userid, "Accept appointment")
        await pushActivityNotification(creatoremail.userid, "New request received", "request")

        // IMPORTANT: Pending requests expire in 23 hours 14 minutes
        // After acceptance, they get extended based on type (10 days for Fan Call, 20 days for others)
        let requests = {
            userid,
            creator_portfolio_id,
            type,
            place,
            time,
            status: "request",
            date,
            price: creatorprice,
            expiresAt: new Date(Date.now() + (23 * 60 * 60 * 1000) + (14 * 60 * 1000)) // 23h 14m for pending requests
        }

        const request = await requestdb.create(requests)

        // Get user details for notification (user already fetched above)
        const creator = await creatordb.findOne({ _id: creator_portfolio_id }).exec()

        // Create database notification for creator
        if (user && creator) {
            const hostType = type || "Fan meet"
            const userName = user.firstname && user.lastname
                ? `${user.firstname} ${user.lastname}`
                : user.firstname || user.username || 'Unknown User'

            await admindb.create({
                userid: creator.userid,
                message: `New ${hostType.toLowerCase()} request from ${userName}`,
                seen: false
            })

            // Create database notification for fan
            const creatorName = creator.firstname && creator.lastname
                ? `${creator.firstname} ${creator.lastname}`
                : creator.firstname || creator.name || 'Unknown Creator'

            await admindb.create({
                userid: userid,
                message: `${hostType} request sent to ${creatorName}`,
                seen: false
            })
        }

        return res.status(200).json({ "ok": true, "message": ` Success` })


    } catch (err) {
        return res.status(500).json({ "ok": false, 'message': `${err.message}!` });
    }
}

module.exports = createLike