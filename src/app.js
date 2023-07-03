import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"
import Joi from "joi"
import dayjs from "dayjs"

const app = express()

app.use(cors())
app.use(express.json())
dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)

try {
    await mongoClient.connect()
    console.log("MongoDB conectado!")
} catch (err) {
    (err) => console.log(err.message)
}

const db = mongoClient.db()

app.post("/participants", async (req, res) => {
    const { name } = req.body
    const data = dayjs().format("HH:mm:ss")

    const schema = Joi.object({
        name: Joi.string().required()
    })

    const validation = schema.validate(req.body, { abortEarly: false })

    if (validation.error) {

        return res.sendStatus(422)
    }

    try {

        const nome = await db.collection("participants").findOne({ name: name })
        if (nome) return res.status(409).send("Esse usuário já existe!")

        const participant = {
            name: name,
            lastStatus: Date.now()
        }

        const resultparticipant = await db.collection("participants").insertOne(participant)

        if (resultparticipant.insertedCount === 0) {return res.sendStatus(500)}

        const message = {

            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: data
        }

        const resultmessage = await db.collection("messages").insertOne(message)

        if (resultmessage.insertedCount === 0) {return res.sendStatus(500)}

        res.sendStatus(201)

    } catch (err) {
        res.status(500).send(err.message)
    }

})

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray()
        res.send(participants)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const from = req.headers.user
    const data = dayjs().format("HH:mm:ss")

    const schema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid("message", "private_message").required()
    })

    const validation = schema.validate(req.body, { abortEarly: false })

    if (validation.error) {
        return res.sendStatus(422)
    }

    try {
        const participant = await db.collection("participants").findOne({ name: from })
        if (!participant) return res.sendStatus(400)

        const message = {

            from: from,
            to: to,
            text: text,
            type: type,
            time: data
        }

        const resultmessage = await db.collection("messages").insertOne(message)

        if (resultmessage.insertedCount === 0) {return res.sendStatus(500)}

        res.sendStatus(201)

    } catch (err) {
        res.status(500).send(err.message)
    }

})

app.get("/messages", async (req, res) => {
    const user = req.headers.user
    const limit = req.query.limit

    try {

        if (limit) {
            if (limit <= 0 || isNaN(limit)) {
                return res.sendStatus(422)
            }
        }

        const messages = await db.collection("messages").find({ $or: [{ to: user }, { from: user}, { to: "Todos" }] }).toArray()

        if (limit) {
            const limitMessages = messages.slice(-limit)
            res.send(limitMessages)
        } else {
            res.send(messages)
        }

    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.post("/status", async (req, res) => {
    const { user } = req.headers
    const data = dayjs().format("HH:mm:ss")

    try {

        if (!user) return res.sendStatus(400)

        if (user) {
            const participant = await db.collection("participants").findOne({ name: user })
            if (!participant) return res.sendStatus(404)

            await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
            res.sendStatus(200)


        }

    } catch (err) {
        res.status(500).send(err.message)
    }
})

setInterval(async () => {
    try {
        const participants = await db.collection("participants").find().toArray()
        const data = dayjs().format("HH:mm:ss")
        const data2 = dayjs().subtract(10, 'second').format("HH:mm:ss")

        participants.forEach(async (participant) => {
            if (participant.lastStatus < Date.now() - 10000) {
                await db.collection("participants").deleteOne({ _id: ObjectId(participant._id) })
                const message = {
                    from: participant.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: data
                }
                await db.collection("messages").insertOne(message)
            }
        })
    } catch (err) {
        res.status(500).send(err.message)
    }
}, 15000)


const PORT = 5000
app.listen(PORT, () => console.log(`Servidor está rodando na porta ${PORT}`))